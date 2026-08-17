import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { log as logger, paymentQueue } from "../../../lib/index.js";

import { prisma } from "../../../lib/prisma.js";
import { JOB_NAMES } from "@wannys-nails/core";

const log = logger.child({ module: "fsm-awaiting-payment" });

/**
 * AWAITING_PAYMENT
 *
 * Customer has been sent an STK Push and is waiting for the Daraja callback.
 * While in this state, customer can:
 *  "1" / "retry"  → Send a new STK Push
 *  "2" / "cancel" → Cancel the PENDING booking
 *
 * The Daraja callback asynchronously transitions this state via the payment callback.
 *
 * Transitions (customer input):
 *  "1" / "retry"  → Re-initiate STK Push, stay in AWAITING_PAYMENT
 *  "2" / "cancel" → Cancel booking → IDLE
 */

 async function initiateStkPush(bookingId: string, phoneNumber: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status !== "APPROVED") {
      throw new Error("Booking must be in APPROVED status to initiate payment");
    }

    if (booking.payment?.status === "SUCCESS" || booking.payment?.status === "REFUNDED") {
      throw new Error("Booking already has a completed payment");
    }

    // Ensure payment record exists
    let payment = booking.payment;
    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          bookingId,
          amountKes: booking.priceKes,
          status: "PENDING",
        },
      });
    } else if (booking.payment && ["FAILED", "CANCELLED", "EXPIRED"].includes(booking.payment.status)) {
      // Reset for retry
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PENDING", phoneNumber, checkoutRequestId: null, failureReason: null },
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
  }

export async function handleAwaitingPayment(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim().toLowerCase();

  // --- Retry payment ---
  if (input === "1" || /retry/i.test(input)) {
    const bookingId = ctx.session.bookingId;
    const phone = ctx.session.paymentPhone;

    if (!bookingId || !phone) {
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
      await initiateStkPush(bookingId, phone);
      return {
        messages: [
          {
            type: "text",
            text: "We've sent a new payment request. Please check your phone and enter your M-Pesa PIN. 📲\n\nThis request will expire in 5 minutes.",
          },
        ],
        sessionUpdates: ctx.session,
        nextState: "AWAITING_PAYMENT",
      };
    } catch (error) {
      log.error(
        { event: "fsm.payment.retry.failed", error, phone: ctx.phone },
        "Failed to retry STK Push",
      );
      return {
        messages: [
          {
            type: "text",
            text: "We couldn't send a new payment request.",
          },
          {
            type: "interactive_button",
            text: "What would you like to do?",
            buttonTitle: "Choose an option",
            buttons: [
              { id: "1", title: "Try Again" },
              { id: "2", title: "Cancel Booking" },
            ],
          },
        ],
        sessionUpdates: incrementInvalidCount(ctx.session),
        nextState: "AWAITING_PAYMENT",
      };
    }
  }

  // --- Cancel booking ---
  if (input === "2" || /cancel/i.test(input)) {
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
      const payBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      if (payBooking) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: "CANCELLED",
            statusHistory: {
              create: {
                fromStatus: payBooking.status,
                toStatus: "CANCELLED",
                actorType: "CUSTOMER",
                reason: "Cancelled during payment via WhatsApp",
              },
            },
          },
        });
      }
      return {
        messages: [
          {
            type: "text",
            text: "Your booking has been cancelled. If you'd like to book again, just say hi! 😊",
          },
        ],
        sessionUpdates: {
          ...resetInvalidCount(ctx.session),
          bookingId: undefined,
          bookingRef: undefined,
          paymentPhone: undefined,
          selectedService: undefined,
          selectedDate: undefined,
          selectedTime: undefined,
          appointmentAt: undefined,
          flow: undefined,
        },
        nextState: "IDLE",
      };
    } catch (error) {
      log.error(
        { event: "fsm.payment.cancel.failed", error, phone: ctx.phone },
        "Failed to cancel booking",
      );
      return {
        messages: [
          {
            type: "text",
            text: "We couldn't cancel the booking. Please try again or contact us directly.",
          },
        ],
        sessionUpdates: incrementInvalidCount(ctx.session),
        nextState: "AWAITING_PAYMENT",
      };
    }
  }

  // --- Any other input: remind them about the payment with buttons ---
  const price = ctx.session.selectedService?.priceKes || 0;
  return {
    messages: [
      {
        type: "text",
        text: `We're waiting for your payment of KES ${price.toLocaleString()}.\n\nPlease check your phone for the M-Pesa prompt.`,
      },
      {
        type: "interactive_button",
        text: "What would you like to do?",
        buttonTitle: "Choose an option",
        buttons: [
          { id: "1", title: "Resend Request" },
          { id: "2", title: "Cancel Booking" },
        ],
      },
    ],
    sessionUpdates: ctx.session,
    nextState: "AWAITING_PAYMENT",
  };
}
