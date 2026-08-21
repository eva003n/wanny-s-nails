import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StateHandlerContext } from "../types.js";

const mockCreate = vi.fn();

vi.mock("../../../lib/prisma.js", () => ({
  prisma: {},
}));

vi.mock("../../../lib/index.js", () => ({
  log: {
    child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  },
  paymentQueue: {},
}));

vi.mock("@wannys-nails/core", async (importOriginal: () => Promise<unknown>) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    BookingApplicationService: vi.fn().mockImplementation(function () {
      return { create: mockCreate };
    }),
    PrismaBookingRepository: vi.fn(),
    PrismaServiceRepository: vi.fn(),
    PrismaCustomerRepository: vi.fn(),
    PrismaBusinessHoursRepository: vi.fn(),
    PrismaUnitOfWork: vi.fn(),
  };
});

const { handleBookingConfirmation } = await import("./bookingConfirmation.js");
const { BookingConflictError, ServiceInactiveError } = await import("@wannys-nails/core");

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "BOOKING_CONFIRMATION",
      customerId: "customer-1",
      selectedService: { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
      selectedTime: "14:00",
      appointmentAt: "2026-08-22T11:00:00.000Z",
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("BOOKING_CONFIRMATION state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirm with no customerId in session routes to DATA_COLLECTION without calling create()", async () => {
    const result = await handleBookingConfirmation(
      makeContext({
        message: "yes",
        session: {
          state: "BOOKING_CONFIRMATION",
          selectedService: { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
          appointmentAt: "2026-08-22T11:00:00.000Z",
          invalidInputCount: 0,
          lastActivity: new Date().toISOString(),
        },
      }),
    );

    expect(result.nextState).toBe("DATA_COLLECTION");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("confirm success calls BookingApplicationService.create() and moves to AWAITING_PAYMENT_PHONE", async () => {
    mockCreate.mockResolvedValue({
      id: "booking-1",
      reference: "WN-2026-00123",
      customerId: "customer-1",
      services: [{ service: { id: "svc-1", name: "Gel Manicure" } }],
      appointmentAt: "2026-08-22T11:00:00.000Z",
      durationMinutes: 60,
      priceKes: 1500,
      status: "PENDING",
      paymentStatus: "PENDING",
      notes: null,
      customer: { id: "customer-1", name: "Jane", phone: "254712345678" },
      payment: null,
      createdAt: new Date().toISOString(),
    });

    const result = await handleBookingConfirmation(makeContext({ message: "yes" }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer-1",
        serviceIds: ["svc-1"],
        appointmentAt: "2026-08-22T11:00:00.000Z",
        actorType: "CUSTOMER",
      }),
    );
    expect(result.nextState).toBe("AWAITING_PAYMENT_PHONE");
    expect(result.sessionUpdates.bookingId).toBe("booking-1");
    expect(result.sessionUpdates.bookingRef).toBe("WN-2026-00123");
  });

  it("create() throwing BookingConflictError shows a slot-taken message and returns to GREETING", async () => {
    mockCreate.mockRejectedValue(new BookingConflictError());

    const result = await handleBookingConfirmation(makeContext({ message: "1" }));

    expect(result.nextState).toBe("GREETING");
    expect(result.messages[0]?.text).toContain("time slot was just taken");
  });

  it("create() throwing ServiceInactiveError shows a service-unavailable message", async () => {
    mockCreate.mockRejectedValue(new ServiceInactiveError());

    const result = await handleBookingConfirmation(makeContext({ message: "1" }));

    expect(result.nextState).toBe("GREETING");
    expect(result.messages[0]?.text).toContain("no longer available");
  });

  it("decline (no/2) clears booking-flow fields and returns to GREETING", async () => {
    const result = await handleBookingConfirmation(makeContext({ message: "no" }));

    expect(result.nextState).toBe("GREETING");
    expect(result.sessionUpdates.selectedService).toBeUndefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("invalid input increments invalid count (escalation-ladder regression)", async () => {
    const result = await handleBookingConfirmation(makeContext({ message: "banana" }));

    expect(result.nextState).toBe("BOOKING_CONFIRMATION");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });
});
