import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { findActiveBooking } from "../helpers.js";
import { formatDateEAT, formatTime12h } from "../helpers.js";

/**
 * Build the main menu interactive list message.
 */
function buildMainMenuMessage(
  name: string,
): StateTransitionResult["messages"][0] {
  const greeting =
    name === "there"
      ? "Hi there! 👋 Welcome to Wanny's Nails."
      : `Hi ${name}! 👋 Welcome to Wanny's Nails.`;

  return {
    type: "interactive_list",
    text: `${greeting}\nHow can we help you today?`,
    listTitle: "Wanny's Nails 💅",
    listButtonText: "Choose an option",
    listSections: [
      {
        title: "Appointments",
        rows: [
          {
            id: "1",
            title: "Book Appointment",
            description: "Schedule a new appointment",
          },
          {
            id: "2",
            title: "View Appointment",
            description: "Check your upcoming appointment",
          },
          {
            id: "3",
            title: "Reschedule",
            description: "Change your appointment date or time",
          },
          {
            id: "4",
            title: "Cancel",
            description: "Cancel an existing appointment",
          },
        ],
      },
    ],
  };
}

/**
 * GREETING
 *
 * Displays the main menu with 4 options:
 *  1. Book an appointment
 *  2. View my upcoming appointment
 *  3. Cancel my appointment
 *  4. Reschedule my appointment
 *
 * Transitions:
 *  "1" / "book"     → CATEGORY_SELECTION
 *  "2" / "view"     → LOOKUP (inline)
 *  "3" / "cancel"   → CANCEL_CONFIRMATION (if active booking exists)
 *  "4" / "reschedule" → RESCHEDULE_DATE (if active booking exists)
 *  invalid           → stay in GREETING, increment count
 */
export async function handleGreeting(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();
  const name = ctx.session.customerName || "there";

  // --- Option 1: Book ---
  if (input === "1" || /book/i.test(input)) {
    return {
      messages: [],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        flow: "BOOKING",
      },
      nextState: "CATEGORY_SELECTION",
    };
  }

  // --- Option 2: View appointment (LOOKUP) ---
  if (input === "2" || /view|upcoming/i.test(input)) {
    if (!ctx.session.customerId) {
      return {
        messages: [
          {
            type: "text",
            text: "I couldn't find your account. Let's start by booking an appointment — reply 1.",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    const booking = await findActiveBooking(ctx.session.customerId);
    if (!booking) {
      return {
        messages: [
          {
            type: "text",
            text: "You don't have any upcoming appointments. Would you like to book one? Reply 1.",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    const service = booking.service;
    const dateStr = booking.appointmentAt.toISOString();
    const eatDate = new Date(
      booking.appointmentAt.getTime() + 3 * 60 * 60 * 1000,
    );
    const timeStr = `${String(eatDate.getUTCHours()).padStart(2, "0")}:${String(eatDate.getUTCMinutes()).padStart(2, "0")}`;
    const eatFormatted = eatDate.toLocaleDateString("en-KE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const period = eatDate.getUTCHours() >= 12 ? "PM" : "AM";
    const hours12 = eatDate.getUTCHours() % 12 || 12;
    const timeDisplay = `${hours12}:${String(eatDate.getUTCMinutes()).padStart(2, "0")} ${period}`;

    const statusEmoji =
      booking.status === "APPROVED"
        ? "✅"
        : booking.status === "PENDING"
          ? "⏳"
          : "📋";

    const text = [
      `Here's your upcoming appointment ${name}! 👇`,
      "",
      `${statusEmoji} Status: ${booking.status}`,
      `✂️ Service: ${service.name}`,
      `📅 ${eatFormatted}`,
      `⏰ ${timeDisplay}`,
      `💰 KES ${booking.priceKes.toLocaleString()}`,
      `📋 Ref: ${booking.reference}`,
    ].join("\n");

    return {
      messages: [
        { type: "text", text },
        {
          type: "interactive_button",
          text: "What would you like to do?",
          buttonTitle: "Manage booking",
          buttons: [
            { id: "3", title: "Cancel" },
            { id: "4", title: "Reschedule" },
          ],
        },
      ],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        bookingId: booking.id,
        bookingRef: booking.reference,
        selectedService: {
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          priceKes: service.priceKes,
        },
        selectedDate: dateStr.split("T")[0] ?? "",
        selectedTime: timeStr,
        appointmentAt: booking.appointmentAt.toISOString(),
      },
      nextState: "GREETING",
    };
  }

  // --- Option 3: Cancel ---
  if (input === "3" || /cancel/i.test(input)) {
    if (!ctx.session.customerId) {
      return {
        messages: [
          {
            type: "text",
            text: "I couldn't find your account. Let's start by booking an appointment — reply 1.",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    const booking = await findActiveBooking(ctx.session.customerId);
    if (!booking) {
      return {
        messages: [
          {
            type: "text",
            text: "You don't have any active appointments to cancel.",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    // Store booking info for cancel confirmation
    return {
      messages: [],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        flow: "CANCEL",
        bookingId: booking.id,
        bookingRef: booking.reference,
        selectedService: {
          id: booking.service.id,
          name: booking.service.name,
          durationMinutes: booking.service.durationMinutes,
          priceKes: booking.service.priceKes,
        },
        appointmentAt: booking.appointmentAt.toISOString(),
      },
      nextState: "CANCEL_CONFIRMATION",
    };
  }

  // --- Option 4: Reschedule ---
  if (input === "4" || /reschedule/i.test(input)) {
    if (!ctx.session.customerId) {
      return {
        messages: [
          {
            type: "text",
            text: "I couldn't find your account. Let's start by booking an appointment — reply 1.",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    const booking = await findActiveBooking(ctx.session.customerId);
    if (!booking) {
      return {
        messages: [
          {
            type: "text",
            text: "You don't have any active appointments to reschedule.",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    return {
      messages: [],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        flow: "RESCHEDULE",
        bookingId: booking.id,
        bookingRef: booking.reference,
        selectedService: {
          id: booking.service.id,
          name: booking.service.name,
          durationMinutes: booking.service.durationMinutes,
          priceKes: booking.service.priceKes,
        },
        appointmentAt: booking.appointmentAt.toISOString(),
      },
      nextState: "RESCHEDULE_DATE",
    };
  }

  // --- Invalid input ---
  const newSession = incrementInvalidCount(ctx.session);
  return {
    messages: [buildMainMenuMessage(name)],
    sessionUpdates: newSession,
    nextState: "GREETING",
  };
}

export { buildMainMenuMessage };
