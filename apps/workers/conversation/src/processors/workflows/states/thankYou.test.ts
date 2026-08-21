import { describe, expect, it, vi } from "vitest";
import { handleThankYou } from "./thankYou.js";
import type { StateHandlerContext } from "../types.js";

vi.mock("../../../lib/index.js", () => ({
  log: {
    child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  },
}));

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "anything",
    rawMessage: "anything",
    phone: "254712345678",
    session: {
      state: "THANK_YOU",
      selectedService: { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
      selectedTime: "14:00",
      appointmentAt: "2026-08-22T11:00:00.000Z",
      bookingRef: "WN-2026-00123",
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("THANK_YOU state handler (TESTING.md §4.2 — FSM transitions)", () => {
  it("any input transitions to IDLE and clears booking-flow session fields", async () => {
    const result = await handleThankYou(makeContext());

    expect(result.nextState).toBe("IDLE");
    expect(result.sessionUpdates.bookingId).toBeUndefined();
    expect(result.sessionUpdates.bookingRef).toBeUndefined();
    expect(result.sessionUpdates.selectedService).toBeUndefined();
    expect(result.sessionUpdates.appointmentAt).toBeUndefined();
  });

  it("message includes reference, service, date and time", async () => {
    const result = await handleThankYou(makeContext());
    const text = result.messages[0]?.text ?? "";

    expect(text).toContain("WN-2026-00123");
    expect(text).toContain("Gel Manicure");
    expect(text).toContain("2:00 PM");
  });

  it("shows the M-Pesa line when a payment phone was collected", async () => {
    const result = await handleThankYou(
      makeContext({
        session: {
          state: "THANK_YOU",
          paymentPhone: "254712345678",
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      }),
    );

    expect(result.messages[0]?.text).toContain("M-Pesa payment request to 254712345678");
  });

  it("shows the pay-at-salon line when no payment phone was collected", async () => {
    const result = await handleThankYou(
      makeContext({
        session: {
          state: "THANK_YOU",
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      }),
    );

    expect(result.messages[0]?.text).toContain("Please pay at the salon when you arrive.");
  });
});
