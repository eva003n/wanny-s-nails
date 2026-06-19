import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { parsePhoneToE164, formatTime12h, formatDateEAT } from "../helpers.js";
import { paymentsService } from "../../modules/payments/payments.service.js";
import { logger } from "../../shared/lib/logger.js";

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
      messages: [{ type: "text", text: "Sorry, something went wrong. Let's start over." }],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  try {
    // First, approve the booking so the payment can be initiated
    // (bookings are created as PENDING; payment requires APPROVED)
    const booking = await paymentsService.getByBookingId(bookingId);
    if (booking && booking.status !== "PAID" && booking.status !== "PAYMENT_PENDING") {
      // We need the booking to be approved first
      // Use the booking service to approve it
      const { prisma } = await import("../../shared/lib/prisma.js");
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

    const result = await paymentsService.initiateStkPush(bookingId, phone);

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
    log.error({ event: "fsm.stk_push.failed", error, phone: ctx.phone }, "Failed to initiate STK Push");
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