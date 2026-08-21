import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleDataCollection } from "./dataCollection.js";
import { prisma } from "../../../lib/prisma.js";
import type { StateHandlerContext } from "../types.js";

vi.mock("../../../lib/prisma.js", () => ({
  prisma: {
    customer: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../../../lib/index.js", () => ({
  log: {
    child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  },
}));

const mockedCreate = vi.mocked(prisma.customer.create);

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "DATA_COLLECTION",
      collectionPhase: "NAME",
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("DATA_COLLECTION state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("entry with empty message sends the name prompt and sets collectionPhase to NAME", async () => {
    const result = await handleDataCollection(
      makeContext({ message: "", rawMessage: "", session: { state: "DATA_COLLECTION", invalidInputCount: 0, lastActivity: new Date().toISOString() } }),
    );

    expect(result.nextState).toBe("DATA_COLLECTION");
    expect(result.sessionUpdates.collectionPhase).toBe("NAME");
    expect(result.messages).toHaveLength(1);
  });

  it("name shorter than 5 chars increments invalid count and stays in DATA_COLLECTION", async () => {
    const result = await handleDataCollection(
      makeContext({ message: "Jo", rawMessage: "Jo" }),
    );

    expect(result.nextState).toBe("DATA_COLLECTION");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });

  it("valid name creates the customer and transitions to BOOKING_CONFIRMATION", async () => {
    mockedCreate.mockResolvedValue({
      id: "customer-1",
      name: "Jane Doe",
      phone: "254712345678",
    } as never);

    const result = await handleDataCollection(
      makeContext({ message: "Jane Doe", rawMessage: "Jane Doe" }),
    );

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Jane Doe", phone: "254712345678" }),
      }),
    );
    expect(result.nextState).toBe("BOOKING_CONFIRMATION");
    expect(result.sessionUpdates.customerId).toBe("customer-1");
    expect(result.sessionUpdates.collectionPhase).toBeUndefined();
  });

  it("falls back to GREETING with the collected name if customer creation throws", async () => {
    mockedCreate.mockRejectedValue(new Error("DB unavailable"));

    const result = await handleDataCollection(
      makeContext({ message: "Jane Doe", rawMessage: "Jane Doe" }),
    );

    expect(result.nextState).toBe("GREETING");
    expect(result.sessionUpdates.customerName).toBe("Jane Doe");
  });
});
