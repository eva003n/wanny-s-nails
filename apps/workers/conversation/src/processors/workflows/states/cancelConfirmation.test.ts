import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StateHandlerContext } from "../types.js";

const mockCancel = vi.fn();
const mockOnBookingCancelled = vi.fn();

vi.mock("../../../lib/prisma.js", () => ({
  prisma: {},
}));

vi.mock("../../../lib/index.js", () => ({
  log: {
    child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  },
  notificationQueue: {},
}));

vi.mock("@wannys-nails/core", async (importOriginal: () => Promise<unknown>) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    BookingApplicationService: vi.fn().mockImplementation(function () {
      return { cancel: mockCancel };
    }),
    NotificationService: vi.fn().mockImplementation(function () {
      return { onBookingCancelled: mockOnBookingCancelled };
    }),
    PrismaBookingRepository: vi.fn(),
    PrismaServiceRepository: vi.fn(),
    PrismaCustomerRepository: vi.fn(),
    PrismaBusinessHoursRepository: vi.fn(),
    PrismaUnitOfWork: vi.fn(),
  };
});

const { handleCancelConfirmation } = await import("./cancelConfirmation.js");

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "CANCEL_CONFIRMATION",
      bookingId: "booking-1",
      bookingRef: "WN-2026-00123",
      selectedService: { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
      appointmentAt: "2026-08-22T11:00:00.000Z",
      selectedTime: "14:00",
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("CANCEL_CONFIRMATION state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yes/1 confirm cancels via BookingApplicationService and cancels reminders via NotificationService", async () => {
    mockCancel.mockResolvedValue({ id: "booking-1", status: "CANCELLED" });
    mockOnBookingCancelled.mockResolvedValue(undefined);

    const result = await handleCancelConfirmation(makeContext({ message: "1" }));

    expect(mockCancel).toHaveBeenCalledWith({
      id: "booking-1",
      actorType: "CUSTOMER",
      reason: "Cancelled via WhatsApp",
    });
    expect(mockOnBookingCancelled).toHaveBeenCalledWith("booking-1");
    expect(result.nextState).toBe("IDLE");
    expect(result.sessionUpdates.bookingId).toBeUndefined();
  });

  it("no bookingId in session returns to GREETING without calling cancel()", async () => {
    const result = await handleCancelConfirmation(
      makeContext({
        message: "yes",
        session: {
          state: "CANCEL_CONFIRMATION",
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      }),
    );

    expect(result.nextState).toBe("GREETING");
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("cancel() throwing returns an error message and stays routed to GREETING", async () => {
    mockCancel.mockRejectedValue(new Error("already cancelled"));

    const result = await handleCancelConfirmation(makeContext({ message: "yes" }));

    expect(result.nextState).toBe("GREETING");
    expect(result.messages[0]?.text).toContain("couldn't cancel");
  });

  it("no/2 keeps the booking, clears flow fields, and moves to IDLE", async () => {
    const result = await handleCancelConfirmation(makeContext({ message: "no" }));

    expect(result.nextState).toBe("IDLE");
    expect(mockCancel).not.toHaveBeenCalled();
    expect(result.sessionUpdates.bookingId).toBeUndefined();
  });

  it("invalid input increments invalid count (escalation-ladder regression)", async () => {
    const result = await handleCancelConfirmation(makeContext({ message: "banana" }));

    expect(result.nextState).toBe("CANCEL_CONFIRMATION");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });
});
