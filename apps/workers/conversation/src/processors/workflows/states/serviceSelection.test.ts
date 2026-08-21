import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleServiceSelection } from "./serviceSelection.js";
import { prisma } from "../../../lib/prisma.js";
import type { StateHandlerContext } from "../types.js";

vi.mock("../../../lib/prisma.js", () => ({
  prisma: {
    nailService: {
      findMany: vi.fn(),
    },
  },
}));

const mockedFindMany = vi.mocked(prisma.nailService.findMany);

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "SERVICE_SELECTION",
      selectedCategory: "MANICURE",
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("SERVICE_SELECTION state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('"back" returns to CATEGORY_SELECTION and clears selectedCategory', async () => {
    const result = await handleServiceSelection(makeContext({ message: "back" }));

    expect(result.nextState).toBe("CATEGORY_SELECTION");
    expect(result.sessionUpdates.selectedCategory).toBeUndefined();
  });

  it("no selectedCategory in session redirects to CATEGORY_SELECTION", async () => {
    const result = await handleServiceSelection(
      makeContext({
        message: "1",
        session: {
          state: "SERVICE_SELECTION",
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      }),
    );

    expect(result.nextState).toBe("CATEGORY_SELECTION");
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it("empty services for category goes back to CATEGORY_SELECTION", async () => {
    mockedFindMany.mockResolvedValue([] as never);

    const result = await handleServiceSelection(makeContext({ message: "1" }));

    expect(result.nextState).toBe("CATEGORY_SELECTION");
    expect(result.sessionUpdates.selectedCategory).toBeUndefined();
  });

  it("valid index saves selectedService and moves to DATE_SELECTION", async () => {
    mockedFindMany.mockResolvedValue([
      { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
      { id: "svc-2", name: "Classic Manicure", durationMinutes: 45, priceKes: 800 },
    ] as never);

    const result = await handleServiceSelection(makeContext({ message: "2" }));

    expect(result.nextState).toBe("DATE_SELECTION");
    expect(result.sessionUpdates.selectedService).toEqual({
      id: "svc-2",
      name: "Classic Manicure",
      durationMinutes: 45,
      priceKes: 800,
    });
  });

  it("invalid index increments invalid count and resends the service list", async () => {
    mockedFindMany.mockResolvedValue([
      { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
    ] as never);

    const result = await handleServiceSelection(makeContext({ message: "99" }));

    expect(result.nextState).toBe("SERVICE_SELECTION");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });
});
