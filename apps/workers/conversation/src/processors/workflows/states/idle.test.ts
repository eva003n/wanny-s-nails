import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleIdle } from "./idle.js";
import { findCustomerByPhone } from "../helpers.js";
import type { StateHandlerContext } from "../types.js";

vi.mock("../helpers.js", async (importOriginal: () => Promise<unknown>) => {
  const actual = (await importOriginal()) as typeof import("../helpers.js");
  return {
    ...actual,
    findCustomerByPhone: vi.fn(),
  };
});

const mockedFindCustomerByPhone = vi.mocked(findCustomerByPhone);

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "IDLE",
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("IDLE state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returning customer: loads customerId/customerName from DB and transitions to GREETING", async () => {
    mockedFindCustomerByPhone.mockResolvedValue({
      id: "customer-1",
      name: "Jane",
      phone: "254712345678",
      email: null,
    });

    const result = await handleIdle(makeContext());

    expect(result.nextState).toBe("GREETING");
    expect(result.sessionUpdates.customerId).toBe("customer-1");
    expect(result.sessionUpdates.customerName).toBe("Jane");
    expect(result.sessionUpdates.isNewCustomer).toBe(false);
  });

  it("new customer: no DB record found, still transitions to GREETING but flags isNewCustomer", async () => {
    mockedFindCustomerByPhone.mockResolvedValue(null);

    const result = await handleIdle(makeContext());

    expect(result.nextState).toBe("GREETING");
    expect(result.sessionUpdates.customerId).toBeUndefined();
    expect(result.sessionUpdates.isNewCustomer).toBe(true);
  });

  it("falls back to the session's existing customerName when DB lookup finds nothing", async () => {
    mockedFindCustomerByPhone.mockResolvedValue(null);

    const result = await handleIdle(
      makeContext({
        session: {
          state: "IDLE",
          customerName: "WhatsApp Profile Name",
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      }),
    );

    expect(result.sessionUpdates.customerName).toBe("WhatsApp Profile Name");
  });

  it("resets invalidInputCount and clears flow-specific fields on entry", async () => {
    mockedFindCustomerByPhone.mockResolvedValue(null);

    const result = await handleIdle(makeContext());

    expect(result.sessionUpdates.invalidInputCount).toBe(0);
    expect(result.sessionUpdates.flow).toBeUndefined();
    expect(result.sessionUpdates.selectedService).toBeUndefined();
    expect(result.sessionUpdates.bookingId).toBeUndefined();
  });
});
