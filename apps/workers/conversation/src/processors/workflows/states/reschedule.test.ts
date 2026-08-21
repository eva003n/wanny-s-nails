import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StateHandlerContext } from "../types.js";

// vi.mock factories run before any top-level `const`, so mock functions
// referenced inside them must be declared via vi.hoisted (this file's
// dynamic imports below still trigger real module loads that reach into
// these mocked modules before a plain top-level const would be initialized).
const { mockReschedule, mockOnBookingRescheduled, mockGetAvailableSlots, mockBuildDateOptions } =
  vi.hoisted(() => ({
    mockReschedule: vi.fn(),
    mockOnBookingRescheduled: vi.fn(),
    mockGetAvailableSlots: vi.fn(),
    mockBuildDateOptions: vi.fn(),
  }));

vi.mock("../helpers.js", async (importOriginal: () => Promise<unknown>) => {
  const actual = (await importOriginal()) as typeof import("../helpers.js");
  return {
    ...actual,
    buildDateOptions: mockBuildDateOptions,
  };
});

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
    getAvailableSlots: mockGetAvailableSlots,
    BookingApplicationService: vi.fn().mockImplementation(function () {
      return { reschedule: mockReschedule };
    }),
    NotificationService: vi.fn().mockImplementation(function () {
      return { onBookingRescheduled: mockOnBookingRescheduled };
    }),
    PrismaBookingRepository: vi.fn(),
    PrismaServiceRepository: vi.fn(),
    PrismaCustomerRepository: vi.fn(),
    PrismaBusinessHoursRepository: vi.fn(),
    PrismaUnitOfWork: vi.fn(),
  };
});

const mockedBuildDateOptions = mockBuildDateOptions;

const {
  handleRescheduleDate,
  handleRescheduleTime,
  handleRescheduleConfirmation,
} = await import("./reschedule.js");

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "RESCHEDULE_DATE",
      bookingId: "booking-1",
      selectedService: { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
      invalidInputCount: 0,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("RESCHEDULE_DATE state handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no service in session returns to GREETING", async () => {
    const result = await handleRescheduleDate(
      makeContext({
        message: "1",
        session: { state: "RESCHEDULE_DATE", invalidInputCount: 0, lastActivity: new Date().toISOString() },
      }),
    );
    expect(result.nextState).toBe("GREETING");
  });

  it("empty date options returns to GREETING", async () => {
    mockedBuildDateOptions.mockResolvedValue([]);
    const result = await handleRescheduleDate(makeContext({ message: "1" }));
    expect(result.nextState).toBe("GREETING");
  });

  it("valid non-full date saves selectedDate and moves to RESCHEDULE_TIME", async () => {
    mockedBuildDateOptions.mockResolvedValue([
      { label: "Tomorrow", date: "2026-08-23", availableSlots: 2, isFull: false },
    ]);
    const result = await handleRescheduleDate(makeContext({ message: "1" }));
    expect(result.nextState).toBe("RESCHEDULE_TIME");
    expect(result.sessionUpdates.selectedDate).toBe("2026-08-23");
  });

  it("full date increments invalid count", async () => {
    mockedBuildDateOptions.mockResolvedValue([
      { label: "Tomorrow", date: "2026-08-23", availableSlots: 0, isFull: true },
    ]);
    const result = await handleRescheduleDate(makeContext({ message: "1" }));
    expect(result.nextState).toBe("RESCHEDULE_DATE");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });

  it("invalid index increments invalid count", async () => {
    mockedBuildDateOptions.mockResolvedValue([
      { label: "Tomorrow", date: "2026-08-23", availableSlots: 2, isFull: false },
    ]);
    const result = await handleRescheduleDate(makeContext({ message: "99" }));
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });
});

describe("RESCHEDULE_TIME state handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function timeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
    return makeContext({
      session: {
        state: "RESCHEDULE_TIME",
        bookingId: "booking-1",
        selectedService: { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
        selectedDate: "2026-08-23",
        invalidInputCount: 0,
        lastActivity: new Date().toISOString(),
      },
      ...overrides,
    });
  }

  it("missing service/date returns to GREETING", async () => {
    const result = await handleRescheduleTime(
      makeContext({ session: { state: "RESCHEDULE_TIME", invalidInputCount: 0, lastActivity: new Date().toISOString() } }),
    );
    expect(result.nextState).toBe("GREETING");
  });

  it("calls getAvailableSlots with (prisma, selectedDate, serviceId)", async () => {
    mockGetAvailableSlots.mockResolvedValue({
      slots: [{ time: "14:00", appointmentAt: "2026-08-23T11:00:00.000Z", available: true }],
    });

    await handleRescheduleTime(timeContext({ message: "1" }));

    expect(mockGetAvailableSlots).toHaveBeenCalledWith(
      expect.anything(),
      "2026-08-23",
      "svc-1",
    );
  });

  it("no available slots returns to RESCHEDULE_DATE", async () => {
    mockGetAvailableSlots.mockResolvedValue({ slots: [] });
    const result = await handleRescheduleTime(timeContext({ message: "1" }));
    expect(result.nextState).toBe("RESCHEDULE_DATE");
  });

  it("valid index saves selectedTime/appointmentAt and moves to RESCHEDULE_CONFIRMATION", async () => {
    mockGetAvailableSlots.mockResolvedValue({
      slots: [{ time: "14:00", appointmentAt: "2026-08-23T11:00:00.000Z", available: true }],
    });
    const result = await handleRescheduleTime(timeContext({ message: "1" }));
    expect(result.nextState).toBe("RESCHEDULE_CONFIRMATION");
    expect(result.sessionUpdates.selectedTime).toBe("14:00");
  });

  it("invalid index increments invalid count", async () => {
    mockGetAvailableSlots.mockResolvedValue({
      slots: [{ time: "14:00", appointmentAt: "2026-08-23T11:00:00.000Z", available: true }],
    });
    const result = await handleRescheduleTime(timeContext({ message: "99" }));
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });

  it("getAvailableSlots throwing returns to RESCHEDULE_DATE instead of escalating", async () => {
    mockGetAvailableSlots.mockRejectedValue(new Error("Business closed"));
    const result = await handleRescheduleTime(timeContext({ message: "1" }));
    expect(result.nextState).toBe("RESCHEDULE_DATE");
  });
});

describe("RESCHEDULE_CONFIRMATION state handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function confirmContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
    return makeContext({
      session: {
        state: "RESCHEDULE_CONFIRMATION",
        bookingId: "booking-1",
        selectedService: { id: "svc-1", name: "Gel Manicure", durationMinutes: 60, priceKes: 1500 },
        selectedTime: "14:00",
        appointmentAt: "2026-08-23T11:00:00.000Z",
        invalidInputCount: 0,
        lastActivity: new Date().toISOString(),
      },
      ...overrides,
    });
  }

  it("yes calls reschedule() + onBookingRescheduled() and moves to IDLE", async () => {
    mockReschedule.mockResolvedValue({ id: "booking-1", status: "RESCHEDULED" });
    mockOnBookingRescheduled.mockResolvedValue(undefined);

    const result = await handleRescheduleConfirmation(confirmContext({ message: "yes" }));

    expect(mockReschedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: "booking-1", newAppointmentAt: "2026-08-23T11:00:00.000Z" }),
    );
    expect(mockOnBookingRescheduled).toHaveBeenCalledWith(
      "booking-1",
      new Date("2026-08-23T11:00:00.000Z"),
    );
    expect(result.nextState).toBe("IDLE");
  });

  it("missing bookingId/appointmentAt returns to GREETING", async () => {
    const result = await handleRescheduleConfirmation(
      makeContext({
        message: "yes",
        session: { state: "RESCHEDULE_CONFIRMATION", invalidInputCount: 0, lastActivity: new Date().toISOString() },
      }),
    );
    expect(result.nextState).toBe("GREETING");
    expect(mockReschedule).not.toHaveBeenCalled();
  });

  it("reschedule() throwing shows an error and returns to GREETING", async () => {
    mockReschedule.mockRejectedValue(new Error("slot taken"));
    const result = await handleRescheduleConfirmation(confirmContext({ message: "yes" }));
    expect(result.nextState).toBe("GREETING");
  });

  it("no cancels the reschedule and moves to IDLE", async () => {
    const result = await handleRescheduleConfirmation(confirmContext({ message: "no" }));
    expect(result.nextState).toBe("IDLE");
    expect(mockReschedule).not.toHaveBeenCalled();
  });

  it("invalid input increments invalid count (escalation-ladder regression)", async () => {
    const result = await handleRescheduleConfirmation(confirmContext({ message: "banana" }));
    expect(result.nextState).toBe("RESCHEDULE_CONFIRMATION");
    expect(result.sessionUpdates.invalidInputCount).toBe(1);
  });
});
