import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { buildDateOptions } from "../helpers.js";

// Store date options in the session context so we can reference them
// when the user replies. We use a module-level cache keyed by customerId.
const dateOptionsCache = new Map<string, Awaited<ReturnType<typeof buildDateOptions>>>();

export async function getDateOptions(customerId: string) {
  return dateOptionsCache.get(customerId);
}

export async function setDateOptions(customerId: string, options: Awaited<ReturnType<typeof buildDateOptions>>) {
  dateOptionsCache.set(customerId, options);
  // Auto-expire after 5 minutes
  setTimeout(() => dateOptionsCache.delete(customerId), 5 * 60 * 1000);
}

/**
 * Build the date selection interactive list message.
 */
function buildDateListMessage(
  serviceName: string,
  options: Awaited<ReturnType<typeof buildDateOptions>>,
): StateTransitionResult["messages"][0] {
  return {
    type: "interactive_list",
    text: `When would you like your ${serviceName}?`,
    listTitle: "Pick a Date",
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
 * DATE_SELECTION
 *
 * Presents the next 7 business days with slot availability.
 * Fully booked days shown as "Full" (not selectable).
 * Closed days are omitted.
 *
 * Transitions:
 *  Valid number for an available date → TIME_SELECTION
 *  Number for a full date            → "That day is fully booked"
 *  invalid                           → stay, increment count
 */
export async function handleDateSelection(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();
  const serviceId = ctx.session.selectedService?.id;
  const serviceName = ctx.session.selectedService?.name;

  if (!serviceId) {
    // Shouldn't happen — recover by going back to service selection
    return {
      messages: [{ type: "text", text: "Let's start over with the service selection." }],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "SERVICE_SELECTION",
    };
  }

  // Build or load cached date options
  let options = await getDateOptions(ctx.session.customerId || ctx.phone);
  if (!options || options.length === 0) {
    options = await buildDateOptions(serviceId);
    if (ctx.session.customerId) {
      await setDateOptions(ctx.session.customerId, options);
    }
  }

  if (options.length === 0) {
    return {
      messages: [{ type: "text", text: "Sorry, there are no available dates in the next two weeks. Please try again later." }],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "GREETING",
    };
  }

  const selectedIndex = parseInt(input, 10);

  if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > options.length) {
    const newSession = incrementInvalidCount(ctx.session);

    return {
      messages: [buildDateListMessage(serviceName || "service", options)],
      sessionUpdates: newSession,
      nextState: "DATE_SELECTION",
    };
  }

  const selected = options[selectedIndex - 1]!;

  // Check if selected date is full
  if (selected.isFull) {
    const newSession = incrementInvalidCount(ctx.session);
    return {
      messages: [{ type: "text", text: "That day is fully booked. Please choose another date." }],
      sessionUpdates: newSession,
      nextState: "DATE_SELECTION",
    };
  }

  return {
    messages: [],
    sessionUpdates: {
      ...resetInvalidCount(ctx.session),
      selectedDate: selected.date,
    },
    nextState: "TIME_SELECTION",
  };
}