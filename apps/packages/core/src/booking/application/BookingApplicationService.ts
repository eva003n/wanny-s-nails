import {
  BookingDomainService,
  type BookingDomainServiceDeps,
} from "../domain/BookingDomainService.js";
import type { CreateBookingInput, BookingResult, RescheduleBookingInput, CancelBookingInput, ServiceData } from "../types.js";
import type { UnitOfWork } from "../ports/UnitOfWork.js";
import type { BookingRepository } from "../ports/BookingRepository.js";
import type { ServiceRepository } from "../ports/ServiceRepository.js";
import type { CustomerRepository } from "../ports/CustomerRepository.js";
import type { BusinessHoursRepository } from "../ports/BusinessHoursRepository.js";

export interface CreateBookingResult {
  booking: BookingResult;
}

/**
 * Application service that orchestrates the booking  workflow.
 *
 * Responsibilities:
 * 1. Accept input from API controller or Worker
 * 2. Call BookingDomainService to validate business rules(Domain layer)
 * 3. Execute persistence within a UnitOfWork transaction(persistence layer)
 * 4. Return the result
 *
 * Contains NO business rules and NO direct Prisma calls.
 */
export class BookingApplicationService {
  constructor(
    private readonly deps: {
      unitOfWork: UnitOfWork;
      bookingRepository: BookingRepository;
      serviceRepository: ServiceRepository;
      customerRepository: CustomerRepository;
      businessHoursRepository: BusinessHoursRepository;
    },
  ) {}

  /**
   * Create a new booking.
   * Shared entry point for both the API controller and the WhatsApp Worker(bot).
   */
  async create(input: CreateBookingInput): Promise<BookingResult> {
    // Build domain service deps from the repositories
    const domainDeps: BookingDomainServiceDeps = {
      findService: (id) => this.deps.serviceRepository.findById(id),
      findCustomer: (id) => this.deps.customerRepository.findById(id),
      findBusinessHours: (dayOfWeek) =>
        this.deps.businessHoursRepository.findByDayOfWeek(dayOfWeek),
      findBookingCandidates: (lowerBound, upperBound, options) =>
        this.deps.bookingRepository.findCandidates(
          lowerBound,
          upperBound,
          options,
        ),
    };

    // 1. Validate business rules and build the booking aggregate
    const validated = await BookingDomainService.validateAndBuild(
      input,
      domainDeps,
    );

    // 2. Persist within a transaction
    const saved = await this.deps.unitOfWork.execute(async (ctx) => {
      return this.deps.bookingRepository.save(
        {
          reference: validated.reference,
          customerId: validated.customerId,
          services: validated.services,
          appointmentAt: validated.appointmentAt,
          durationMinutes: validated.durationMinutes,
          priceKes: validated.priceKes,
          notes: validated.notes,
          actorType: validated.actorType

        },
        ctx,
      );
    });

    // 3. Load customer and service details for the result
    const customer = await 
      this.deps.customerRepository.findById(saved.customerId);

    // 4. Build and return result DTO matching the frontend BookingSchema
    return {
      id: saved.id,
      reference: saved.reference,
      customerId: saved.customerId,
      services: saved.services.map((s) => ({
        service: { id: s.id, name: s.name },
      })),
      appointmentAt: saved.appointmentAt.toISOString(),
      durationMinutes: saved.durationMinutes,
      priceKes: saved.priceKes,
      status: saved.status,
      paymentStatus: saved.paymentStatus,
      notes: saved.notes,
      customer: {
        id: saved.customerId,
        name: customer?.name ?? "",
        phone: customer?.phone ?? "",
      },
      payment: null,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  /**
   * Reschedule a booking to a new date/time.
   * Shared entry point for both the API controller and the WhatsApp Worker.
   */
  async reschedule(input: RescheduleBookingInput): Promise<BookingResult> {
    // 1. Fetch the existing booking
    const booking = await this.deps.bookingRepository.getById(input.id);
    if (!booking) {
      throw new Error("BookingNotFound");
    }

    // 2. Build domain service deps for validation
    const domainDeps: Pick<BookingDomainServiceDeps, 'findBusinessHours' | 'findBookingCandidates'> = {
      findBusinessHours: (dayOfWeek) =>
        this.deps.businessHoursRepository.findByDayOfWeek(dayOfWeek),
      findBookingCandidates: (lowerBound, upperBound, options) =>
        this.deps.bookingRepository.findCandidates(
          lowerBound,
          upperBound,
          options,
        ),
    };

    // 3. Map services for domain validation (ServiceData has durationMinutes, domain expects durationMin)
    const bookingForDomain = {
      ...booking,
      services: booking.services?.map((s: ServiceData) => ({
        durationMin: s.durationMinutes,
        name: s.name,
      })),
    };

    // 4. Validate business rules
    const validated = await BookingDomainService.validateBookingReschedule(
      bookingForDomain,
      input,
      domainDeps,
    );

    // 5. Persist within a transaction
    const saved = await this.deps.unitOfWork.execute(async (ctx) => {
      return this.deps.bookingRepository.update(
        {
          id: validated.id,
          status: "RESCHEDULED",
          appointmentAt: validated.newAppointmentAt,
          statusHistory: {
            fromStatus: booking.status,
            toStatus: "RESCHEDULED",
            actorType: validated.actorType as "USER" | "CUSTOMER",
            actorId: validated.rescheduledById,
            reason: validated.reason ?? null,
          },
        },
        ctx,
      );
    });

    // 6. Load customer details for the result
    const customer = await this.deps.customerRepository.findById(saved.customerId);

    return {
      id: saved.id,
      reference: saved.reference,
      customerId: saved.customerId,
      services: saved.services.map((s) => ({
        service: { id: s.id, name: s.name },
      })),
      appointmentAt: saved.appointmentAt.toISOString(),
      durationMinutes: saved.durationMinutes,
      priceKes: saved.priceKes,
      status: saved.status,
      paymentStatus: saved.paymentStatus,
      notes: saved.notes,
      customer: {
        id: saved.customerId,
        name: customer?.name ?? "",
        phone: customer?.phone ?? "",
      },
      payment: null,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  /**
   * Cancel a booking.
   * Shared entry point for both the API controller and the WhatsApp Worker.
   */
  async cancel(input: CancelBookingInput): Promise<BookingResult> {
    // 1. Fetch the existing booking
    const booking = await this.deps.bookingRepository.getById(input.id);
    if (!booking) {
      throw new Error("BookingNotFound");
    }

    // 2. Validate business rules
    const validated = await BookingDomainService.validateBookingCancel(
      booking,
      input,
    );

    // 3. Persist within a transaction
    const saved = await this.deps.unitOfWork.execute(async (ctx) => {
      return this.deps.bookingRepository.update(
        {
          id: validated.id,
          status: "CANCELLED",
          statusHistory: {
            fromStatus: validated.fromStatus,
            toStatus: "CANCELLED",
            actorType: validated.actorType as "USER" | "CUSTOMER",
            reason: validated.reason ?? null,
          },
        },
        ctx,
      );
    });

    // 4. Load customer details for the result
    const customer = await this.deps.customerRepository.findById(saved.customerId);

    return {
      id: saved.id,
      reference: saved.reference,
      customerId: saved.customerId,
      services: saved.services.map((s) => ({
        service: { id: s.id, name: s.name },
      })),
      appointmentAt: saved.appointmentAt.toISOString(),
      durationMinutes: saved.durationMinutes,
      priceKes: saved.priceKes,
      status: saved.status,
      paymentStatus: saved.paymentStatus,
      notes: saved.notes,
      customer: {
        id: saved.customerId,
        name: customer?.name ?? "",
        phone: customer?.phone ?? "",
      },
      payment: null,
      createdAt: saved.createdAt.toISOString(),
    };
  }
}