import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount } from "../session.js";
import { formatDateEAT, formatTime12h } from "../helpers.js";
import { log as logger } from "../../../lib/index.js";

const log = logger.child({ module: "fsm-thank-you" });

/**
 * THANK_YOU
 *
 * Final state after a booking is confirmed (either via M-Pesa or cash).
 * Sends a thank-you message with booking details and clears the session.
 *
 * Transitions:
 *  Any input → IDLE (session cleared)
 */
export async function handleThankYou(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const serviceName = ctx.session.selectedService?.name || "Nail service";
  const price = ctx.session.selectedService?.priceKes || 0;
  const dateDisplay = ctx.session.appointmentAt
    ? formatDateEAT(ctx.session.appointmentAt)
    : "";
  const timeDisplay = ctx.session.selectedTime
    ? formatTime12h(ctx.session.selectedTime)
    : "";
  const reference = ctx.session.bookingRef || "";

  const hasPaymentPhone = !!ctx.session.paymentPhone;

  const paymentLine = hasPaymentPhone
    ? `We'll send the M-Pesa payment request to ${ctx.session.paymentPhone}.`
    : "Please pay at the salon when you arrive.";

  const thankYouText = [
    "Thank you for booking with Nails by Wanny! 🎉💅",
    "",
    `📋 Reference: ${reference}`,
    `✂️ Service: ${serviceName}`,
    `📅 ${dateDisplay}`,
    `⏰ ${timeDisplay}`,
    `💰 KES ${price.toLocaleString()}`,
    "",
    paymentLine,
    "",
    "We'll send you a reminder 24 hours before your appointment. See you soon! 😊",
  ].join("\n");

  log.info(
    { event: "fsm.thank_you", phone: ctx.phone, bookingRef: reference },
    "Booking confirmed — thank you message sent",
  );

  return {
    messages: [{ type: "text", text: thankYouText }],
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
}