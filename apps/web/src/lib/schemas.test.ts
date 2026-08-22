import { describe, it, expect } from 'vitest';
import {
  BookingSchema,
  BookingListSchema,
  CustomerSchema,
  ServiceSchema,
  UserSchema,
  PaymentSchema,
  PaymentTransactionSchema,
  DashboardStatsSchema,
} from '@/lib/schemas';
import type { BookingStatus, PaymentStatus, UserRole, ServiceCategory } from '@/lib/schemas';

describe('BookingSchema', () => {
  const validBooking = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    reference: 'BK-001',
    status: 'PENDING' as BookingStatus,
    paymentStatus: 'PENDING' as PaymentStatus,
    appointmentAt: '2025-01-15T10:00:00Z',
    priceKes: 1500,
    durationMinutes: 60,
    customer: { id: '111e4567-e89b-12d3-a456-426614174001', name: 'Jane', phone: '0712345678' },
    service: { id: '222e4567-e89b-12d3-a456-426614174002', name: 'Manicure' },
    payment: null,
    notes: null,
    createdAt: '2025-01-15T10:00:00Z',
  };

  it('accepts a valid booking', () => {
    expect(() => BookingSchema.parse(validBooking)).not.toThrow();
  });

  it('rejects an invalid payment status', () => {
    const bad = { ...validBooking, paymentStatus: 'INVALID' };
    expect(() => BookingSchema.parse(bad)).toThrow();
  });

  it('rejects negative price', () => {
    const bad = { ...validBooking, priceKes: -1 };
    expect(() => BookingSchema.parse(bad)).toThrow();
  });
});

describe('BookingListSchema', () => {
  it('validates an array of bookings', () => {
    const data = [{
      id: '123e4567-e89b-12d3-a456-426614174000',
      reference: 'BK-001',
      status: 'APPROVED',
      paymentStatus: 'SUCCESS',
      appointmentAt: '2025-01-15T10:00:00Z',
      priceKes: 1200,
      durationMinutes: 45,
      customer: { id: '111e4567-e89b-12d3-a456-426614174001', name: 'A', phone: '07' },
      service: { id: '222e4567-e89b-12d3-a456-426614174002', name: 'B' },
      payment: null,
      notes: null,
      createdAt: '2025-01-15T10:00:00Z',
    }];
    expect(() => BookingListSchema.parse(data)).not.toThrow();
  });
});

describe('CustomerSchema', () => {
  it('accepts a valid customer', () => {
    const customer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      phone: '0712345678',
      name: 'Jane Doe',
      email: 'jane@example.com',
      totalBookings: 5,
      totalSpentKes: 7500,
      lastBookingAt: '2025-01-10T08:00:00Z',
      createdAt: '2024-12-01T08:00:00Z',
    };
    expect(() => CustomerSchema.parse(customer)).not.toThrow();
  });

  it('rejects a non-string email', () => {
    const customer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      phone: '0712345678',
      name: 'Jane',
      email: 12345,
      createdAt: '2024-12-01T08:00:00Z',
    };
    expect(() => CustomerSchema.parse(customer)).toThrow();
  });

  it('accepts null email', () => {
    const customer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      phone: '0712345678',
      name: 'Jane',
      email: null,
      createdAt: '2024-12-01T08:00:00Z',
    };
    expect(() => CustomerSchema.parse(customer)).not.toThrow();
  });
});

describe('ServiceSchema', () => {
  it('accepts a valid service', () => {
    const service = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Gel Pedicure',
      description: 'Long-lasting gel',
      category: 'PEDICURE' as ServiceCategory,
      durationMinutes: 90,
      priceKes: 2000,
      isActive: true,
      sortOrder: 1,
    };
    expect(() => ServiceSchema.parse(service)).not.toThrow();
  });
});

describe('UserSchema', () => {
  it('accepts an OWNER user', () => {
    const user = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Wanny',
      email: 'wanny@example.com',
      role: 'OWNER' as UserRole,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    };
    expect(() => UserSchema.parse(user)).not.toThrow();
  });
});

describe('PaymentSchema', () => {
  it('accepts a valid payment', () => {
    const payment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'SUCCESS' as PaymentStatus,
      mpesaReceiptNumber: 'ABC123',
      amountKes: 1500,
      createdAt: '2025-01-15T10:00:00Z',
    };
    expect(() => PaymentSchema.parse(payment)).not.toThrow();
  });
});

describe('PaymentTransactionSchema', () => {
  it('accepts a valid transaction', () => {
    const tx = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      bookingId: 'booking-1',
      booking: { id: 'booking-1', reference: 'BK-1', service: { id: '111e4567-e89b-12d3-a456-426614174003', name: 'S' } },
      customer: { id: '222e4567-e89b-12d3-a456-426614174004', name: 'Jane', phone: '07' },
      amountKes: 1500,
      status: 'SUCCESS' as PaymentStatus,
      mpesaReceiptNumber: 'XYZ789',
      method: 'MPESA',
      createdAt: '2025-01-15T10:00:00Z',
    };
    expect(() => PaymentTransactionSchema.parse(tx)).not.toThrow();
  });
});

describe('DashboardStatsSchema', () => {
  it('accepts valid stats', () => {
    const stats = {
      todayBookingsCount: 3,
      pendingCount: 1,
      todayRevenueKes: 4500,
      unpaidKes: 1200,
      weekRevenueKes: 20000,
      monthRevenueKes: 75000,
    };
    expect(() => DashboardStatsSchema.parse(stats)).not.toThrow();
  });
});