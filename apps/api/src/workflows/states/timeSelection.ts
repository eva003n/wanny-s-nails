import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { slotsService } from "../../modules/slots/slots.service.js";
import { formatTime12h } from "../helpers.js";

/** WhatsApp interactive list max rows */
const MAX_LIST_ROWS = 10;

// Cache available time slots per session
const timeSlotsCache = new Map<string, Array<{ time: string; appointmentAt: string; available: boolean }>>();

export function setTimeSlotsCache(key: string, slots: Array<{ time: string; appointmentAt: string; available: boolean }>) {
  timeSlotsCache.set(key, slots);
  setTimeout(() => timeSlotsCache.delete(key), 5 * 60 * 1000);
}

export function getTimeSlotsCache(key: string) {
  return timeSlotsCache.get(key);
}

/**
 * Build the time selection message.
 * Uses interactive list when slots fit within WhatsApp's 10-row limit,
 * otherwise falls back to a text-based numbered list.
 */
function buildTimeListMessage(
  serviceName: string,
  selectedDate: string,
  slots: Array<{ time: string }>,
): StateTransitionResult["messages"][0] {
  if (slots.length <= MAX_LIST_ROWS) {
    return {
      type: "interactive_list",
      text: `Available times for ${serviceName} on ${selectedDate}:`,
      listTitle: "Pick a Time",
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

  // Too many slots for an interactive list — send a numbered text message
  const lines = slots.map((s, i) => `${i + 1}. ${formatTime12h(s.time)}`);
  return {
    type: "text",
    text: `Available times for ${serviceName} on ${selectedDate}:\n\n${lines.join("\n")}\n\nReply with a number to pick a time.`,
  };
}

/**
 * TIME_SELECTION
 *
 * Shows available time slots for the selected service and date.
 * User picks a time by tapping a row.
 *
 * Transitions:
 *  Valid number   → BOOKING_CONFIRMATION (save selected time + computed appointmentAt)
 *  invalid        → stay, increment count
 */
export async function handleTimeSelection(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();
  const serviceId = ctx.session.selectedService?.id;
  const serviceName = ctx.session.selectedService?.name;
  const selectedDate = ctx.session.selectedDate;
  const customerId = ctx.session.customerId || ctx.phone;

  if (!serviceId || !selectedDate) {
    return {
      messages: [{ type: "text", text: "Let's start over. Please reply 1 to begin booking." }],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  // Get or build available slots
  let slots = getTimeSlotsCache(customerId);
  if (!slots) {
    const slotData = await slotsService.getAvailableSlots(selectedDate, serviceId);
    slots = slotData.slots.filter((s) => s.available);
    setTimeSlotsCache(customerId, slots);
  }

  if (slots.length === 0) {
    return {
      messages: [{ type: "text", text: "Sorry, no time slots are available for this date. Please choose another date — reply 4 to go back." }],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  const selectedIndex = parseInt(input, 10);

  if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > slots.length) {
    const newSession = incrementInvalidCount(ctx.session);

    return {
      messages: [buildTimeListMessage(serviceName || "service", selectedDate, slots)],
      sessionUpdates: newSession,
      nextState: "TIME_SELECTION",
    };
  }

  const selected = slots[selectedIndex - 1]!;

  return {
    messages: [],
    sessionUpdates: {
      ...resetInvalidCount(ctx.session),
      selectedTime: selected.time,
      appointmentAt: selected.appointmentAt,
    },
    nextState: "BOOKING_CONFIRMATION",
  };
}