import { prisma, type Prisma } from "../../shared/lib/index.js";

import { paymentQueue } from "../../shared/lib/index.js";
import { logger } from "../../shared/lib/logger.js";


const log = logger.child({ module: "payments" });
import { PaymentFailedError, PaymentNotAllowedError, NotFoundError } from "../../shared/types/errors.js";

export const paymentsService = {
  async initiateStkPush(bookingId: string, phoneNumber: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!booking) {
      throw new NotFoundError("Booking");
    }

    if (booking.status !== "APPROVED") {
      throw new PaymentNotAllowedError("Booking must be in APPROVED status to initiate payment");
    }

    if (booking.payment?.status === "PAID" || booking.payment?.status === "REFUNDED") {
      throw new PaymentNotAllowedError("Booking already has a completed payment");
    }

    // Ensure payment record exists
    let payment = booking.payment;
    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          bookingId,
          amountKes: booking.priceKes,
          status: "UNPAID",
        },
      });
    }

    // Update status to PAYMENT_PENDING immediately
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAYMENT_PENDING", phoneNumber },
    });

    // Enqueue STK Push job to BullMQ (async processing)
    const job = await paymentQueue.add(
      "stk-push",
      {
        bookingId,
        paymentId: payment.id,
        phoneNumber,
        amount: booking.priceKes,
        accountReference: booking.reference,
      },
      {
        attempts: 2,
        backoff: { type: "fixed", delay: 30000 },
      },
    );

    log.info(
      { event: "stk_push.enqueued", bookingId, paymentId: payment.id, jobId: job.id },
      "STK Push job enqueued",
    );

    return {
      paymentId: payment.id,
      checkoutRequestId: null,
      message: `Payment request queued for ${phoneNumber}. You will receive an M-Pesa prompt shortly.`,
    };
  },

  async list(params: {
    page: number;
    limit: number;
    status: string | undefined;
    from: string | undefined;
    to: string | undefined;
    customerId: string | undefined;
  }) {
    const { page, limit, status, from, to, customerId } = params;
    const skip = (page - 1) * limit;

    const bookingWhere: Record<string, unknown> = {};
    const paymentWhere: Record<string, unknown> = {};

    if (status) {
      paymentWhere.status = status;
    }

    if (customerId) {
      bookingWhere.customerId = customerId;
    }

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      bookingWhere.appointmentAt = dateFilter;
    }

    const hasBookingFilter = Object.keys(bookingWhere).length > 0;
    const paymentWhereClause: Record<string, unknown> = { ...paymentWhere };
    if (hasBookingFilter) {
      paymentWhereClause.booking = bookingWhere;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: paymentWhereClause,
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              appointmentAt: true,
              customer: { select: { id: true, name: true } },
              service: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: paymentWhereClause }),
    ]);

    return { payments, total, page, limit };
  },

  async getById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: "asc" },
        },
        booking: {
          select: {
            id: true,
            reference: true,
            customer: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError("Payment");
    }

    return payment;
  },

  async getByBookingId(bookingId: string) {
    return prisma.payment.findUnique({
      where: { bookingId },
      include: { transactions: true },
    });
  },

  async handleCallback(callbackBody: Record<string, unknown>) {
    const body = callbackBody as { Body?: { stkCallback?: Record<string, unknown> } };
    const stkCallback = body.Body?.stkCallback ?? {};
    const checkoutRequestId = stkCallback.CheckoutRequestID as string;
    const resultCode = stkCallback.ResultCode as number;
    const resultDesc = stkCallback.ResultDesc as string;

    // find related payment 
    const payment = await prisma.payment.findUnique({
      where: { checkoutRequestId },
    });

    if (!payment) {
      log.warn({ event: "payment.callback.not_found", checkoutRequestId }, "Payment not found for callback");
      return;
    }

    if (payment.status === "PAID" || payment.status === "REFUNDED") {
      return;
    }

    if (resultCode === 0) {
      const metadata = stkCallback.CallbackMetadata as { Item: Array<{ Name: string; Value: unknown }> };
      const mpesaReceiptNumber = metadata?.Item?.find((i) => i.Name === "MpesaReceiptNumber")?.Value as string;
      const amount = metadata?.Item?.find((i) => i.Name === "Amount")?.Value as number;
      const transactionDate = metadata?.Item?.find((i) => i.Name === "TransactionDate")?.Value as string;

      if (amount && amount !== payment.amountKes) {
        log.warn({ event: "payment.callback.amount_mismatch", expected: payment.amountKes, received: amount }, "Payment amount mismatch — DISPUTED");
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          mpesaReceiptNumber,
          completedAt: transactionDate ? new Date(transactionDate) : new Date(),
        },
      });

      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: "PAID" },
      });

      const attemptCount = await prisma.paymentTransaction.count({
        where: { paymentId: payment.id },
      });

      await prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptNumber: attemptCount + 1,
          checkoutRequestId,
          resultCode,
          resultDesc,
          mpesaReceiptNumber,
          rawCallback: JSON.parse(JSON.stringify(callbackBody)),
        },
      });
    } else {
      const failureReason = getFailureReason(resultCode);

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAYMENT_FAILED",
          failureReason,
        },
      });

      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: "PAYMENT_FAILED" },
      });

      const attemptCount = await prisma.paymentTransaction.count({
        where: { paymentId: payment.id },
      });

      await prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptNumber: attemptCount + 1,
          checkoutRequestId,
          resultCode,
          resultDesc,
          rawCallback: callbackBody as unknown as Prisma.InputJsonValue,
        },
      });
    }
  },
};

function getFailureReason(code: number): string {
  const reasons: Record<number, string> = {
    1: "Insufficient funds",
    1032: "Request cancelled by user",
    1037: "DS timeout",
    2001: "Invalid credentials",
    2026: "Amount less than minimum",
    17: "Insufficient funds",
    26: "System busy",
  };
  return reasons[code] ?? `Daraja error code: ${code}`;
}