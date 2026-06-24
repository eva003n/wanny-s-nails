import { type Job } from "bullmq";
import { config } from "@wannys-nails/packages";
import { logger } from "@wannys-nails/packages";
import { prisma } from "@wannys-nails/packages";

const log = logger.child({ module: "job:stk-push" });

// ─── Job Data Types ──────────────────────────────────────────

export interface StkPushJobData {
  bookingId: string;
  paymentId: string;
  phoneNumber: string;
  amount: number;
  accountReference: string;
}

interface DarajaSTKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
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

export async function stkPushProcessor(job: Job<StkPushJobData>): Promise<void> {
  const { bookingId, paymentId, phoneNumber, amount, accountReference } = job.data;

  log.info(
    { event: "stk_push.job.start", jobId: job.id, bookingId, phoneNumber },
    "Processing STK Push job",
  );

  // Verify payment is still in PENDING state (idempotency)
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    log.warn({ event: "stk_push.job.payment_not_found", paymentId }, "Payment not found, skipping");
    return;
  }
  if (payment.status === "PAID" || payment.status === "REFUNDED") {
    log.info(
      { event: "stk_push.job.already_resolved", paymentId, status: payment.status },
      "Payment already resolved, skipping STK Push",
    );
    return;
  }

  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);
  const { default: axios } = await import("axios");

  try {
    const accessToken = await getAccessToken();

    const response = await axios.post<DarajaSTKPushResponse>(
      config.DARAJA_STK_PUSH_URL,
      {
        BusinessShortCode: config.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: config.DARAJA_SHORTCODE,
        PhoneNumber: phoneNumber,
        CallBackURL: config.DARAJA_CALLBACK_URL,
        AccountReference: accountReference,
        TransactionDesc: "Booking payment",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const { CheckoutRequestID, ResponseCode } = response.data;

    if (ResponseCode !== "0") {
      log.error(
        { event: "stk_push.job.rejected", checkoutRequestId: CheckoutRequestID, responseCode: ResponseCode },
        "STK Push rejected by Daraja",
      );
      throw new Error(`Daraja rejected STK Push: ${response.data.ResponseDescription}`);
    }

    // Update payment record with the checkout request ID
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        checkoutRequestId: CheckoutRequestID,
        status: "PAYMENT_PENDING",
        phoneNumber,
      },
    });

    // Record the transaction attempt
    const attemptCount = await prisma.paymentTransaction.count({
      where: { paymentId },
    });

    await prisma.paymentTransaction.create({
      data: {
        paymentId,
        attemptNumber: attemptCount + 1,
        checkoutRequestId: CheckoutRequestID,
        rawRequest: {
          MerchantRequestID: response.data.MerchantRequestID,
          CheckoutRequestID,
        },
      },
    });

    log.info(
      {
        event: "stk_push.job.success",
        jobId: job.id,
        bookingId,
        checkoutRequestId: CheckoutRequestID,
      },
      "STK Push initiated successfully",
    );
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: unknown }; message?: string };
    log.error(
      {
        event: "stk_push.job.failed",
        jobId: job.id,
        bookingId,
        status: err.response?.status,
        response: err.response?.data,
        error: err.message,
      },
      "STK Push request failed",
    );
    throw error; // BullMQ will retry
  }
}