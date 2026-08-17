/**
 * Shared DTOs and value objects for the booking module.
 */

type ActorType = "USER" | "CUSTOMER";

export interface CreateBookingInput {
  customerId: string;
  serviceIds: string[]; // multiple services
  appointmentAt: string; // ISO 8601
  actorType: ActorType;
  notes?: string | null;
  stylist?: string | undefined;
}

export interface CancelBookingInput {
  id: string;
  actorType: ActorType;
  reason?: string | undefined;
}

export interface BookingResult {
  id: string;
  reference: string;
  customerId: string;
  appointmentAt: string;
  durationMinutes: number;
  priceKes: number;
  status: string;
  paymentStatus: string;
  notes: string | null;
  customer: { id: string; name: string; phone: string };
  services: Array<{ service: { id: string; name: string } }>;
  payment: { id: string; amountKes: number; status: string } | null;
  createdAt: string;
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
  actorType: ActorType;
  actorId?: string | null;
  reason?: string | null;
}

export interface RescheduleBookingInput {
  id: string;
  newAppointmentAt: string;
  rescheduledById: string;
  actorType: ActorType;
  reason?: string;
}

export const SLOT_GRANULARITY_MINUTES = 15;
export const MAX_SERVICE_MINUTES = 120; // 2 hours