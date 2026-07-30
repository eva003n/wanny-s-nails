import { JOB_NAMES } from "@wannys-nails/packages";
import { prisma, type Prisma } from "../../shared/lib/index.js";

import { paymentQueue } from "../../shared/lib/index.js";
import { logger } from "../../shared/lib/logger.js";

const log = logger.child({ module: "payments" });
import {
  PaymentFailedError,
  PaymentNotAllowedError,
  NotFoundError,
} from "../../shared/types/errors.js";

export const paymentsService = {
  async initiateStkPush(bookingId: string, phoneNumber: string, userId: string | null) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!booking) {
      throw new NotFoundError("Booking");
    }

    if (booking.status !== "APPROVED") {
      throw new PaymentNotAllowedError(
        "Booking must be in APPROVED status to initiate payment",
      );
    }

    // Check if there's an existing payment that's already resolved
    if (
      booking.payment?.status === "SUCCESS" ||
      booking.payment?.status === "REFUNDED"
    ) {
      throw new PaymentNotAllowedError(
        "Booking already has a completed payment",
      );
    }

    // New payment Request
    let payment = booking.payment;
    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          bookingId,
          amountKes: booking.priceKes,
          status: "PENDING",
        },
      });

      // If there's an existing failed/cancelled/expired payment, reset it to PENDING
    } else if (["FAILED", "CANCELLED", "EXPIRED"].includes(payment.status)) {
      // Reset for retry
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PENDING",
          checkoutRequestId: null,
          phoneNumber,
          failureReason: null,
        },
      });
    } else {
      // Already PENDING — update phone number
      await prisma.payment.update({
        where: { id: payment.id },
        data: { phoneNumber },
      });

    }

    // Enqueue STK Push job to BullMQ (async processing)
    const job = await paymentQueue.add(
      JOB_NAMES.STK_PUSH,
      {
        bookingId,
        paymentId: payment.id,
        phoneNumber,
        amount: booking.priceKes,
        accountReference: booking.reference,
      },
      {
        jobId: payment.id, // idempotency
        attempts: 2,
        backoff: { type: "fixed", delay: 30000 },
      },
    );

    log.info(
      {
        event: "stk_push.enqueued",
        bookingId,
        paymentId: payment.id,
        jobId: job.id,
      },
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
              services: {
                select: {
                  service: { select: { id: true, name: true } },
                },
                take: 1,
              },
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
            services: {
              select: {
                service: { select: { id: true, name: true } },
              },
              take: 1,
            },
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
};
