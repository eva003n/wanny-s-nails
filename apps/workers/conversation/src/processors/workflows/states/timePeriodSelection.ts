import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";

/**
 * TIME_PERIOD_SELECTION
 *
 * Asks the user to select a preferred time of day using a WhatsApp Interactive List.
 * This state is entered after the user selects a date, before showing specific time slots.
 *
 * Options:
 *   🌅 Morning (7:00 AM – 11:59 AM)
 *   ☀️ Afternoon (12:00 PM – 4:59 PM)
 *   🌙 Evening (5:00 PM – 7:00 PM)
 *
 * Transitions:
 *   Valid period selection → TIME_SELECTION (stores selectedTimePeriod)
 *   invalid               → stay, increment invalid count
 */
export async function handleTimePeriodSelection(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();

  // ── Entry: no input yet, show the period selection menu ──
  if (!input) {
    return {
      messages: [buildTimePeriodListMessage()],
      sessionUpdates: resetInvalidCount(ctx.session),
      nextState: "TIME_PERIOD_SELECTION",
    };
  }

  // ── Match user selection ──
  const periodMap: Record<string, "morning" | "afternoon" | "evening"> = {
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
  };

  const selectedPeriod = periodMap[input];

  if (!selectedPeriod) {
    // Invalid input — re-send the menu
    const newSession = incrementInvalidCount(ctx.session);
    return {
      messages: [buildTimePeriodListMessage()],
      sessionUpdates: newSession,
      nextState: "TIME_PERIOD_SELECTION",
    };
  }

  // Valid period selected — transition to time slot selection
  return {
    messages: [],
    sessionUpdates: {
      ...resetInvalidCount(ctx.session),
      selectedTimePeriod: selectedPeriod,
    },
    nextState: "TIME_SELECTION",
  };
}

/**
 * Build the WhatsApp Interactive List message for time period selection.
 */
function buildTimePeriodListMessage(): StateTransitionResult["messages"][0] {
  return {
    type: "interactive_list",
    text: "What time of day works best for you?",
    listTitle: "Choose a Time Period",
    listButtonText: "Select period",
    listSections: [
      {
        title: "Available Periods",
        rows: [
          {
            id: "morning",
            title: "🌅 Morning (7AM – 11AM)",
          },
          {
            id: "afternoon",
            title: "☀️ Afternoon (12PM – 4PM)",
          },
          {
            id: "evening",
            title: "🌙 Evening (5PM – 7PM)",
          },
        ],
      },
    ],
  };
}