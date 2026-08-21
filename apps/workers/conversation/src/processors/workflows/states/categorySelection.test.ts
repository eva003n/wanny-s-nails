import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleCategorySelection } from "./categorySelection.js";
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
      state: "CATEGORY_SELECTION",
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("CATEGORY_SELECTION state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no active categories: returns to GREETING with a 'no services' message", async () => {
    mockedFindMany.mockResolvedValue([] as never);

    const result = await handleCategorySelection(makeContext({ message: "1" }));

    expect(result.nextState).toBe("GREETING");
    expect(result.messages[0]?.text).toContain("no services available");
  });

  it("valid numeric selection saves selectedCategory and moves to SERVICE_SELECTION", async () => {
    mockedFindMany.mockResolvedValue([
      { category: "MANICURE", description: "Manicure services" },
      { category: "PEDICURE", description: "Pedicure services" },
    ] as never);

    const result = await handleCategorySelection(makeContext({ message: "2" }));

    expect(result.nextState).toBe("SERVICE_SELECTION");
    expect(result.sessionUpdates.selectedCategory).toBe("PEDICURE");
    expect(result.sessionUpdates.invalidInputCount).toBe(0);
  });

  it("invalid input increments invalid count and resends the category list", async () => {
    mockedFindMany.mockResolvedValue([
      { category: "MANICURE", description: "Manicure services" },
    ] as never);

    const result = await handleCategorySelection(makeContext({ message: "99" }));

    expect(result.nextState).toBe("CATEGORY_SELECTION");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
    expect(result.messages[0]?.type).toBe("interactive_list");
  });
});
