import { z } from "zod";

// ---------- Enums ----------

export const BookingStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
  "RESCHEDULED",
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const PaymentStatusSchema = z.enum([
  "PENDING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const UserRoleSchema = z.enum(["OWNER", "STAFF"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Service categories — must match the Prisma enum exactly so the frontend
 * can create/edit services without validation errors.
 *
 * Prisma enum: MANICURE | PEDICURE | ENHANCEMENTS | NAIL_ART | EXTENSIONS | REMOVAL | REPAIR | TREATMENT
 */
export const ServiceCategorySchema = z.enum([
  "MANICURE",
  "PEDICURE",
  "ENHANCEMENTS",
  // "NAIL_ART",
  // "EXTENSIONS",
  "REMOVAL",
  // "REPAIR",
  // "TREATMENT",
]);
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;

// ─── Nested / shared shapes ─────────────────────────────────────────────────

export const CustomerRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
});

export type CustomerRef = z.infer<typeof CustomerRefSchema>;

export const ServiceRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export type ServiceRef = z.infer<typeof ServiceRefSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  status: PaymentStatusSchema,
  mpesaReceiptNumber: z.string().nullable(),
  amountKes: z.number().int().positive(),
  createdAt: z.string().datetime(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["ADMIN", "OWNER", "STAFF"]),
  isActive: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

// ─── Slots / availability schemas ────────────────────────────────────────────

export const TimeSlotSchema = z.object({
  time: z.string(),
  available: z.boolean(),
  appointmentAt: z.string(),
});
export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const AvailableSlotsResponseSchema = z.object({
  date: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  durationMinutes: z.number().int().positive(),
  totalSlots: z.number().int().nonnegative(),
  availableSlots: z.number().int().nonnegative(),
  slots: z.array(TimeSlotSchema),
});
export type AvailableSlotsResponse = z.infer<
  typeof AvailableSlotsResponseSchema
>;

// ─── Response schemas ───────────────────────────────────────────────────────

export const BookingSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  status: BookingStatusSchema,
  paymentStatus: PaymentStatusSchema,
  appointmentAt: z.string().datetime(),
  priceKes: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  customer: CustomerRefSchema,
  service: ServiceRefSchema,
  payment: PaymentSchema.nullable().optional(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const BookingListSchema = z.array(BookingSchema);

export const StatusHistoryEntrySchema = z.object({
  id: z.string(),
  status: BookingStatusSchema,
  actor: z.string(),
  reason: z.string().nullable(),
  createdAt: z.string(),
});
export type StatusHistoryEntry = z.infer<typeof StatusHistoryEntrySchema>;

export const CustomerSchema = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  totalBookings: z.number().int().nonnegative().optional(),
  totalSpentKes: z.number().int().nonnegative().optional(),
  lastBookingAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const ServiceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  category: ServiceCategorySchema,
  durationMinutes: z.number().int().positive(),
  priceKes: z.number().int().positive(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSchema,
});

export const MeResponseSchema = z.object({
  data: UserSchema,
});

export const PaginatedUsersSchema = z.object({
  data: z.array(UserSchema),
});

export const PaginatedBookingsSchema = z.object({
  data: z.array(BookingSchema),
  meta: z
    .object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
      hasNextPage: z.boolean(),
      hasPrevPage: z.boolean(),
    })
    .optional(),
});

export const PaginatedCustomersSchema = z.object({
  data: z.array(CustomerSchema),
  meta: z
    .object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
      hasNextPage: z.boolean(),
      hasPrevPage: z.boolean(),
    })
    .optional(),
});

export const PaginatedServicesSchema = z.object({
  data: z.array(ServiceSchema),
});

// ─── Payment transaction schemas ─────────────────────────────────────────────

export const PaymentTransactionSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  phoneNumber: z.string(),
  booking: z.object({
    id: z.string(),
    reference: z.string(),
    service: ServiceRefSchema,
  }),
  customer: CustomerRefSchema,
  amountKes: z.number().int().positive(),
  status: PaymentStatusSchema,
  mpesaReceiptNumber: z.string().nullable(),
  method: z.enum(["MPESA", "CASH"]),
  createdAt: z.string(),
});
export type PaymentTransaction = z.infer<typeof PaymentTransactionSchema>;

export const PaginatedPaymentsMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export const PaginatedPaymentsSchema = z.object({
  data: z.array(PaymentTransactionSchema),
  meta: PaginatedPaymentsMetaSchema.optional(),
});

export const PaymentListSchema = z.array(PaymentTransactionSchema);

export const DashboardStatsSchema = z.object({
  todayBookingsCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  todayRevenueKes: z.number().int().nonnegative(),
  unpaidKes: z.number().int().nonnegative(),
  weekRevenueKes: z.number().int().nonnegative(),
  monthRevenueKes: z.number().int().nonnegative(),
});
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

// ─── Derived types (inferred from schemas) ──────────────────────────────────

export type Booking = z.infer<typeof BookingSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type User = z.infer<typeof UserSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type BookingFilters = {
  tab?: "today" | "all";
  status?: string;
  paymentStatus?: string;
  page?: number;
  limit?: number;
};