import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { parsePhoneToE164, formatTime12h, formatDateEAT } from "../helpers.js";
import { log as logger, paymentQueue } from "../../../lib/index.js";

import { prisma } from "../../../lib/prisma.js";

const log = logger.child({ module: "fsm-payment-phone" });

/**
 * AWAITING_PAYMENT_PHONE
 *
 * Customer provides M-Pesa phone number for STK Push.
 *
 * Transitions:
 *  Valid Kenyan phone → Enqueue STK Push → AWAITING_PAYMENT
 *  invalid            → resend prompt
 */
export async function handleAwaitingPaymentPhone(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();
  const phone = parsePhoneToE164(input);

  if (!phone) {
    const newSession = incrementInvalidCount(ctx.session);
    return {
      messages: [
        {
          type: "text",
          text: "That doesn't look like a valid number. Please try again (e.g., 0712 345 678)",
        },
      ],
      sessionUpdates: newSession,
      nextState: "AWAITING_PAYMENT_PHONE",
    };
  }

  // Initiate STK Push
  const bookingId = ctx.session.bookingId;
  if (!bookingId) {
    return {
      messages: [
        {
          type: "text",
          text: "Sorry, something went wrong. Let's start over.",
        },
      ],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  try {
    // Approve the booking so the payment can be initiated
    const existingBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!existingBooking) {
      throw new Error("Booking not found");
    }

    // Approve PENDING booking
    if (existingBooking.status === "PENDING") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "APPROVED",
          statusHistory: {
            create: {
              fromStatus: "PENDING",
              toStatus: "APPROVED",
              actorType: "SYSTEM",
            },
          },
        },
      });
    }

    // Initiate STK Push logic (recreate paymentsService.initiateStkPush)
    const refreshedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!refreshedBooking) {
      throw new Error("Booking not found");
    }

    if (refreshedBooking.status !== "APPROVED") {
      throw new Error("Booking must be in APPROVED status to initiate payment");
    }

    if (refreshedBooking.payment?.status === "SUCCESS" || refreshedBooking.payment?.status === "REFUNDED") {
      throw new Error("Booking already has a completed payment");
    }

    // Ensure payment record exists
    let payment = refreshedBooking.payment;
    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          bookingId,
          amountKes: refreshedBooking.priceKes,
          status: "PENDING",
        },
      });
    } else if (
      refreshedBooking.payment &&
      ["FAILED", "CANCELLED", "EXPIRED"].includes(
        refreshedBooking.payment.status,
      )
    ) {
      // Reset for retry
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PENDING",
          phoneNumber: phone,
          checkoutRequestId: null,
          failureReason: null,
        },
      });
    } else {
      // Already PENDING — update phone number
      await prisma.payment.update({
        where: { id: payment.id },
        data: { phoneNumber: phone },
      });
    }

    // Enqueue STK Push job
    await paymentQueue.add(
      "stk-push",
      {
        bookingId,
        paymentId: payment.id,
        phoneNumber: phone,
        amount: refreshedBooking.priceKes,
        accountReference: refreshedBooking.reference,
      },
      {
        attempts: 2,
        backoff: { type: "fixed", delay: 30000 },
      },
    );

    log.info(
      { event: "stk_push.enqueued", bookingId, paymentId: payment.id },
      "STK Push job enqueued",
    );

    const price = ctx.session.selectedService?.priceKes || 0;
    const reference = ctx.session.bookingRef || "";

    const paymentText = [
      "We've sent an M-Pesa payment request to help secure your booking.",
      "",
      `📋 Reference: ${reference}`,
      `💰 Amount: KES ${price.toLocaleString()}`,
      `📱 Sent to: ${phone}`,
      "",
      "Please check your phone and enter your M-Pesa PIN to confirm. 📲",
      "",
      "This request will expire in 5 minutes.",
    ].join("\n");

    return {
      messages: [{ type: "text", text: paymentText }],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        paymentPhone: phone,
      },
      nextState: "AWAITING_PAYMENT",
    };
  } catch (error) {
    log.error(
      { event: "fsm.stk_push.failed", error, phone: ctx.phone },
      "Failed to initiate STK Push",
    );
    return {
      messages: [
        {
          type: "text",
          text: "We couldn't send the payment request. Please try again or reply 2 to cancel the booking.",
        },
      ],
      sessionUpdates: incrementInvalidCount(ctx.session),
      nextState: "AWAITING_PAYMENT_PHONE",
    };
  }
}
