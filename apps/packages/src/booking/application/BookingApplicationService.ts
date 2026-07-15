import {
  BookingDomainService,
  type BookingDomainServiceDeps,
} from "../domain/BookingDomainService.js";
import type { CreateBookingInput, BookingResult } from "../types.js";
import type { UnitOfWork } from "../ports/UnitOfWork.js";
import type { BookingRepository } from "../ports/BookingRepository.js";
import type { ServiceRepository } from "../ports/ServiceRepository.js";
import type { CustomerRepository } from "../ports/CustomerRepository.js";
import type { BusinessHoursRepository } from "../ports/BusinessHoursRepository.js";

export interface CreateBookingResult {
  booking: BookingResult;
}

/**
 * Application service that orchestrates the booking creation workflow.
 *
 * Responsibilities:
 * 1. Accept input from API controller or Worker
 * 2. Call BookingDomainService to validate business rules
 * 3. Execute persistence within a UnitOfWork transaction
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
   * Shared entry point for both the API controller and the WhatsApp Worker.
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
          serviceId: validated.serviceId,
          appointmentAt: validated.appointmentAt,
          durationMinutes: validated.durationMinutes,
          priceKes: validated.priceKes,
          notes: validated.notes,
        },
        ctx,
      );
    });

    // 3. Load customer and service details for the result
    const [customer, service] = await Promise.all([
      this.deps.customerRepository.findById(saved.customerId),
      this.deps.serviceRepository.findById(saved.serviceId),
    ]);

    // 4. Build and return result DTO
    return {
      id: saved.id,
      reference: saved.reference,
      customerId: saved.customerId,
      serviceId: saved.serviceId,
      appointmentAt: saved.appointmentAt,
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
      service: {
        id: saved.serviceId,
        name: service?.name ?? "",
      },
      payment: null,
    };
  }
}