/**
 * Notification Orchestration — API layer
 *
 * Thin wrapper around the shared NotificationService from @wannys-nails/packages.
 * Provides the same public API for backward compatibility.
 */
import { prisma, logger } from "../../shared/lib/index.js";
import { notificationQueue } from "../../shared/lib/index.js";
import { NotificationService } from "@wannys-nails/packages";
import type { NotificationContext, NotificationEventType } from "@wannys-nails/packages";

const log = logger.child({ module: "notifications.service" });

// Singleton instance of the shared notification service
const notificationService = new NotificationService({
  prisma,
  notificationQueue,
  log
});

// ─── Re-exported types ─────────────────────────────────────────

export type { NotificationContext, NotificationEventType };
export type { NotificationJobData } from "@wannys-nails/packages";

// ─── Public API (delegates to shared service) ──────────────────

export async function dispatch(
  eventType: NotificationEventType,
  context: NotificationContext,
): Promise<void> {
  return notificationService.dispatch(eventType, context);
}

export interface ScheduleParams {
  bookingId: string;
  eventType: NotificationEventType;
  recipientType: string;
  channel: string;
  scheduledAt: Date;
  template: string;
  context: NotificationContext;
}

export async function schedule(params: ScheduleParams): Promise<void> {
  return notificationService.schedule(params);
}

export async function onBookingRescheduled(
  bookingId: string,
  newAppointmentAt: Date,
): Promise<void> {
  return notificationService.onBookingRescheduled(bookingId, newAppointmentAt);
}

export async function onBookingCancelled(bookingId: string): Promise<void> {
  return notificationService.onBookingCancelled(bookingId);
}

export async function scheduleAppointmentReminders(
  bookingId: string,
  appointmentAt: Date,
): Promise<void> {
  return notificationService.scheduleAppointmentReminders(bookingId, appointmentAt);
}