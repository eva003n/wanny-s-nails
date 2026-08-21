import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StateHandlerContext } from "../types.js";

const mockFindUniqueBooking = vi.fn();
const mockUpdateBooking = vi.fn();

vi.mock("../../../lib/prisma.js", () => ({
  prisma: {
    booking: { findUnique: mockFindUniqueBooking, update: mockUpdateBooking },
  },
}));

vi.mock("../../../lib/index.js", () => ({
  log: {
    child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  },
}));

const { handleAwaitingPaymentPhone } = await import("./awaitingPaymentPhone.js");

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "AWAITING_PAYMENT_PHONE",
      bookingId: "booking-1",
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("AWAITING_PAYMENT_PHONE state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUniqueBooking.mockResolvedValue({ id: "booking-1", status: "PENDING" });
    mockUpdateBooking.mockResolvedValue({ id: "booking-1", status: "APPROVED" });
  });

  it("cash keyword moves to THANK_YOU and approves the PENDING booking", async () => {
    const result = await handleAwaitingPaymentPhone(makeContext({ message: "cash" }));

    expect(result.nextState).toBe("THANK_YOU");
    expect(result.sessionUpdates.paymentPhone).toBeUndefined();
    expect(mockUpdateBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "booking-1" },
        data: expect.objectContaining({ status: "APPROVED" }),
      }),
    );
  });

  it("valid Kenyan phone moves to THANK_YOU, saves paymentPhone, and approves the PENDING booking", async () => {
    const result = await handleAwaitingPaymentPhone(makeContext({ message: "0712345678" }));

    expect(result.nextState).toBe("THANK_YOU");
    expect(result.sessionUpdates.paymentPhone).toBe("254712345678");
    expect(mockUpdateBooking).toHaveBeenCalled();
  });

  it("invalid phone increments invalid count and does not approve any booking", async () => {
    const result = await handleAwaitingPaymentPhone(makeContext({ message: "abc" }));

    expect(result.nextState).toBe("AWAITING_PAYMENT_PHONE");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
    expect(mockUpdateBooking).not.toHaveBeenCalled();
  });

  it("does not approve a booking that isn't PENDING", async () => {
    mockFindUniqueBooking.mockResolvedValue({ id: "booking-1", status: "APPROVED" });

    await handleAwaitingPaymentPhone(makeContext({ message: "cash" }));

    expect(mockUpdateBooking).not.toHaveBeenCalled();
  });
});
