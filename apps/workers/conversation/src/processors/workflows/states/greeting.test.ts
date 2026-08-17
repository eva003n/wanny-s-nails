import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleGreeting, buildMainMenuMessage } from "./greeting.js";
import { findActiveBooking } from "../helpers.js";
import type { StateHandlerContext } from "../types.js";

vi.mock("../helpers.js", async (importOriginal: () => Promise<unknown>) => {
  const actual = (await importOriginal()) as typeof import("../helpers.js");
  return {
    ...actual,
    findActiveBooking: vi.fn(),
  };
});

const mockedFindActiveBooking = vi.mocked(findActiveBooking);

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "GREETING",
      customerName: "Jane",
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("GREETING state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildMainMenuMessage", () => {
    it("returns an interactive list with 4 appointment options", () => {
      const msg = buildMainMenuMessage("Jane");
      expect(msg.type).toBe("interactive_list");
      const sections = msg.listSections ?? [];
      expect(sections[0]?.rows).toHaveLength(4);
      expect(sections[0]?.rows[0]?.title).toBe("Book Appointment");
      expect(sections[0]?.rows[1]?.title).toBe("View Appointment");
      expect(sections[0]?.rows[2]?.title).toBe("Reschedule Appointment");
      expect(sections[0]?.rows[3]?.title).toBe("Cancel Appointment");
    });
  });

  describe("handleGreeting", () => {
    it('transitions to CATEGORY_SELECTION when user replies "1"', async () => {
      const ctx = makeContext({ message: "1" });
      const result = await handleGreeting(ctx);

      expect(result.nextState).toBe("CATEGORY_SELECTION");
      expect(result.sessionUpdates.flow).toBe("BOOKING");
      expect(result.messages).toHaveLength(0);
    });

    it('transitions to CATEGORY_SELECTION when user says "book"', async () => {
      const ctx = makeContext({ message: "book" });
      const result = await handleGreeting(ctx);

      expect(result.nextState).toBe("CATEGORY_SELECTION");
      expect(result.sessionUpdates.flow).toBe("BOOKING");
    });

    it("stays in GREETING and increments invalid count for unknown input", async () => {
      const ctx = makeContext({ message: "xyz" });
      const result = await handleGreeting(ctx);

      expect(result.nextState).toBe("GREETING");
      expect(result.sessionUpdates.invalidInputCount).toBe(1);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.type).toBe("interactive_list");
    });

    it("increments invalid count cumulatively", async () => {
      const ctx = makeContext({
        message: "xyz",
        session: {
          state: "GREETING",
          customerName: "Jane",
          invalidInputCount: 2,
          lastActivity: new Date().toISOString(),
        },
      });
      const result = await handleGreeting(ctx);

      expect(result.sessionUpdates.invalidInputCount).toBe(3);
    });

    it("handles view appointment when customer has no account", async () => {
      const ctx = makeContext({ message: "2" });
      const result = await handleGreeting(ctx);

      expect(result.nextState).toBe("GREETING");
      expect(result.messages[0]?.text).toContain("couldn't find your account");
    });

    it("handles view appointment when customer has no active booking", async () => {
      mockedFindActiveBooking.mockResolvedValue(null);
      const ctx = makeContext({
        message: "2",
        session: {
          state: "GREETING",
          customerId: "customer-1",
          customerName: "Jane",
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      });
      const result = await handleGreeting(ctx);

      expect(result.nextState).toBe("GREETING");
      expect(result.messages[0]?.text).toContain("don't have any upcoming");
    });

    it("shows booking details when customer has an active booking", async () => {
      mockedFindActiveBooking.mockResolvedValue({
        id: "booking-1",
        reference: "WN-123",
        appointmentAt: new Date("2026-08-10T10:00:00.000Z"),
        status: "APPROVED",
        priceKes: 1500,
        service: {
          id: "service-1",
          name: "Classic Manicure",
          durationMinutes: 60,
          priceKes: 1500,
        },
      } as never);

      const ctx = makeContext({
        message: "2",
        session: {
          state: "GREETING",
          customerId: "customer-1",
          customerName: "Jane",
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      });
      const result = await handleGreeting(ctx);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.text).toContain("Classic Manicure");
      expect(result.messages[0]?.text).toContain("WN-123");
      expect(result.sessionUpdates.bookingId).toBe("booking-1");
    });

    it("transitions to CANCEL_CONFIRMATION when user replies 3 and has a booking", async () => {
      mockedFindActiveBooking.mockResolvedValue({
        id: "booking-1",
        reference: "WN-123",
        appointmentAt: new Date("2026-08-10T10:00:00.000Z"),
        status: "APPROVED",
        priceKes: 1500,
        service: {
          id: "service-1",
          name: "Classic Manicure",
          durationMinutes: 60,
          priceKes: 1500,
        },
      } as never);

      const ctx = makeContext({
        message: "3",
        session: {
          state: "GREETING",
          customerId: "customer-1",
          customerName: "Jane",
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      });
      const result = await handleGreeting(ctx);

      expect(result.nextState).toBe("CANCEL_CONFIRMATION");
      expect(result.sessionUpdates.flow).toBe("CANCEL");
      expect(result.sessionUpdates.bookingId).toBe("booking-1");
    });

    it("transitions to RESCHEDULE_DATE when user replies 4 and has a booking", async () => {
      mockedFindActiveBooking.mockResolvedValue({
        id: "booking-1",
        reference: "WN-123",
        appointmentAt: new Date("2026-08-10T10:00:00.000Z"),
        status: "APPROVED",
        priceKes: 1500,
        service: {
          id: "service-1",
          name: "Classic Manicure",
          durationMinutes: 60,
          priceKes: 1500,
        },
      } as never);

      const ctx = makeContext({
        message: "4",
        session: {
          state: "GREETING",
          customerId: "customer-1",
          customerName: "Jane",
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      });
      const result = await handleGreeting(ctx);

      expect(result.nextState).toBe("RESCHEDULE_DATE");
      expect(result.sessionUpdates.flow).toBe("RESCHEDULE");
    });
  });
});