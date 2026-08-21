import { describe, expect, it } from "vitest";
import { handleTimePeriodSelection } from "./timePeriodSelection.js";
import type { StateHandlerContext } from "../types.js";

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "TIME_PERIOD_SELECTION",
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("TIME_PERIOD_SELECTION state handler (TESTING.md §4.2 — FSM transitions)", () => {
  it("empty input shows the period menu and resets invalid count", async () => {
    const result = await handleTimePeriodSelection(makeContext({ message: "" }));

    expect(result.nextState).toBe("TIME_PERIOD_SELECTION");
    expect(result.messages[0]?.type).toBe("interactive_list");
    expect(result.sessionUpdates.invalidInputCount).toBe(0);
  });

  it.each(["morning", "afternoon", "evening"] as const)(
    "valid period %s moves to TIME_SELECTION",
    async (period) => {
      const result = await handleTimePeriodSelection(makeContext({ message: period }));

      expect(result.nextState).toBe("TIME_SELECTION");
      expect(result.sessionUpdates.selectedTimePeriod).toBe(period);
    },
  );

  it("invalid period increments invalid count and resends the menu", async () => {
    const result = await handleTimePeriodSelection(makeContext({ message: "midnight" }));

    expect(result.nextState).toBe("TIME_PERIOD_SELECTION");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });
});
