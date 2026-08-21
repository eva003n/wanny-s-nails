import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleDateSelection } from "./dateSelection.js";
import { buildDateOptions } from "../helpers.js";
import type { StateHandlerContext } from "../types.js";

vi.mock("../helpers.js", async (importOriginal: () => Promise<unknown>) => {
  const actual = (await importOriginal()) as typeof import("../helpers.js");
  return {
    ...actual,
    buildDateOptions: vi.fn(),
  };
});

const mockedBuildDateOptions = vi.mocked(buildDateOptions);

// dateSelection.ts caches date options in a module-scope Map keyed by
// customerId — use a unique customerId per test to avoid cross-test
// pollution instead of trying to reset the module's internal cache.
let customerCounter = 0;
function nextCustomerId() {
  customerCounter += 1;
  return `customer-date-${customerCounter}`;
}

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "DATE_SELECTION",
      selectedService: { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
      customerId: nextCustomerId(),
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("DATE_SELECTION state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no service in session redirects to SERVICE_SELECTION", async () => {
    const result = await handleDateSelection(
      makeContext({
        message: "1",
        session: {
          state: "DATE_SELECTION",
          customerId: nextCustomerId(),
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      }),
    );

    expect(result.nextState).toBe("SERVICE_SELECTION");
    expect(mockedBuildDateOptions).not.toHaveBeenCalled();
  });

  it("empty date options: goes back to GREETING", async () => {
    mockedBuildDateOptions.mockResolvedValue([]);

    const result = await handleDateSelection(makeContext({ message: "1" }));

    expect(result.nextState).toBe("GREETING");
  });

  it("valid non-full date saves selectedDate and moves to TIME_PERIOD_SELECTION", async () => {
    mockedBuildDateOptions.mockResolvedValue([
      { label: "Today", date: "2026-08-22", availableSlots: 3, isFull: false },
      { label: "Tomorrow", date: "2026-08-23", availableSlots: 0, isFull: true },
    ]);

    const result = await handleDateSelection(makeContext({ message: "1" }));

    expect(result.nextState).toBe("TIME_PERIOD_SELECTION");
    expect(result.sessionUpdates.selectedDate).toBe("2026-08-22");
    expect(result.sessionUpdates.invalidInputCount).toBe(0);
  });

  it("full date: increments invalid count and stays in DATE_SELECTION", async () => {
    mockedBuildDateOptions.mockResolvedValue([
      { label: "Tomorrow", date: "2026-08-23", availableSlots: 0, isFull: true },
    ]);

    const result = await handleDateSelection(makeContext({ message: "1" }));

    expect(result.nextState).toBe("DATE_SELECTION");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });

  it("invalid index: increments invalid count and resends the date list", async () => {
    mockedBuildDateOptions.mockResolvedValue([
      { label: "Today", date: "2026-08-22", availableSlots: 3, isFull: false },
    ]);

    const result = await handleDateSelection(makeContext({ message: "99" }));

    expect(result.nextState).toBe("DATE_SELECTION");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });
});
