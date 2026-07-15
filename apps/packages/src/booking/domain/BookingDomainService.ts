import type { ServiceData, BusinessHoursData, BookingCandidate } from "../types.js";
import { BookingPolicy, BusinessClosedError } from "./BookingPolicy.js";
import { BookingConflictService, BookingConflictError } from "./BookingConflictService.js";

export class ServiceInactiveError extends Error {
  constructor() {
    super("ServiceInactive");
    this.name = "ServiceInactiveError";
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
    options?: { excludeId?: string },
  ): Promise<BookingCandidate[]>;
}

export interface ValidatedBooking {
  customerId: string;
  serviceId: string;
  serviceName: string;
  appointmentAt: Date;
  durationMinutes: number;
  priceKes: number;
  notes: string | null;
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
    input: { customerId: string; serviceId: string; appointmentAt: string; notes?: string | null },
    deps: BookingDomainServiceDeps,
  ): Promise<ValidatedBooking & { reference: string }> {
    // 1. Validate service exists and is active
    const service = await deps.findService(input.serviceId);
    if (!service || service.deletedAt || !service.isActive) {
      throw new ServiceInactiveError();
    }

    // 2. Validate customer exists
    const customer = await deps.findCustomer(input.customerId);
    if (!customer) {
      throw new CustomerNotFoundError(input.customerId);
    }

    const start = new Date(input.appointmentAt);
    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

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
    const candidates = await deps.findBookingCandidates(window.lowerBound, window.upperBound);
    const isAvailable = BookingConflictService.isAvailable(start, end, candidates);
    if (!isAvailable) {
      throw new BookingConflictError();
    }

    // 6. Build and return the validated aggregate
    return {
      reference: generateReference(),
      customerId: input.customerId,
      serviceId: input.serviceId,
      serviceName: service.name,
      appointmentAt: start,
      durationMinutes: service.durationMinutes,
      priceKes: service.priceKes,
      notes: input.notes ?? null,
    };
  },
};