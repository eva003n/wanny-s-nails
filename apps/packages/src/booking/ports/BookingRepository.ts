import type { BookingCandidate, ServiceData } from "../types.js";

export interface CreateBookingRecord {
  reference: string;
  customerId: string;
  appointmentAt: Date;
  durationMinutes: number;
  priceKes: number;
  notes: string | null;
  services: Array<ServiceData>;
  actorType: string
}

export interface BookingRepository {
  /**
   * Find candidate bookings that could overlap with a given time window.
   * Used by the conflict detection service.
   */
  findCandidates(
    lowerBound: Date,
    upperBound: Date,
    options?: { excludeId?: string },
  ): Promise<BookingCandidate[]>;

  /**
   * Persist a new booking record.
   */
  save(
    data: CreateBookingRecord,
    ctx?: unknown,
  ): Promise<{
    id: string;
    reference: string;
    customerId: string;
    appointmentAt: Date;
    durationMinutes: number;
    priceKes: number;
    status: string;
    paymentStatus: string;
    notes: string | null;
    services: ServiceData[]
  }>;
}
