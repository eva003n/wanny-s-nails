import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount } from "../session.js";
import { formatDateEAT, formatTime12h } from "../helpers.js";
import { log as logger} from "../../../lib/index.js";

import { prisma } from "../../../lib/prisma.js";

const log = logger.child({ module: "fsm-cancel" });

/**
 * Build the cancel confirmation summary and interactive button prompt.
 */
function buildCancelConfirmationMessage(
  serviceName: string,
  dateDisplay: string,
  timeDisplay: string,
): StateTransitionResult["messages"] {
  const summaryText = [
    "Are you sure you want to cancel your appointment?",
    "",
    `✂️ ${serviceName}`,
    `📅 ${dateDisplay} at ${timeDisplay}`,
  ].join("\n");

  return [
    { type: "text" as const, text: summaryText },
    {
      type: "interactive_button" as const,
      text: "Please confirm:",
      buttonTitle: "Cancel appointment",
      buttons: [
        { id: "yes", title: "Yes, Cancel" },
        { id: "no", title: "No, Keep It" },
      ],
    },
  ];
}

/**
 * CANCEL_CONFIRMATION
 *
 * Shows the booking summary and asks YES/NO to cancel
 * via interactive buttons.
 *
 * Transitions:
 *  "1" / "yes" → Cancel booking in DB → IDLE
 *  "2" / "no"  → "Appointment still on!" → IDLE
 */
export async function handleCancelConfirmation(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim().toLowerCase();
  const bookingId = ctx.session.bookingId;
  const serviceName = ctx.session.selectedService?.name || "Nail service";
  const appointmentAt = ctx.session.appointmentAt;

  const dateDisplay = appointmentAt ? formatDateEAT(appointmentAt) : "";
  const timeDisplay = ctx.session.selectedTime
    ? formatTime12h(ctx.session.selectedTime)
    : "";

  // --- Confirm cancellation ---
  if (input === "1" || input === "yes" || /cancel it/i.test(input)) {
    if (!bookingId) {
      return {
        messages: [
          {
            type: "text",
            text: "Sorry, we couldn't find the booking to cancel. Let's start over.",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    try {
      const bookingToCancel = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      if (bookingToCancel) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: "CANCELLED",
            statusHistory: {
              create: {
                fromStatus: bookingToCancel.status,
                toStatus: "CANCELLED",
                actorType: "CUSTOMER",
                reason: "Cancelled via WhatsApp",
              },
            },
          },
        });
      }

      const cancelledText = [
        "Your appointment has been cancelled.",
        "",
        `✂️ ${serviceName}`,
        `📅 ${dateDisplay} at ${timeDisplay}`,
        "",
        "We hope to see you again soon. Book a new appointment anytime by messaging us here.",
      ].join("\n");

      return {
        messages: [{ type: "text", text: cancelledText }],
        sessionUpdates: {
          ...resetInvalidCount(ctx.session),
          bookingId: undefined,
          bookingRef: undefined,
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
        { event: "fsm.cancel.failed", error, phone: ctx.phone },
        "Failed to cancel booking",
      );
      return {
        messages: [
          {
            type: "text",
            text: "We couldn't cancel your booking. Please try again or contact us directly.",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }
  }

  // --- Keep appointment ---
  if (input === "2" || input === "no" || /keep/i.test(input)) {
    return {
      messages: [
        {
          type: "text",
          text: "Your appointment is still on! See you then. 💅",
        },
      ],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        bookingId: undefined,
        bookingRef: undefined,
        selectedService: undefined,
        selectedDate: undefined,
        selectedTime: undefined,
        appointmentAt: undefined,
        flow: undefined,
      },
      nextState: "IDLE",
    };
  }

  // --- Invalid input: resend confirmation prompt with buttons ---
  return {
    messages: buildCancelConfirmationMessage(
      serviceName,
      dateDisplay,
      timeDisplay,
    ),
    sessionUpdates: ctx.session,
    nextState: "CANCEL_CONFIRMATION",
  };
}
