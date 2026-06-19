import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { paymentsService } from "../../modules/payments/payments.service.js";
import { bookingsService } from "../../modules/bookings/bookings.service.js";
import { logger } from "../../shared/lib/logger.js";

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
        messages: [{ type: "text", text: "Sorry, something went wrong. Let's start over." }],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    try {
      await paymentsService.initiateStkPush(bookingId, phone);
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
      log.error({ event: "fsm.payment.retry.failed", error, phone: ctx.phone }, "Failed to retry STK Push");
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
        messages: [{ type: "text", text: "Sorry, something went wrong. Let's start over." }],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    try {
      await bookingsService.cancel(bookingId, "CUSTOMER", "Cancelled during payment via WhatsApp");
      return {
        messages: [{ type: "text", text: "Your booking has been cancelled. If you'd like to book again, just say hi! 😊" }],
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
      log.error({ event: "fsm.payment.cancel.failed", error, phone: ctx.phone }, "Failed to cancel booking");
      return {
        messages: [{ type: "text", text: "We couldn't cancel the booking. Please try again or contact us directly." }],
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