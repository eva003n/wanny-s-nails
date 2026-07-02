import { type Job } from "bullmq";
import { log as logger, prisma, _config as config } from "../lib/index.js";
import { mpesaHttpClient } from "../lib/httpclient.js";
import { notificationQueue } from "../lib/queues.js";
import { HttpClientError, JOB_NAMES } from "@wannys-nails/packages";

const log = logger.child({ module: "job:payment-verify" });

// ─── Job Data Types ──────────────────────────────────────────

export interface PaymentVerifyJobData {
  paymentId: string;
  checkoutRequestId: string;
  bookingId: string;
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

// ─── Constants ───────────────────────────────────────────────

const MAX_PAYMENT_RETRIES = 2;

// ─── Processor: Timeout Check ────────────────────────────────
// Fires ~90s after STK push initiation. If the callback hasn't
// arrived yet, queries Daraja directly to determine the actual
// payment status instead of guessing.

export async function paymentVerifyProcessor(
  job: Job<PaymentVerifyJobData>,
): Promise<void> {
  const { paymentId, checkoutRequestId, bookingId } = job.data;

  log.info(
    {
      event: "payment_verify.job.start",
      jobId: job.id,
      paymentId,
      checkoutRequestId,
    },
    "Processing payment verification job",
  );

  // 1. Check if already resolved (callback arrived before timeout)
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { customer: true } } },
  });

  if (!payment) {
    log.warn(
      { event: "payment_verify.job.payment_not_found", paymentId },
      "Payment not found",
    );
    return;
  }

  if (payment.status !== "PENDING") {
    log.info(
      {
        event: "payment_verify.job.already_resolved",
        paymentId,
        status: payment.status,
      },
      "Payment already resolved by callback — skipping",
    );
    return;
  }

  // 2. Query Daraja for the actual transaction status
  //    The absence of a callback is NOT proof the payment failed —
  //    it's proof the *notification* failed. Ask Daraja directly.
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);

  try {
    const response = await mpesaHttpClient.post<DarajaQueryResponse>(
      "/mpesa/stkpushquery/v1/query",
      {
        BusinessShortCode: config.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
    );

    const { ResultCode, ResultDesc } = response.data;

    log.info(
      {
        event: "payment_verify.query_result",
        paymentId,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
      },
      "Daraja query result received",
    );

    if (ResultCode === "0") {
      // Payment actually succeeded — we just never got the callback.
      // Update payment and booking directly.
      await prisma.$transaction(async (tx) => {
        const attemptCount = await tx.paymentTransaction.count({
          where: { paymentId },
        });

        await tx.paymentTransaction.create({
          data: {
            paymentId,
            attemptNumber: attemptCount + 1,
            checkoutRequestId,
            resultCode: 0,
            resultDesc: "Confirmed via status query",
          },
        });

        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: "SUCCESS",
            completedAt: new Date(),
          },
        });

        await tx.booking.update({
          where: { id: bookingId },
          data: { paymentStatus: "SUCCESS" },
        });
      });

      // Notify customer
      try {
        await notificationQueue.add(
          JOB_NAMES.PAYMENT_CONFIRMATION,
          {
            phone: payment.booking.customer.phone,
            bookingRef: payment.booking.reference,
            amountKes: payment.amountKes,
          },
          { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
        );
      } catch {
        // Non-fatal
      }
    } else {
      // Payment definitely failed — decide whether to retry or expire
      const retryCount = await prisma.paymentTransaction.count({
        where: { paymentId },
      });

      if (retryCount < MAX_PAYMENT_RETRIES) {
        // TODO: Notify customer to retry rather than auto-retrying silently
        log.info(
          {
            event: "payment_verify.job.retry_prompt",
            paymentId,
            retryCount,
          },
          "Payment failed — prompting customer to retry",
        );

        await prisma.payment.update({
          where: { id: paymentId },
          data: {
            failureReason: `Attempt ${retryCount + 1} failed: ${ResultDesc}`,
          },
        });

        try {
          // todo: process rery notification and send to user via whatsapp
          await notificationQueue.add(
            JOB_NAMES.PAYMENT_RETRY,
            {
              phone: payment.booking.customer.phone,
              bookingRef: payment.booking.reference,
              paymentId,
            },
            { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
          );
        } catch {
          // Non-fatal
        }
      } else {
        // Retries exhausted — mark as EXPIRED
        log.warn(
          {
            event: "payment_verify.job.expired",
            paymentId,
            retryCount,
          },
          "Payment retries exhausted — marking as EXPIRED",
        );
        // update payment and booking status
        await prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: "EXPIRED",
            failureReason: `Retries exhausted. Last error: ${ResultDesc}`,
          },
        });

        await prisma.booking.update({
          where: {
            id: payment.bookingId,
          },
          data: {
            paymentStatus: "EXPIRED",
          },
        });

        try {
          // todo: implement
          await notificationQueue.add(
            JOB_NAMES.PAYMENT_EXPIRED,
            {
              phone: payment.booking.customer.phone,
              bookingRef: payment.booking.reference,
            },
            { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
          );
        } catch {
          // Non-fatal
        }
      }
    }
  } catch (error: unknown) {
    const err = error as HttpClientError;
    if (err instanceof HttpClientError) {
      log.error(
        {
          event: "payment_verify.job.failed",
          jobId: job.id,
          paymentId,
          status: err.status,
          response: err.responseBody,
          error: err.message,
        },
        "Payment verification query failed — will retry",
      );
    }

    throw error; // BullMQ will retry
  }
}

// ─── Reconciliation Sweep ─────────────────────────────────────
// Run periodically (every 5-10 min) to catch payments stuck in
// PENDING that never got a callback or timeout.

export async function reconcileStalePayments(): Promise<void> {
  // payments that were marked pending ten minutes ago
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 min

  log.info(
    { event: "reconciliation.sweep.start", staleThreshold },
    "Starting stale payment reconciliation sweep",
  );

  // First pass: payments with a checkoutRequestId that are stuck in status pending
  const stuckPayments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: staleThreshold },
      checkoutRequestId: { not: null },
    },
  });

  for (const payment of stuckPayments) {
    try {
      const timestamp = generateTimestamp();
      const password = generatePassword(timestamp);

      // transition payment status to reconciliation state
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "RECONCILING" },
      });

      await prisma.booking.update({
        where: {
          id: payment.bookingId,
        },
        data: {
          paymentStatus: "RECONCILING",
        },
      });

      const response = await mpesaHttpClient.post<DarajaQueryResponse>(
        "/mpesa/stkpushquery/v1/query",
        {
          BusinessShortCode: config.DARAJA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: payment.checkoutRequestId,
        },
      );

      const { ResultCode } = response.data;

      if (ResultCode === "0") {
        // Payment succeeded but we missed the callback
        await prisma.$transaction(async (tx) => {
          const attemptCount = await tx.paymentTransaction.count({
            where: { paymentId: payment.id },
          });

          await tx.paymentTransaction.create({
            data: {
              paymentId: payment.id,
              attemptNumber: attemptCount + 1,
              checkoutRequestId: payment.checkoutRequestId,
              resultCode: 0,
              resultDesc: "Reconciled via sweep",
            },
          });

          await tx.payment.update({
            where: { id: payment.id },
            data: { status: "SUCCESS", completedAt: new Date() },
          });

          await tx.booking.update({
            where: { id: payment.bookingId },
            data: { paymentStatus: "SUCCESS" },
          });
        });

        log.info(
          { event: "reconciliation.sweep.resolved", paymentId: payment.id },
          "Stale payment resolved as SUCCESS via reconciliation",
        );
      } else {
        // Payment status failed — mark as FAILED
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            failureReason: "Reconciled via sweep — payment not found on Daraja",
          },
        });
        await prisma.booking.update({
          where: {
            id: payment.bookingId,
          },
          data: {
            paymentStatus: "FAILED",
          },
        });

        log.info(
          { event: "reconciliation.sweep.failed", paymentId: payment.id },
          "Stale payment marked as FAILED via reconciliation",
        );
      }
    } catch (err) {
      log.error(
        {
          event: "reconciliation.sweep.error",
          paymentId: payment.id,
          error: String(err),
        },
        "Reconciliation query failed — will retry next sweep",
      );
    }
  }

  // Second pass: payments stuck without ever getting a checkoutRequestId
  // (process crashed between Payment.create and the Daraja call)
  const deadPayments = await prisma.payment.updateMany({
    where: {
      status: "PENDING",
      checkoutRequestId: null,
      createdAt: { lt: staleThreshold },
    },
    data: {
      status: "EXPIRED",
      failureReason: "No checkout request ID — push never sent",
    },
  });
  // sync booking payment status
  await prisma.booking.updateMany({
    where: {
      paymentStatus: "PENDING",
    },
    data: {
      paymentStatus: "FAILED",
    },
  });

  if (deadPayments.count > 0) {
    log.info(
      { event: "reconciliation.sweep.dead", count: deadPayments.count },
      "Payments with no checkoutRequestId marked as EXPIRED",
    );
  }

  log.info(
    { event: "reconciliation.sweep.complete" },
    "Stale payment reconciliation sweep complete",
  );
}
