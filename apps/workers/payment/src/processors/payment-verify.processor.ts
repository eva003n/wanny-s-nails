import { type Job } from "bullmq";
import { config } from "../lib/config.js";
import { logger } from "@wannys-nails/packages";
import { prisma } from "@wannys-nails/packages";

const log = logger.child({ module: "job:payment-verify" });

// ─── Job Data Types ──────────────────────────────────────────

export interface PaymentVerifyJobData {
  bookingId: string;
  paymentId: string;
  checkoutRequestId: string;
}

interface DarajaQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

// ─── Daraja helpers ──────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { default: axios } = await import("axios");
  const response = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      auth: {
        username: config.DARAJA_CONSUMER_KEY,
        password: config.DARAJA_CONSUMER_SECRET,
      },
    },
  );
  return response.data.access_token;
}

function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generatePassword(timestamp: string): string {
  const data = `${config.DARAJA_SHORTCODE}${config.DARAJA_PASSKEY}${timestamp}`;
  return Buffer.from(data).toString("base64");
}

// ─── Processor ─────────────────────────────────────────────────

export async function paymentVerifyProcessor(
  job: Job<PaymentVerifyJobData>,
): Promise<void> {
  const { paymentId, checkoutRequestId } = job.data;

  log.info(
    {
      event: "payment_verify.job.start",
      jobId: job.id,
      paymentId,
      checkoutRequestId,
    },
    "Processing payment verification job",
  );

  // Check if already resolved (idempotency)
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    log.warn(
      { event: "payment_verify.job.payment_not_found", paymentId },
      "Payment not found",
    );
    return;
  }
  if (payment.status === "PAID" || payment.status === "REFUNDED") {
    log.info(
      {
        event: "payment_verify.job.already_resolved",
        paymentId,
        status: payment.status,
      },
      "Payment already resolved",
    );
    return;
  }

  const { default: axios } = await import("axios");
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);

  try {
    const accessToken = await getAccessToken();

    const response = await axios.post<DarajaQueryResponse>(
      config.DARAJA_STK_QUERY_URL,
      {
        BusinessShortCode: config.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const { ResultCode, ResultDesc } = response.data;

    log.info(
      {
        event: "payment_verify.result",
        paymentId,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
      },
      "Payment verification result received",
    );

    if (ResultCode === "0") {
      // Payment confirmed
      const attemptCount = await prisma.paymentTransaction.count({
        where: { paymentId },
      });

      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "PAID",
          completedAt: new Date(),
        },
      });

      await prisma.booking.update({
        where: { id: job.data.bookingId },
        data: { paymentStatus: "PAID" },
      });

      await prisma.paymentTransaction.create({
        data: {
          paymentId,
          attemptNumber: attemptCount + 1,
          checkoutRequestId,
          resultCode: Number(ResultCode),
          resultDesc: ResultDesc,
        },
      });
    } else {
      log.warn(
        { event: "payment_verify.not_paid", paymentId, resultCode: ResultCode },
        "Payment not yet completed or failed",
      );
      // Throw to retry later — customer might still be processing
      throw new Error(`Payment not yet confirmed: ${ResultDesc}`);
    }
  } catch (error: unknown) {
    const err = error as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    log.error(
      {
        event: "payment_verify.job.failed",
        jobId: job.id,
        paymentId,
        status: err.response?.status,
        response: err.response?.data,
        error: err.message,
      },
      "Payment verification failed",
    );
    throw error; // BullMQ will retry
  }
}
