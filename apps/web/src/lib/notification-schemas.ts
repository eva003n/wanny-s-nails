import { z } from "zod";

export const NotificationStatusSchema = z.enum([
  "SCHEDULED",
  "PENDING",
  "QUEUED",
  "PROCESSING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "DEAD_LETTER",
  "CANCELLED",
]);

export const NotificationChannelSchema = z.enum([
  "WHATSAPP",
  "EMAIL",
  "PUSH",
]);

export const NotificationTypeSchema = z.enum([
  "BOOKING_CREATED",
  "BOOKING_PENDING_CONFIRMATION",
  "BOOKING_CONFIRMED",
  "BOOKING_REJECTED",
  "BOOKING_CANCELLED",
  "BOOKING_RESCHEDULED",
  "BOOKING_COMPLETED",
  "BOOKING_NO_SHOW",
  "APPOINTMENT_REMINDER",
  "PAYMENT_REQUEST",
  "PAYMENT_RECEIVED",
  "PAYMENT_REFUNDED",
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",
  "REVIEW_RECEIPT",
  "THANK_YOU",
  "FEEDBACK_REQUEST",
  "REVIEW_REQUEST",
]);

export const NotificationRecipientSchema = z.enum([
  "OWNER",
  "STAFF",
  "CLIENT",
]);

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  recipientId: z.string(),
  recipientType: NotificationRecipientSchema,
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema,
  payload: z.any(),
  metadata: z.any().nullable().optional(),
  status: NotificationStatusSchema,
  scheduledAt: z.string().datetime().nullable().optional(),
  sentAt: z.string().datetime().nullable().optional(),
  deliveredAt: z.string().datetime().nullable().optional(),
  readAt: z.string().datetime().nullable().optional(),
  failedAt: z.string().datetime().nullable().optional(),
  lastError: z.string().nullable().optional(),
  correlationId: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  booking: z.object({
    id: z.string().uuid(),
    reference: z.string(),
  }).optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const NotificationListSchema = z.object({
  data: z.array(NotificationSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
  }).optional(),
});

export const UnreadCountSchema = z.object({
  count: z.number().int().nonnegative(),
});