import { type Job } from "bullmq";
import {
  log as logger,
  prisma,
  type Prisma,
  _config as config,
} from "../lib/index.js";
import { mpesaHttpClient } from "../lib/httpclient.js";
import { notificationQueue } from "../lib/queues.js";
import { HttpClientError, JOB_NAMES } from "@wannys-nails/packages";
import { getFailureReason } from "../utils/index.js";
import { number, unknown } from "zod";

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

        await tx.notification.create({
          data: {
            bookingId: payment.bookingId,
            recipientId: payment.booking.customerId,
            recipientType: "CLIENT",
            type: "PAYMENT_SUCCESS",
            channel: "WHATSAPP",
            payload: {
              phoneNumber: payment.phoneNumber,
              bookingRef: payment.booking.reference,
              amountKes: payment.amountKes,
            },
            status: "PENDING",
            idempotencyKey: `payment.${payment.id}`, // bever use ':' bullmq will not allow it
          },
        });
      });

      // side effects

      const notification = await prisma.notification.findFirst({
        where: {
          bookingId: payment.bookingId,
        },
      });

      try {
        if (notification) {
          await notificationQueue.add(
            JOB_NAMES.WHATSAPP,
            notification.payload,
            {
              jobId: notification.idempotencyKey,
            },
          );
        }
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
      } else {
        // Retries exhausted — mark as EXPIRED/CANCELLED/FAILED(fallback)
        const terminalStatus =
          ResultCode === "1032"
            ? "CANCELLED"
            : ResultCode === "1037"
              ? "EXPIRED"
              : "FAILED";
        log.warn(
          {
            event: "payment_verify.job.expired",
            paymentId,
            retryCount,
          },
          "Payment retries exhausted — marking as EXPIRED",
        );

        // update payment and booking status
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: paymentId },
            data: {
              status: terminalStatus,
              failureReason: `Retries exhausted. Last error: ${getFailureReason(Number(ResultCode))}`,
            },
          });

          await tx.booking.update({
            where: {
              id: payment.bookingId,
            },
            data: {
              paymentStatus: terminalStatus,
            },
          });

          await tx.notification.create({
            data: {
              bookingId: payment.bookingId,
              recipientId: payment.booking.customerId,
              recipientType: "CLIENT",
              type: "PAYMENT_FAILED",
              channel: "WHATSAPP",
              payload: {
                phoneNumber: payment.phoneNumber,
                bookingRef: payment.booking.reference,
                amoutKes: payment.amountKes,
                failureReason: getFailureReason(Number(ResultCode)),
              },
              status: "PENDING",
              idempotencyKey: `payment.${payment.id}`,
            },
          });
        });

        try {
          const notification = await prisma.notification.findFirst({
            where: { bookingId: payment.bookingId },
          });

          if (notification) {
            await notificationQueue.add(
              JOB_NAMES.PAYMENT_EXPIRED,
              notification.payload,
              {
                jobId: notification.idempotencyKey,
              },
            );
          }
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

const MAX_RECONCILIATION_ATTEMPTS = 5;



export async function reconcileStalePayments(): Promise<void> {
  // payments that were marked pending ten minutes ago
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 min

  log.info(
    { event: "reconciliation.sweep.start", staleThreshold },
    "Starting stale payment reconciliation sweep",
  );

  // First pass: payments with a checkoutRequestId that are stuck in  pending
  const stuckPayments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: staleThreshold },
      checkoutRequestId: { not: null },
      reconciliationAttempts: {lt: MAX_RECONCILIATION_ATTEMPTS}
      
    },
    include: { booking: true },
  });

  if (stuckPayments.length === 0) {
    log.info(
      { event: "reconciliation.sweep.stop", staleThreshold },
      "No stuck payments found, stopping stale payment reconciliation sweep",
    );
  } else {
    for (const payment of stuckPayments) {
      try {
        // fresh  password/timestamp per payment
        const timestamp = generateTimestamp();
        const password = generatePassword(timestamp);

        const response = await mpesaHttpClient.post<DarajaQueryResponse>(
          "/mpesa/stkpushquery/v1/query",
          {
            BusinessShortCode: config.DARAJA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: payment.checkoutRequestId,
          },
        );

        // handles db related logic nothing else, so that anything db related fails it rolls back
        const { ResultCode } = response.data;

        await prisma.$transaction(async (tx) => {
          // transition payment status to reconciliation state
          // guard against race when real webhook callback lands while this sweep is in fright


          const claimed = await tx.payment.updateMany({
            where: { id: payment.id },
            data: {
              status: "RECONCILING",
              reconciliationAttempts: {increment: 1}
            },
          });

          // prevent race condition when reconciliation sweep and stk callback occur concurrently
          if (claimed.count === 0) {
            log.info(
              { event: "reconciliation.sweep.skipped", paymentId: payment.id },
              "Payment no longer PENDING, likely resolved by webhook — skipping",
            );
            return;
          }
          // sync booking payment status state with payment
          await tx.booking.update({
            where: {
              id: payment.bookingId,
            },
            data: {
              paymentStatus: "RECONCILING",
            },
          });

          if (ResultCode === "0") {
            // Payment succeeded but we missed the callback
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

            // sync payment and booking payment state machines
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: "SUCCESS", completedAt: new Date() },
            });

            await tx.booking.update({
              where: { id: payment.bookingId },
              data: { paymentStatus: "SUCCESS" },
            });

            // Record the notification
            await tx.notification.create({
              data: {
                bookingId: payment.bookingId,
                recipientId: payment.booking.customerId,
                recipientType: "CLIENT",
                type: "PAYMENT_SUCCESS",
                channel: "WHATSAPP",
                payload: {
                  phoneNumber: payment.phoneNumber,
                  bookingRef: payment.booking.reference,
                  amoutKes: payment.amountKes,
                },
                status: "PENDING",
                idempotencyKey: `payment.${payment.id}`,
              },
            });

            log.info(
              { event: "reconciliation.sweep.resolved", paymentId: payment.id },
              "Stale payment resolved as SUCCESS via reconciliation",
            );
          } else {
            // Payment status failed/cancelled/expired
            const terminalStatus =
              ResultCode === "1032"
                ? "CANCELLED"
                : ResultCode === "1037"
                  ? "EXPIRED"
                  : "FAILED";

            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: terminalStatus,
                failureReason: `Reconciled via sweep — ${getFailureReason(Number(ResultCode))}`,
              },
            });
            await tx.booking.update({
              where: {
                id: payment.bookingId,
              },
              data: {
                paymentStatus: terminalStatus,
              },
            });

            // Record the notification
            await tx.notification.create({
              data: {
                bookingId: payment.bookingId,
                recipientId: payment.booking.customerId,
                recipientType: "CLIENT",
                type: "PAYMENT_FAILED",
                channel: "WHATSAPP",
                payload: {
                  phoneNumber: payment.phoneNumber,
                  bookingRef: payment.booking.reference,
                  amoutKes: payment.amountKes,
                },
                status: "PENDING",
                idempotencyKey: `payment.${payment.id}`,
              },
            });

            log.info(
              { event: "reconciliation.sweep.failed", paymentId: payment.id, terminalStatus },
                `Stale payment marked as ${terminalStatus} via reconciliation `,
            );
          }
        });

        // side effects
        const notification = await prisma.notification.findFirst({
          where: {
            bookingId: payment.bookingId,
          },
        });

        try {
          if (ResultCode === "0" && notification) {
            await notificationQueue.add(
              JOB_NAMES.PAYMENT_CONFIRMATION,
              notification.payload,
              {
                jobId: notification.idempotencyKey,
              },
            );
          } else if (ResultCode !== "0" && notification) {
            await notificationQueue.add(
              JOB_NAMES.PAYMENT_FAILURE,
              notification.payload,
              {
                jobId: notification.idempotencyKey,
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
              },
            );
          }
        } catch {
          // non critical
        }
      } catch (error) {
        const err = error as unknown as HttpClientError;
        log.error(
          {
            event: "reconciliation.sweep.error",
            response: err instanceof HttpClientError ? err.responseBody : err,
            error: err.message,
          },
          "Reconciliation query failed — will retry next sweep",
        );
        // don't rethrow - one bad payment should not bock the others in batch
        continue;
      }
    }
  }

  // Second pass: payments stuck without ever getting a checkoutRequestId
  // (process crashed between Payment.create and the Daraja call)
  const deadPayments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      checkoutRequestId: null,
      createdAt: { lt: staleThreshold },
    },
    select: {
      id: true,
      bookingId: true,
    },
  });

  if (deadPayments.length === 0) {
    log.info(
      { event: "reconciliation.sweep.dead", count: deadPayments.length },
      "No payments found with missing CheckoutRequestId",
    );
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: {
          id: {
            in: deadPayments.map((p) => p.bookingId),
          },
        },
        data: {
          paymentStatus: "EXPIRED",
        },
      });

      if (deadPayments.length > 0) {
        log.info(
          { event: "reconciliation.sweep.dead", count: deadPayments.length },
          "Payments with no checkoutRequestId marked as EXPIRED",
        );
      }
    });
  }

  log.info(
    { event: "reconciliation.sweep.complete" },
    "Stale payment reconciliation sweep complete",
  );
}
