import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { buildDateOptions, formatDateEAT, formatTime12h } from "../helpers.js";
import { prisma, logger } from "@wannys-nails/packages";

const log = logger.child({ module: "fsm-reschedule" });

/**
 * Build the reschedule date selection interactive list message.
 */
function buildRescheduleDateListMessage(
  serviceName: string,
  options: Awaited<ReturnType<typeof buildDateOptions>>,
): StateTransitionResult["messages"][0] {
  return {
    type: "interactive_list",
    text: `When would you like to reschedule your ${serviceName}?`,
    listTitle: "Pick a New Date",
    listButtonText: "Choose a date",
    listSections: [
      {
        title: "Available Dates",
        rows: options.map((opt, i) => ({
          id: String(i + 1),
          title: opt.label,
          description: opt.isFull
            ? "Fully booked"
            : `${opt.availableSlots} slot${opt.availableSlots !== 1 ? "s" : ""} available`,
        })),
      },
    ],
  };
}

/**
 * Build the reschedule time selection interactive list message.
 */
function buildRescheduleTimeListMessage(
  serviceName: string,
  selectedDate: string,
  slots: Array<{ time: string }>,
): StateTransitionResult["messages"][0] {
  return {
    type: "interactive_list",
    text: `Available times for ${serviceName} on ${selectedDate}:`,
    listTitle: "Pick a New Time",
    listButtonText: "Choose a time",
    listSections: [
      {
        title: "Available Times",
        rows: slots.map((s, i) => ({
          id: String(i + 1),
          title: formatTime12h(s.time),
        })),
      },
    ],
  };
}

/**
 * Build the reschedule confirmation interactive button prompt.
 */
function buildRescheduleConfirmationMessage(
  serviceName: string,
  dateDisplay: string,
  timeDisplay: string,
): StateTransitionResult["messages"] {
  const summaryText = [
    "Please confirm your new appointment time:",
    "",
    `✂️ Service: ${serviceName}`,
    `📅 Date: ${dateDisplay}`,
    `⏰ Time: ${timeDisplay}`,
  ].join("\n");

  return [
    { type: "text" as const, text: summaryText },
    {
      type: "interactive_button" as const,
      text: "Does everything look good?",
      buttonTitle: "Confirm reschedule",
      buttons: [
        { id: "yes", title: "Yes, Reschedule" },
        { id: "no", title: "No, Cancel" },
      ],
    },
  ];
}

// ─── RESCHEDULE_DATE ───

/**
 * RESCHEDULE_DATE
 *
 * Presents available dates for rescheduling the existing booking.
 * User picks a new date by tapping a row.
 *
 * Transitions:
 *  Valid number → RESCHEDULE_TIME (save new date)
 *  invalid      → stay, increment count
 */
export async function handleRescheduleDate(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();
  const serviceId = ctx.session.selectedService?.id;
  const serviceName = ctx.session.selectedService?.name;

  if (!serviceId) {
    return {
      messages: [
        { type: "text", text: "Let's start over. Please reply 1 to begin." },
      ],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  // Build date options
  const options = await buildDateOptions(serviceId);

  if (options.length === 0) {
    return {
      messages: [
        {
          type: "text",
          text: "Sorry, there are no available dates in the next two weeks. Please try again later.",
        },
      ],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  const selectedIndex = parseInt(input, 10);

  if (
    isNaN(selectedIndex) ||
    selectedIndex < 1 ||
    selectedIndex > options.length
  ) {
    const newSession = incrementInvalidCount(ctx.session);

    return {
      messages: [
        buildRescheduleDateListMessage(serviceName || "service", options),
      ],
      sessionUpdates: newSession,
      nextState: "RESCHEDULE_DATE",
    };
  }

  const selected = options[selectedIndex - 1]!;

  if (selected.isFull) {
    const newSession = incrementInvalidCount(ctx.session);
    return {
      messages: [
        {
          type: "text",
          text: "That day is fully booked. Please choose another date.",
        },
      ],
      sessionUpdates: newSession,
      nextState: "RESCHEDULE_DATE",
    };
  }

  return {
    messages: [],
    sessionUpdates: {
      ...resetInvalidCount(ctx.session),
      selectedDate: selected.date,
    },
    nextState: "RESCHEDULE_TIME",
  };
}

// ─── RESCHEDULE_TIME ───

/**
 * RESCHEDULE_TIME
 *
 * Shows available time slots for the new date.
 * User picks a time by tapping a row.
 *
 * Transitions:
 *  Valid number → RESCHEDULE_CONFIRMATION
 *  invalid      → stay, increment count
 */
export async function handleRescheduleTime(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();
  const serviceId = ctx.session.selectedService?.id;
  const serviceName = ctx.session.selectedService?.name;
  const selectedDate = ctx.session.selectedDate;

  if (!serviceId || !selectedDate) {
    return {
      messages: [
        { type: "text", text: "Let's start over. Please reply 1 to begin." },
      ],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  // Recreate slotsService.getAvailableSlots logic inline
  const targetSlotsDate = new Date(selectedDate + "T00:00:00.000Z");
  const slotsDayOfWeek = targetSlotsDate.getDay();
  const bh = await prisma.businessHours.findUnique({
    where: { dayOfWeek: slotsDayOfWeek },
  });
  if (!bh || !bh.isActive) {
    return {
      messages: [{ type: "text", text: "The salon is closed on the selected date." }],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "RESCHEDULE_DATE",
    };
  }

  const srv = await prisma.nailService.findUnique({
    where: { id: serviceId },
  });
  if (!srv) {
    return {
      messages: [{ type: "text", text: "Service not found." }],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "RESCHEDULE_DATE",
    };
  }

  const srvDuration = srv.durationMinutes;
  const srvOpenParts = bh.openTime.split(":");
  const srvCloseParts = bh.closeTime.split(":");
  const srvOpenHour = Number(srvOpenParts[0]);
  const srvOpenMin = Number(srvOpenParts[1]);
  const srvCloseHour = Number(srvCloseParts[0]);
  const srvCloseMin = Number(srvCloseParts[1]);

  const srvDayStart = new Date(targetSlotsDate);
  srvDayStart.setHours(srvOpenHour, srvOpenMin, 0, 0);
  const srvDayEnd = new Date(targetSlotsDate);
  srvDayEnd.setHours(srvCloseHour, srvCloseMin, 0, 0);

  const existingBookings = await prisma.booking.findMany({
    where: {
      appointmentAt: { gte: srvDayStart, lt: srvDayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { appointmentAt: true, durationMinutes: true },
  });

  const generatedSlots: Array<{ time: string; appointmentAt: string; available: boolean }> = [];
  const slotCurrent = new Date(srvDayStart);
  while (slotCurrent.getTime() + srvDuration * 60 * 1000 <= srvDayEnd.getTime()) {
    const slotEnd = new Date(slotCurrent.getTime() + srvDuration * 60 * 1000);
    const isAvail = !existingBookings.some((b: any) => {
      const bStart = new Date(b.appointmentAt).getTime();
      const bEnd = bStart + b.durationMinutes * 60 * 1000;
      return slotCurrent.getTime() < bEnd && slotEnd.getTime() > bStart;
    });
    const eatHour = (slotCurrent.getUTCHours() + 3) % 24;
    const eatMin = slotCurrent.getUTCMinutes();
    const timeStr = `${String(eatHour).padStart(2, "0")}:${String(eatMin).padStart(2, "0")}`;
    generatedSlots.push({ time: timeStr, available: isAvail, appointmentAt: slotCurrent.toISOString() });
    slotCurrent.setMinutes(slotCurrent.getMinutes() + srvDuration);
  }

  const availableSlots = generatedSlots.filter((s) => s.available);

  if (availableSlots.length === 0) {
    return {
      messages: [
        {
          type: "text",
          text: "Sorry, no time slots are available for this date. Please choose another date.",
        },
      ],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "RESCHEDULE_DATE",
    };
  }

  const selectedIndex = parseInt(input, 10);

  if (
    isNaN(selectedIndex) ||
    selectedIndex < 1 ||
    selectedIndex > availableSlots.length
  ) {
    const newSession = incrementInvalidCount(ctx.session);

    return {
      messages: [
        buildRescheduleTimeListMessage(
          serviceName || "service",
          selectedDate,
          availableSlots,
        ),
      ],
      sessionUpdates: newSession,
      nextState: "RESCHEDULE_TIME",
    };
  }

  const selected = availableSlots[selectedIndex - 1]!;

  return {
    messages: [],
    sessionUpdates: {
      ...resetInvalidCount(ctx.session),
      selectedTime: selected.time,
      appointmentAt: selected.appointmentAt,
    },
    nextState: "RESCHEDULE_CONFIRMATION",
  };
}

// ─── RESCHEDULE_CONFIRMATION ───

/**
 * RESCHEDULE_CONFIRMATION
 *
 * Shows the new date/time summary and asks YES/NO to confirm reschedule
 * via interactive buttons.
 *
 * Transitions:
 *  "yes" → Reschedule booking in DB → IDLE
 *  "no"  → Clear context, back to GREETING
 */
export async function handleRescheduleConfirmation(
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

  // --- Confirm reschedule ---
  if (input === "yes" || input === "y" || input === "1") {
    if (!bookingId || !appointmentAt) {
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
      const bookingToReschedule = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      if (bookingToReschedule) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            appointmentAt: new Date(appointmentAt),
            status: "RESCHEDULED",
            statusHistory: {
              create: {
                fromStatus: bookingToReschedule.status,
                toStatus: "RESCHEDULED",
                actorType: "USER",
                reason: "Rescheduled via WhatsApp",
              },
            },
          },
        });
      }

      const confirmText = [
        "Your appointment has been rescheduled! ✅",
        "",
        `✂️ Service: ${serviceName}`,
        `📅 ${dateDisplay}`,
        `⏰ ${timeDisplay}`,
        "",
        "See you then! 💅",
      ].join("\n");

      return {
        messages: [{ type: "text", text: confirmText }],
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
        { event: "fsm.reschedule.failed", error, phone: ctx.phone },
        "Failed to reschedule booking",
      );
      return {
        messages: [
          {
            type: "text",
            text: "We couldn't reschedule your booking. The new time slot may have been taken. Please try again.",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }
  }

  // --- Decline reschedule ---
  if (input === "no" || input === "n" || input === "2") {
    return {
      messages: [
        {
          type: "text",
          text: "Reschedule cancelled. Your original appointment remains unchanged. 💅",
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

  // --- Invalid input — resend the confirmation with buttons ---
  return {
    messages: buildRescheduleConfirmationMessage(
      serviceName,
      dateDisplay,
      timeDisplay,
    ),
    sessionUpdates: ctx.session,
    nextState: "RESCHEDULE_CONFIRMATION",
  };
}
