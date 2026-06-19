import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount } from "../session.js";
import { bookingsService } from "../../modules/bookings/bookings.service.js";
import { formatDateEAT, formatTime12h } from "../helpers.js";
import { logger } from "../../shared/lib/logger.js";

const log = logger.child({ module: "fsm-booking-confirm" });

/**
 * Build the booking confirmation summary and interactive button prompt.
 */
function buildConfirmationMessage(
  serviceName: string,
  price: number,
  dateDisplay: string,
  timeDisplay: string,
): StateTransitionResult["messages"] {
  const summaryText = [
    "Please confirm your booking:",
    "",
    `✂️ Service: ${serviceName}`,
    `📅 Date: ${dateDisplay}`,
    `⏰ Time: ${timeDisplay}`,
    `💰 Price: KES ${price.toLocaleString()}`,
  ].join("\n");

  return [
    { type: "text" as const, text: summaryText },
    {
      type: "interactive_button" as const,
      text: "Does everything look good?",
      buttonTitle: "Confirm booking",
      buttons: [
        { id: "yes", title: "Yes, Confirm" },
        { id: "no", title: "No, Start Over" },
      ],
    },
  ];
}

/**
 * BOOKING_CONFIRMATION
 *
 * Shows a summary of the booking and asks for YES/NO confirmation
 * via interactive buttons.
 *
 * Transitions:
 *  "yes" / "YES" / "y" / "1" → Create PENDING booking → AWAITING_PAYMENT_PHONE
 *  "no"  / "NO"  / "n" / "2" → Clear session, restart → GREETING
 */
export async function handleBookingConfirmation(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim().toLowerCase();

  // --- Confirm booking ---
  if (input === "yes" || input === "y" || input === "1") {
    const customerId = ctx.session.customerId;
    const serviceId = ctx.session.selectedService?.id;
    const appointmentAt = ctx.session.appointmentAt;

    if (!customerId || !serviceId || !appointmentAt) {
      log.error({ event: "fsm.booking.missing_data", phone: ctx.phone }, "Missing session data for booking confirmation");
      return {
        messages: [{ type: "text", text: "Sorry, something went wrong. Let's start over." }],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    try {
      const booking = await bookingsService.create({
        customerId,
        serviceId,
        appointmentAt,
      });

      const serviceName = ctx.session.selectedService?.name || "Nail service";
      const price = ctx.session.selectedService?.priceKes || 0;
      const dateDisplay = formatDateEAT(appointmentAt);
      const timeDisplay = ctx.session.selectedTime ? formatTime12h(ctx.session.selectedTime) : "";

      const confirmationText = [
        "Your booking has been received! 🎉",
        "",
        `📋 Reference: ${booking.reference}`,
        `✂️ Service: ${serviceName}`,
        `📅 ${dateDisplay}`,
        `⏰ ${timeDisplay}`,
        `💰 KES ${price.toLocaleString()}`,
        "",
        `To secure your slot, please pay KES ${price.toLocaleString()} via M-Pesa.`,
        "What M-Pesa number should we send the payment request to?",
        "(e.g., 0712 345 678)",
      ].join("\n");

      return {
        messages: [{ type: "text", text: confirmationText }],
        sessionUpdates: {
          ...resetInvalidCount(ctx.session),
          bookingId: booking.id,
          bookingRef: booking.reference,
        },
        nextState: "AWAITING_PAYMENT_PHONE",
      };
    } catch (error) {
      log.error({ event: "fsm.booking.create_failed", error, phone: ctx.phone }, "Failed to create booking");

      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      let userMessage = "Sorry, we couldn't create your booking. The time slot may have been taken.";

      if (errorMsg.includes("Slot") || errorMsg.includes("Conflict")) {
        userMessage = "Sorry, that time slot was just taken. Please select a different time.";
      }

      return {
        messages: [{ type: "text", text: userMessage }],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }
  }

  // --- Decline booking ---
  if (input === "no" || input === "n" || input === "2") {
    return {
      messages: [{ type: "text", text: "OK, let's start over. 😊" }],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        selectedService: undefined,
        selectedDate: undefined,
        selectedTime: undefined,
        appointmentAt: undefined,
      },
      nextState: "GREETING",
    };
  }

  // --- Invalid input — resend the confirmation with buttons ---
  const serviceName = ctx.session.selectedService?.name || "Nail service";
  const price = ctx.session.selectedService?.priceKes || 0;
  const dateDisplay = ctx.session.appointmentAt ? formatDateEAT(ctx.session.appointmentAt) : "";
  const timeDisplay = ctx.session.selectedTime ? formatTime12h(ctx.session.selectedTime) : "";

  return {
    messages: buildConfirmationMessage(serviceName, price, dateDisplay, timeDisplay),
    sessionUpdates: ctx.session,
    nextState: "BOOKING_CONFIRMATION",
  };
}