import type { ServiceData, BusinessHoursData, BookingCandidate, CreateBookingInput, RescheduleBookingInput, CancelBookingInput } from "../types.js";
import { BookingPolicy, BusinessClosedError } from "./BookingPolicy.js";
import { BookingConflictService, BookingConflictError } from "./BookingConflictService.js";
import type { BookingStatus } from "../../generated/prisma/enums.ts";
import type { Booking, BusinessHours } from "../../generated/prisma/client.ts";

export class ServiceInactiveError extends Error {
  constructor(message?: string) {
    super(message || "ServiceInactive");
    this.name = "ServiceInactiveError";
  }
}
export class ServiceNotFoundError extends Error {
  constructor() {
    super("ServiceNotFound");
    this.name = "ServiceNotFoundError";
  }
}
export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message || "InvalidInput");
    this.name = "InvalidInputError";
  }
}

export class CustomerNotFoundError extends Error {
  constructor(customerId: string) {
    super("CustomerNotFound");
    this.name = "CustomerNotFoundError";
    this.customerId = customerId;
  }
  readonly customerId: string;
}

export class InvalidStatusTransitionError extends Error {
  constructor(currentStatus: string, targetAction: string) {
    super(
      `INVALID_STATUS_TRANSITION\n,
      Cannot ${targetAction} a booking in ${currentStatus} status`
    );
  }
}

export class OutsideBusinessHoursError extends Error {
  constructor(appointmentAt: string) {
    super(
      `OUTSIDE_BUSINESS_HOURS
      The selected time is outside configured business hours; ${appointmentAt}`,
    );
  }
}

export class BookingPastDateError extends Error {
  constructor() {
    super("BOOKING_PAST_DATE\nThe selected date/time is in the past");
    this.name = "BookingPastDateError";
  }
}
/**
 * Pure domain service for booking business logic.
 * Validates all business rules and constructs the booking aggregate.
 * No persistence, no side effects — takes repository interfaces for data access.
 */
export interface BookingDomainServiceDeps {
  findService(id: string): Promise<ServiceData | null>;
  findCustomer(id: string): Promise<{ id: string; name: string; phone: string } | null>;
  findBusinessHours(dayOfWeek: number): Promise<BusinessHoursData | null>;
  findBookingCandidates(
    lowerBound: Date,
    upperBound: Date,
    options?: { excludeId?: string }
  ): Promise<BookingCandidate[]>;
}

export interface ValidatedBooking {
  customerId: string;
  services: Array<ServiceData>;
  appointmentAt: Date;
  durationMinutes: number;
  priceKes: number;
  notes: string | null;
}

export interface ValidatedReschedule {
  id: string;
  newAppointmentAt: Date;
  durationMinutes: number;
  rescheduledById: string;
  actorType: string;
  reason?: string | undefined;
}

export interface ValidatedCancel {
  id: string;
  actorType: string;
  reason?: string | undefined;
  fromStatus: string;
}

function generateReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, "0");
  return `WN-${year}-${seq}`;
}

export const BookingDomainService = {
  /**
   * Validate input and return a validated booking aggregate ready for persistence.
   * Throws domain errors on any validation failure.
   */
  async validateAndBuild(
    input: CreateBookingInput,
    deps: BookingDomainServiceDeps,
  ): Promise<ValidatedBooking & { reference: string; actorType: string }> {
    // 1. Validate services exist and are active
    if (input.serviceIds.length === 0) {
      throw new InvalidInputError("Missing service id or ids");
    }

    // find all services data that match the provided ids or id
    const services = await Promise.all(
      input.serviceIds.map((id) => deps.findService(id)),
    );

    const activeService = services.find((s) => s && !s.deletedAt && s.isActive);
    // couldn't find a single active service
    if (!activeService) {
      throw new ServiceInactiveError();
    }

    // 2. Validate customer exists
    const customer = await deps.findCustomer(input.customerId);
    if (!customer) {
      throw new CustomerNotFoundError(input.customerId);
    }
    // calculate the time slot
    const start = new Date(input.appointmentAt);
    const totalDuration = services
      .filter((s): s is ServiceData => s !== null)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    const end = new Date(start.getTime() + totalDuration * 60 * 1000);

    // 3. Slot alignment check
    BookingPolicy.assertSlotAlignment(start);

    // 4. Business hours check
    const dayOfWeek = start.getDay();
    const businessHours = await deps.findBusinessHours(dayOfWeek);
    if (!businessHours) {
      throw new BusinessClosedError();
    }
    BookingPolicy.assertWithinBusinessHours(start, end, businessHours);

    // 5. Conflict detection
    const window = BookingConflictService.buildQueryWindow(start, end);
    const candidates = await deps.findBookingCandidates(
      window.lowerBound,
      window.upperBound,
    );
    const isAvailable = BookingConflictService.isAvailable(
      start,
      end,
      candidates,
    );
    if (!isAvailable) {
      throw new BookingConflictError();
    }

    const totalPrice = services
      .filter((s): s is ServiceData => s !== null)
      .reduce((sum, s) => sum + s.priceKes, 0);

    // 6. Build and return the validated aggregate
    return {
      reference: generateReference(),
      customerId: input.customerId,
      services: services.filter((s): s is ServiceData => s !== null),
      appointmentAt: start,
      durationMinutes: totalDuration,
      priceKes: totalPrice,
      notes: input.notes ?? null,
      actorType: input.actorType,
    };
  },

  /**
   * Validate that a booking can be rescheduled to a new time.
   * Checks: status transition, future date, business hours, slot alignment, conflict detection.
   */
  async validateBookingReschedule(
    booking: { status: string; durationMinutes: number; services?: Array<{ durationMin: number }> },
    input: RescheduleBookingInput,
    deps: Pick<BookingDomainServiceDeps, 'findBusinessHours' | 'findBookingCandidates'>,
  ): Promise<ValidatedReschedule> {
    // 1. Status check
    if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
      throw new InvalidStatusTransitionError(booking.status, "reschedule");
    }

    const newDate = new Date(input.newAppointmentAt);

    // 2. Validate future date
    if (newDate <= new Date()) {
      throw new BookingPastDateError();
    }

    // 3. Calculate total duration from the booking's services
    const totalDuration = booking.services?.reduce(
      (sum: number, bs: { durationMin: number }) => sum + bs.durationMin,
      booking.durationMinutes,
    ) ?? booking.durationMinutes;

    const newEnd = new Date(newDate.getTime() + totalDuration * 60 * 1000);

    // 4. Slot alignment check
    BookingPolicy.assertSlotAlignment(newDate);

    // 5. Business hours check
    const dayOfWeek = newDate.getDay();
    const businessHours = await deps.findBusinessHours(dayOfWeek);
    if (!businessHours) {
      throw new BusinessClosedError();
    }
    BookingPolicy.assertWithinBusinessHours(newDate, newEnd, businessHours);

    // 6. Conflict detection (exclude the current booking)
    const window = BookingConflictService.buildQueryWindow(newDate, newEnd);
    const candidates = await deps.findBookingCandidates(
      window.lowerBound,
      window.upperBound,
      { excludeId: input.id },
    );
    const isAvailable = BookingConflictService.isAvailable(
      newDate,
      newEnd,
      candidates,
    );
    if (!isAvailable) {
      throw new BookingConflictError();
    }

    return {
      id: input.id,
      newAppointmentAt: newDate,
      durationMinutes: totalDuration,
      rescheduledById: input.rescheduledById,
      actorType: input.actorType,
      reason: input.reason,
    };
  },

  /**
   * Validate that a booking can be cancelled.
   * Checks: status transition (can't cancel CANCELLED or COMPLETED).
   */
  async validateBookingCancel(
    booking: { status: string },
    input: CancelBookingInput,
  ): Promise<ValidatedCancel> {
    if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
      throw new InvalidStatusTransitionError(booking.status, "cancel");
    }

    return {
      id: input.id,
      actorType: input.actorType,
      reason: input.reason,
      fromStatus: booking.status,
    };
  },
};