/**
 * Shared DTOs and value objects for the booking module.
 */

export interface CreateBookingInput {
  customerId: string;
  serviceId: string;
  appointmentAt: string; // ISO 8601
  notes?: string | null;
}

export interface BookingResult {
  id: string;
  reference: string;
  customerId: string;
  serviceId: string;
  appointmentAt: Date;
  durationMinutes: number;
  priceKes: number;
  status: string;
  paymentStatus: string;
  notes: string | null;
  customer: { id: string; name: string; phone: string };
  service: { id: string; name: string };
  payment: { id: string; amountKes: number; status: string } | null;
}

export interface ServiceData {
  id: string;
  name: string;
  durationMinutes: number;
  priceKes: number;
  isActive: boolean;
  deletedAt: Date | null;
}

export interface CustomerData {
  id: string;
  name: string;
  phone: string;
}

export interface BusinessHoursData {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isActive: boolean;
}

export interface BookingCandidate {
  appointmentAt: Date;
  durationMinutes: number;
}

export interface StatusHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  actorId?: string | null;
  reason?: string | null;
}

export const SLOT_GRANULARITY_MINUTES = 15;
export const MAX_SERVICE_MINUTES = 240;