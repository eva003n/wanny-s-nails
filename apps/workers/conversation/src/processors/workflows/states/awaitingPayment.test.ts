import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StateHandlerContext } from "../types.js";

const mockCancel = vi.fn();
const mockOnBookingCancelled = vi.fn();
const mockPaymentQueueAdd = vi.fn();
const mockFindUniqueBooking = vi.fn();
const mockPaymentCreate = vi.fn();
const mockPaymentUpdate = vi.fn();

vi.mock("../../../lib/prisma.js", () => ({
  prisma: {
    booking: { findUnique: mockFindUniqueBooking },
    payment: { create: mockPaymentCreate, update: mockPaymentUpdate },
  },
}));

vi.mock("../../../lib/index.js", () => ({
  log: {
    child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  },
  paymentQueue: { add: mockPaymentQueueAdd },
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

const { handleAwaitingPayment } = await import("./awaitingPayment.js");

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "AWAITING_PAYMENT",
      bookingId: "booking-1",
      paymentPhone: "254712345678",
      selectedService: { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("AWAITING_PAYMENT state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retry success re-enqueues an STK Push job and stays in AWAITING_PAYMENT", async () => {
    mockFindUniqueBooking.mockResolvedValue({
      id: "booking-1",
      status: "APPROVED",
      priceKes: 1500,
      reference: "WN-2026-00123",
      payment: null,
    });
    mockPaymentCreate.mockResolvedValue({ id: "payment-1" });
    mockPaymentQueueAdd.mockResolvedValue({ id: "job-1" });

    const result = await handleAwaitingPayment(makeContext({ message: "retry" }));

    expect(mockPaymentQueueAdd).toHaveBeenCalled();
    expect(result.nextState).toBe("AWAITING_PAYMENT");
  });

  it("retry failure increments invalid count", async () => {
    mockFindUniqueBooking.mockRejectedValue(new Error("DB down"));

    const result = await handleAwaitingPayment(makeContext({ message: "1" }));

    expect(result.nextState).toBe("AWAITING_PAYMENT");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });

  it("cancel success calls BookingApplicationService.cancel() and onBookingCancelled(), then moves to IDLE", async () => {
    mockCancel.mockResolvedValue({ id: "booking-1", status: "CANCELLED" });
    mockOnBookingCancelled.mockResolvedValue(undefined);

    const result = await handleAwaitingPayment(makeContext({ message: "2" }));

    expect(mockCancel).toHaveBeenCalledWith({
      id: "booking-1",
      actorType: "CUSTOMER",
      reason: "Cancelled during payment via WhatsApp",
    });
    expect(mockOnBookingCancelled).toHaveBeenCalledWith("booking-1");
    expect(result.nextState).toBe("IDLE");
  });

  it("cancel failure increments invalid count and stays in AWAITING_PAYMENT", async () => {
    mockCancel.mockRejectedValue(new Error("already cancelled"));

    const result = await handleAwaitingPayment(makeContext({ message: "cancel" }));

    expect(result.nextState).toBe("AWAITING_PAYMENT");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });

  it("any other input increments invalid count (escalation-ladder regression)", async () => {
    const result = await handleAwaitingPayment(makeContext({ message: "what's happening" }));

    expect(result.nextState).toBe("AWAITING_PAYMENT");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });
});
