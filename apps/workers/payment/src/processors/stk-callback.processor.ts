import { type Job } from "bullmq";
import {
  log as logger,
  prisma,
  _config as config,
  notificationQueue,
} from "../lib/index.js";

import {
  parseStkCallbackBody,
  extractCallbackMetadata,
  isStkCallbackSuccess,
} from "../lib/schemas.js";
import { JOB_NAMES } from "@wannys-nails/core";
import { getFailureReason, getTerminalStatus } from "../utils/index.js";

const log = logger.child({ module: "job:stk-callback" });

// ─── Job Data Types ──────────────────────────────────────────

export interface StkCallbackJobData {
  checkoutRequestId: string;
  resultCode: number;
  rawCallback: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────

async function getAttemptNumber(paymentId: string): Promise<number> {
  const count = await prisma.paymentTransaction.count({
    where: { paymentId },
  });
  return count + 1;
}

function parseDarajaDate(raw: string): Date {
  // Daraja sends TransactionDate as "YYYYMMDDHHmmss"
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  const hours = raw.slice(8, 10);
  const minutes = raw.slice(10, 12);
  const seconds = raw.slice(12, 14);
  return new Date(
    `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`,
  ); // EAT
}

// ─── Processor ───────────────────────────────────────────────

export async function processStkCallback(
  job: Job<StkCallbackJobData>,
): Promise<void> {
  const { checkoutRequestId, resultCode, rawCallback } = job.data;

  log.info(
    {
      event: "stk_callback.job.start",
      jobId: job.id,
      checkoutRequestId,
      resultCode,
    },
    "Processing STK callback job",
  );

  // 1. Find the pending payment by checkoutRequestId
  const payment = await prisma.payment.findUnique({
    where: { checkoutRequestId },
    include: {
      booking: {
        include: { customer: true },
      },
    },
  });

  if (!payment) {
    log.warn(
      { event: "stk_callback.job.payment_not_found", checkoutRequestId },
      "Callback for unknown CheckoutRequestID,  skipping",
    );
    return;
  }

  // Ensure the booking is either complete or no_show before processing payment
  const allowPaymentList = ["COMPLETED", "NO_SHOW"];

  if (!allowPaymentList.includes(payment.booking.status)) {
    log.info(
      {
        event: "booking.status.invalid",
        paymentId: payment.id,
        status: payment.booking.status,
      },
      "Booking status must be either completed or no_show state before payment collection , skipping",
    );
    return;
  }
  // 2. Idempotency guard: if already completed, skip
  if (
    payment.completedAt ||
    payment.status === "SUCCESS" ||
    payment.status === "REFUNDED"
  ) {
    log.info(
      { event: "stk_callback.job.duplicate", paymentId: payment.id },
      "Duplicate callback, payment already completed",
    );
    return;
  }

  // 3. Terminal-state guard: never let a late/duplicate callback
  //    overwrite an already-resolved payment
  if (
    ["SUCCESS", "FAILED", "CANCELLED", "EXPIRED", "RECONCILING"].includes(
      payment.status,
    )
  ) {
    log.info(
      {
        event: "stk_callback.job.already_terminal",
        paymentId: payment.id,
        status: payment.status,
      },
      "Payment already in terminal or reconciling state, ignoring callback",
    );
    return;
  }

  // 4. Process the callback inside a transaction(Avoid Race condition)
  await prisma.$transaction(async (tx) => {
    if (resultCode === 0) {
      // --- Successful payment ---
      // Parse the callback to extract metadata
      let receiptNumber: string;
      let amount: number;
      let transactionDate: string;

      try {
        const parsed = parseStkCallbackBody(rawCallback);
        if (!isStkCallbackSuccess(parsed.Body.stkCallback)) {
          throw new Error("Expected success callback but got failure shape");
        }
        const metadata = extractCallbackMetadata(parsed.Body.stkCallback);
        receiptNumber = metadata.mpesaReceiptNumber;
        amount = metadata.amount;
        transactionDate = metadata.transactionDate;
      } catch (err) {
        log.error(
          {
            event: "stk_callback.job.parse_failed",
            paymentId: payment.id,
            error: String(err),
          },
          "Failed to parse callback metadata",
        );
        // Don't throw — we don't want BullMQ to retry a malformed callback
        return;
      }

      // Amount verification
      if (amount !== payment.amountKes) {
        log.warn(
          {
            event: "stk_callback.job.amount_mismatch",
            paymentId: payment.id,
            expected: payment.amountKes,
            received: amount,
          },
          "Payment amount mismatch, flagging as disputed",
        );

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            failureReason: `Amount mismatch: expected ${payment.amountKes}, received ${amount}`,
          },
        });

        return;
      }

      // Record the transaction
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptNumber: await getAttemptNumber(payment.id),
          checkoutRequestId,
          resultCode: 0,
          resultDesc: "Success",
          mpesaReceiptNumber: receiptNumber,
          rawCallback: rawCallback as any,
        },
      });

      // Update payment to SUCCESS
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          mpesaReceiptNumber: receiptNumber,
          completedAt: parseDarajaDate(transactionDate),
        },
      });

      // Update booking payment status
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: "SUCCESS" },
      });

      log.info(
        {
          event: "stk_callback.job.success",
          paymentId: payment.id,
          bookingId: payment.bookingId,
          receiptNumber,
          amount,
        },
        "Payment processed successfully",
      );
    } else {
      // --- Failed/cancelled/expired payment ---
      const terminalStatus = getTerminalStatus(resultCode);
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptNumber: await getAttemptNumber(payment.id),
          checkoutRequestId,
          resultCode,
          resultDesc: `${getFailureReason(resultCode)}`,
          rawCallback: rawCallback as any,
        },
      });
      // sync both payment and booking payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: terminalStatus,
          failureReason: ` ${getFailureReason(resultCode)}`,
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

      log.info(
        {
          event: "stk_callback.job.failed",
          paymentId: payment.id,
          bookingId: payment.bookingId,
          resultCode,
          terminalStatus,
        },
        "Payment failed or cancelled",
      );
    }
  });

  // 5. Side effects (outside transaction — non-critical)
  //    These run after the DB transaction commits, so a notification
  //    failure never rolls back a payment.

  // TODO: notifications
}
