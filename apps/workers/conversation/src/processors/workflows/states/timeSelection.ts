import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { prisma } from "../../../lib/prisma.js";
import { formatTime12h } from "../helpers.js";
import { getAvailableSlots, getRecommendedSlots } from "@wannys-nails/core";
import type { TimePeriod } from "@wannys-nails/core";

/** Max recommended slots to show */
const MAX_RECOMMENDED_SLOTS = 10;

// Cache available time slots per session
const timeSlotsCache = new Map<
  string,
  Array<{ time: string; appointmentAt: string }>
>();

export function setTimeSlotsCache(
  key: string,
  slots: Array<{ time: string; appointmentAt: string }>,
) {
  timeSlotsCache.set(key, slots);
  setTimeout(() => timeSlotsCache.delete(key), 5 * 60 * 1000);
}

export function getTimeSlotsCache(key: string) {
  return timeSlotsCache.get(key);
}

/**
 * Build an interactive list message for recommended time slots.
 *
 * All recommended slots are shown in a single list since the recommendation
 * engine now randomises and limits the results. No pagination needed.
 */
function buildTimeListInteractive(
  serviceName: string,
  durationMinutes: number,
  slots: Array<{ time: string; appointmentAt: string }>,
): StateTransitionResult["messages"][0] {
  const rows = slots.map((s) => ({
    id: s.time,
    title: formatTime12h(s.time),
  }));

  return {
    type: "interactive_list",
    text: `📅 Available Openings (${durationMinutes}-Min Sessions)`,
    listTitle: `Pick a time for ${serviceName}`,
    listButtonText: "Choose time",
    listSections: [
      {
        title: "Available Times",
        rows,
      },
    ],
  };
}

/**
 * Build a message offering the user to choose another time period or date
 * when no slots are available in the selected period.
 */
function buildNoSlotsMessage(): StateTransitionResult["messages"] {
  return [
    {
      type: "text",
      text: "Sorry, no appointments are available during that time period. Would you like to choose another time period or a different date?",
    },
    {
      type: "interactive_list",
      text: "What would you like to do?",
      listTitle: "Choose an option",
      listButtonText: "Select option",
      listSections: [
        {
          title: "Options",
          rows: [
            {
              id: "CHANGE_PERIOD",
              title: "Choose another time period",
            },
            {
              id: "CHANGE_DATE",
              title: "Choose another date",
            },
          ],
        },
      ],
    },
  ];
}

/**
 * TIME_SELECTION
 *
 * Shows recommended time slots for the selected service, date, and time period
 * as an interactive list. Slots are randomised by the recommendation engine.
 *
 * Flow:
 *  1. Get all available slots from the Availability Engine (cached).
 *  2. Pass through the Recommendation Engine using the user's selected time period.
 *  3. If no slots in the selected period → inform user, offer to change period/date.
 *  4. If slots exist → show them in a WhatsApp Interactive List.
 *
 * Transitions:
 *  Valid time selection → BOOKING_CONFIRMATION
 *  "CHANGE_PERIOD"     → TIME_PERIOD_SELECTION (clear selectedTimePeriod)
 *  "CHANGE_DATE"       → DATE_SELECTION (clear selectedDate, selectedTimePeriod)
 *  invalid             → stay, increment invalid count
 */
export async function handleTimeSelection(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();
  const serviceId = ctx.session.selectedService?.id;
  const serviceName = ctx.session.selectedService?.name;
  const selectedDate = ctx.session.selectedDate;
  const selectedTimePeriod = ctx.session.selectedTimePeriod;
  const customerId = ctx.session.customerId || ctx.phone;

  if (!serviceId || !selectedDate) {
    return {
      messages: [
        {
          type: "text",
          text: "Let's start over. Please reply 1 to begin booking.",
        },
      ],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  // ── Handle navigation options ──

  if (input === "CHANGE_PERIOD") {
    return {
      messages: [],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        selectedTimePeriod: undefined,
      },
      nextState: "TIME_PERIOD_SELECTION",
    };
  }

  if (input === "CHANGE_DATE") {
    return {
      messages: [],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        selectedDate: undefined,
        selectedTimePeriod: undefined,
      },
      nextState: "DATE_SELECTION",
    };
  }

  // ── Get or build available slots from the Availability Engine ──

  let allSlots = getTimeSlotsCache(customerId);
  if (!allSlots) {
    try {
      const slotData = await getAvailableSlots(prisma, selectedDate, serviceId);
      allSlots = slotData.slots.filter((s) => s.available).map((s) => ({
        time: s.time,
        appointmentAt: s.appointmentAt,
      }));
      setTimeSlotsCache(customerId, allSlots);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      return {
        messages: [{ type: "text", text: message }],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }
  }

  if (allSlots.length === 0) {
    return {
      messages: [
        {
          type: "text",
          text: "Sorry, no time slots are available for this date. Please choose another date — reply 4 to go back.",
        },
      ],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  // ── Apply the Recommendation Engine ──

  // If no time period was selected (shouldn't happen in normal flow, but
  // handle gracefully), default to showing all available slots.
  let recommendedSlots: Array<{ time: string; appointmentAt: string }>;

  if (selectedTimePeriod) {
    const result = getRecommendedSlots({
      slots: allSlots,
      timePeriod: selectedTimePeriod as TimePeriod,
      maxResults: MAX_RECOMMENDED_SLOTS,
    });

    recommendedSlots = result.slots;

    // No slots in the selected period — offer alternatives
    if (recommendedSlots.length === 0) {
      return {
        messages: buildNoSlotsMessage(),
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "TIME_SELECTION",
      };
    }
  } else {
    // Fallback: no time period selected, show all available slots
    recommendedSlots = allSlots;
  }

  // ── Try to match input as a time string (e.g. "14:00") ──

  const selectedSlot = recommendedSlots.find((s) => s.time === input);

  if (!selectedSlot) {
    // Invalid input — re-send the list
    const newSession = incrementInvalidCount(ctx.session);

    return {
      messages: [
        buildTimeListInteractive(
          serviceName || "service",
          ctx.session.selectedService?.durationMinutes ?? 60,
          recommendedSlots,
        ),
      ],
      sessionUpdates: {
        ...newSession,
      },
      nextState: "TIME_SELECTION",
    };
  }

  // Valid time selected
  return {
    messages: [],
    sessionUpdates: {
      ...resetInvalidCount(ctx.session),
      selectedTime: selectedSlot.time,
      appointmentAt: selectedSlot.appointmentAt,
    },
    nextState: "BOOKING_CONFIRMATION",
  };
}