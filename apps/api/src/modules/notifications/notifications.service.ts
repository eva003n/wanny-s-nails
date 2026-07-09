/**
 *  Notification Orchestration
 *
 * Single entry point for all notification dispatching.
 *
 * Non-negotiable ordering:
 *   1. Write the DB row (upsert with idempotencyKey)
 *   2. Enqueue the BullMQ job
 *   3. Update status → 'queued'
 *
 * This is NOT a fire-and-forget helper. Every domain event that needs to
 * notify someone goes through dispatch().
 */
import { prisma, logger } from "../../shared/lib/index.js";

import { normalizeKenyanPhone } from "@wannys-nails/packages";
import { notificationQueue } from "../../shared/lib/index.js";

import {
  NOTIFICATION_TRIGGERS,
  evaluateCondition,
  type NotificationContext,
  type NotificationEventType,
  type RecipientConfig,
} from "./notification-triggers.js";
import { renderTemplateForChannel } from "./templates/registry.js";

const log = logger.child({ module: "notifications.service" });

// ─── Notification Job Data ─────────────────────────────────────

export interface NotificationJobData {
  notificationId: string;
  recipientId: string;
  recipientType: string;
  channel: string;
  template: string;
  payload: Record<string, unknown>;
  endpoint: {
    /** Phone number (E.164) without "+" sign, email address, or push subscription ID */
    address: string;
    type: "phone" | "email" | "push_subscription";
  };
  eventType: string;
  bookingId: string;
}

// ─── Dispatch ──────────────────────────────────────────────────

/**
 * Dispatch a notification event to all configured recipients.
 *
 * Safe to call multiple times for the same event — the upsert with idempotencyKey
 * prevents duplicate rows and won't reset an already-sent status.
 */
export async function dispatch(
  eventType: NotificationEventType,
  context: NotificationContext,
): Promise<void> {
  const trigger = NOTIFICATION_TRIGGERS[eventType];
  if (!trigger) {
    log.warn(
      { event: "dispatch.unknown_type", eventType },
      "No trigger registered for event type",
    );
    return;
  }

  log.info(
    { event: "dispatch.start", eventType, bookingId: context.bookingId },
    "Dispatching notifications",
  );

  for (const recipientConfig of trigger.recipients) {
    try {
      // 1. Evaluate condition
      const rc = recipientConfig as RecipientConfig;
      if (rc.condition && !evaluateCondition(rc.condition, context)) {
        log.debug(
          {
            event: "dispatch.condition_skipped",
            condition: rc.condition,
            recipientType: rc.type,
          },
          "Condition not met — skipping recipient",
        );
        continue;
      }

      // 2. Resolve recipient endpoint
      const endpoint = await resolveEndpoint(
        recipientConfig.type,
        recipientConfig.channel,
        context,
      );
      if (!endpoint) {
        log.warn(
          {
            event: "dispatch.no_endpoint",
            recipientType: recipientConfig.type,
            channel: recipientConfig.channel,
            bookingId: context.bookingId,
          },
          "No active endpoint for recipient — skipping",
        );
        continue;
      }

      // 3. Generate idempotency key
      const idempotencyKey = `${context.bookingId}.${eventType}.${recipientConfig.channel}.${recipientConfig.type}`;

      // Check for an already-processed notification BEFORE writing/enqueuing,
      // so retried events don't re-send something already processed

      const existing = await prisma.notification.findUnique({
        where: { idempotencyKey },
      });

      if (
        existing &&
        [
          "QUEUED",
          "SENT",
          "PROCESSING",
          "DELIVERED",
          "READ",
          "DEAD_LETTER",
        ].includes(existing.status)
      ) {
        log.info(
          {
            event: "schedule.already_processed",
            notificationId: existing.id,
            status: existing.status,
          },
          "Notification already sent or in-flight — skipping",
        );
        continue;
      }
      // 4. Render template
      const payload = renderTemplateForChannel(
        recipientConfig.template,
        context as unknown as Record<string, unknown>,
      );

      // 5. Resolve recipientId
      const recipientId =
        endpoint.type === "push_subscription"
          ? endpoint.address // push subscriptions use userId as recipientId
          : context.customerId;

      // 6. Write DB row (upsert — idempotent)if failed mark as pending
      const notification = await prisma.notification.upsert({
        where: { idempotencyKey },
        create: {
          bookingId: context.bookingId,
          recipientId,
          recipientType: recipientConfig.type,
          type: eventType as any,
          channel: recipientConfig.channel as any,
          payload: payload as any,
          idempotencyKey,
          status: "PENDING",
          correlationId: context.bookingId,
        },
        update: {
          payload: payload as any,
          status: "PENDING",
        }, 
      });

      const jobId = `${recipientConfig.channel.toLowerCase()}.${notification.id}`;

      // 7. Enqueue the job with deterministic jobId for dedup
      try {
        await notificationQueue.add(
          `send-${recipientConfig.channel.toLowerCase()}`,
          {
            notificationId: notification.id,
            recipientId,
            recipientType: recipientConfig.type,
            channel: recipientConfig.channel,
            template: recipientConfig.template,
            payload,
            endpoint,
            eventType,
            bookingId: context.bookingId,
          } satisfies NotificationJobData,
          { jobId },
        );
      } catch (enqueueError: unknown) {
        // DB row exists as PENDING but nothing is behind it — mark it FAILED
        // instead of leaving it stranded, so a reconciliation sweep or retry
        // can pick it back up.
        const err = enqueueError as { message?: string };
        log.error(
          {
            event: "dispatch.enqueue_failed",
            notificationId: notification.id,
            bookingId: context.bookingId,
            error: err.message,
          },
          "Failed to enqueue notification job after DB write — marking as FAILED",
        );
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "FAILED" },
        });
        throw enqueueError; // bubble up to outer catch for consistent logging
      }

      // 8. Update status → queued
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "QUEUED" },
      });

      log.info(
        {
          event: "dispatch.enqueued",
          notificationId: notification.id,
          channel: recipientConfig.channel,
          recipientType: recipientConfig.type,
          bookingId: context.bookingId,
        },
        "Notification enqueued",
      );
    } catch (error) {
      log.error(
        {
          event: "dispatch.recipient_failed",
          recipientType: recipientConfig.type,
          channel: recipientConfig.channel,
          error: error instanceof Error ? error.message : String(error),
          bookingId: context.bookingId,
        },
        "Failed to dispatch for recipient",
      );
      // Don't fail the entire dispatch — other recipients may succeed
    }
  }
}

// ─── Endpoint Resolution ───────────────────────────────────────

interface ResolvedEndpoint {
  /** Phone (E.164) no + sign, email, or subscription userId */
  address: string;
  type: "phone" | "email" | "push_subscription";
}

async function resolveEndpoint(
  recipientType: string,
  channel: string,
  context: NotificationContext,
): Promise<ResolvedEndpoint | null> {
  if (channel === "WHATSAPP") {
    const raw = context.customerPhone;
    if (!raw) throw new Error("Missing customer phone");

    return { address: normalizeKenyanPhone(raw), type: "phone" };
  }

  if (channel === "EMAIL") {
    return context.customerEmail
      ? { address: context.customerEmail, type: "email" }
      : null;
  }

  if (channel === "PUSH") {
    // Find active push subscriptions for admin users
    const userIds = context.adminUserIds;
    if (!userIds || userIds.length === 0) {
      log.debug(
        { event: "resolve_endpoint.no_admin_users" },
        "No admin user IDs for push notification",
      );
      return null;
    }

    // For push, we use the first admin userId as the address and the processor will look up subscriptions
    return { address: userIds[0] as string, type: "push_subscription" };
  }

  return null;
}

// ─── Push Notification Helpers ─────────────────────────────────

function getPushTitle(template: string, context: NotificationContext): string {
  const titles: Record<string, string> = {
    new_booking_alert: `New Booking from ${context.customerName}`,
    booking_awaiting_approval: `${context.customerName}'s booking needs approval`,
    booking_confirmed_alert: `Booking Confirmed: ${context.customerName}`,
    booking_rejected_alert: `Booking Rejected: ${context.customerName}`,
    booking_cancelled_alert: `Booking Cancelled: ${context.customerName}`,
    booking_rescheduled_alert: `Booking Rescheduled: ${context.customerName}`,
    booking_completed_alert: `Completed: ${context.customerName}`,
    booking_no_show_alert: `No Show: ${context.customerName}`,
    payment_received_alert: `Payment Received: KES ${context.amountKes?.toLocaleString() ?? 0}`,
    payment_failed_alert: `Payment Failed: ${context.customerName}`,
    payment_expired_alert: `Payment Expired: ${context.customerName}`,
    refund_processed_alert: `Refund Processed: KES ${context.amountKes?.toLocaleString() ?? 0}`,
  };
  return titles[template] ?? `Notification — ${context.customerName}`;
}

function getPushBody(template: string, context: NotificationContext): string {
  const bodies: Record<string, string> = {
    new_booking_alert: `${context.customerName} booked ${context.serviceName}${context.appointmentAt ? ` on ${formatDate(context.appointmentAt)}` : ""}.`,
    booking_awaiting_approval: `${context.customerName} — ${context.serviceName} on ${formatDate(context.appointmentAt ?? "")}.`,
    booking_confirmed_alert: `${context.customerName} — ${context.serviceName} on ${formatDate(context.appointmentAt ?? "")}.`,
    booking_rejected_alert: `${context.customerName}'s booking for ${context.serviceName} was rejected.`,
    booking_cancelled_alert: `${context.customerName} cancelled ${context.serviceName} on ${formatDate(context.appointmentAt ?? "")}.`,
    booking_rescheduled_alert: `${context.customerName} rescheduled ${context.serviceName} to ${formatDate(context.appointmentAt ?? "")}.`,
    booking_completed_alert: `${context.customerName}'s ${context.serviceName} appointment is complete.`,
    booking_no_show_alert: `${context.customerName} missed their ${context.serviceName} appointment.`,
    payment_received_alert: `KES ${context.amountKes?.toLocaleString() ?? 0} received from ${context.customerName} for ${context.serviceName}.`,
    payment_failed_alert: `Payment of KES ${context.amountKes?.toLocaleString() ?? 0} from ${context.customerName} failed.`,
    payment_expired_alert: `Payment request for ${context.customerName} — ${context.serviceName} expired.`,
    refund_processed_alert: `KES ${context.amountKes?.toLocaleString() ?? 0} refunded to ${context.customerName}.`,
  };
  return bodies[template] ?? `Notification update for ${context.customerName}.`;
}

function getPushUrl(eventType: string, context: NotificationContext): string {
  if (eventType.startsWith("BOOKING") || eventType.startsWith("APPOINTMENT")) {
    return `/bookings/${context.bookingId}`;
  }
  if (eventType.startsWith("PAYMENT")) {
    return `/payments?bookingId=${context.bookingId}`;
  }
  return "/dashboard";
}

// ─── Scheduling (Reminders) ─────────────────────────────────────

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
  const idempotencyKey = `${params.bookingId}.${params.eventType}.${params.channel}.${params.recipientType}`;
  const delayMs = params.scheduledAt.getTime() - Date.now();

  log.info({
    event: "schedule.requested",
    bookingId: params.bookingId,
    delayMs,
    scheduledAt: params.scheduledAt,
  });

  if (delayMs <= 0) {
    log.info(
      {
        event: "schedule.past_time",
        bookingId: params.bookingId,
        eventType: params.eventType,
      },
      "Schedule time already passed — dispatching immediately",
    );
    await dispatch(params.eventType, params.context);
    return;
  }

  const renderedPayload = renderTemplateForChannel(
    params.template,
    params.context as unknown as Record<string, unknown>,
  );

  // Check the existing row (if any) BEFORE upserting, so we can tell apart:
  //  - no row yet                -> fresh schedule
  //  - SCHEDULED / CANCELLED     -> safe to (re)schedule, reset to SCHEDULED
  //  - QUEUED / SENT / PROCESSING / FAILED / READ / DELIVERED -> already fired or in-flight, don't touch
  const existing = await prisma.notification.findUnique({
    where: { idempotencyKey },
  });

  if (
    existing &&
    [
      "QUEUED",
      "SENT",
      "PROCESSING",
      "FAILED",
      "DELIVERED",
      "READ",
      "DEAD_LETTER",
    ].includes(existing.status)
  ) {
    log.info(
      {
        event: "schedule.already_processed",
        notificationId: existing.id,
        status: existing.status,
      },
      "Notification already sent or in-flight — skipping",
    );
    return;
  }

  const notification = await prisma.notification.upsert({
    where: { idempotencyKey },
    create: {
      bookingId: params.bookingId,
      recipientId: params.context.customerId,
      recipientType: params.recipientType as any,
      type: params.eventType as any,
      channel: params.channel as any,
      payload: renderedPayload as any,
      idempotencyKey,
      status: "SCHEDULED",
      scheduledAt: params.scheduledAt,
      correlationId: params.bookingId,
    },
    // Covers both "reschedule of a still-pending reminder" and
    // "reschedule after a CANCELLED reminder" (booking time changed) —
    // in both cases reset to SCHEDULED with the fresh time/payload.
    // Safe because we already excluded  QUEUED / SENT / PROCESSING / FAILED / READ / DELIVERED above.
    update: {
      scheduledAt: params.scheduledAt,
      payload: renderedPayload as any,
      status: "SCHEDULED",
    },
  });

  const jobId = `scheduled.${notification.id}`;

  try {
    await notificationQueue.add(
      `send-${params.channel.toLowerCase()}`,
      {
        notificationId: notification.id,
        recipientId: params.context.customerId,
        recipientType: params.recipientType,
        channel: params.channel,
        template: params.template,
        payload: renderedPayload,
        endpoint: {
          address: params.context.customerPhone,
          type: "phone",
        },
        eventType: params.eventType,
        bookingId: params.bookingId,
      } satisfies NotificationJobData,
      {
        delay: Math.max(delayMs, 1000),
        jobId,
      },
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    log.error(
      {
        event: "schedule.enqueue_failed",
        notificationId: notification.id,
        bookingId: params.bookingId,
        error: err.message,
      },
      "Failed to enqueue notification job after DB write — marking as FAILED",
    );
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED" },
    });
    throw error;
  }

  log.info(
    {
      event: "schedule.enqueued",
      notificationId: notification.id,
      bookingId: params.bookingId,
      scheduledAt: params.scheduledAt,
    },
    "Scheduled notification enqueued",
  );
}

/**
 * Schedule 24h appointment reminders for a booking.
 * Should be called when a booking is confirmed.
 */
export async function scheduleAppointmentReminders(
  bookingId: string,
  appointmentAt: Date,
): Promise<void> {
  const now = new Date();

  const twentyFourHoursBefore = new Date(
    appointmentAt.getTime() - 24 * 60 * 60 * 1000,
  );

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, service: true },
  });

  if (!booking) {
    log.warn(
      { event: "schedule.reminders.booking_not_found", bookingId },
      "Cannot schedule reminders — booking not found",
    );
    return;
  }

  const context: NotificationContext = {
    bookingId: booking.id,
    customerId: booking.customerId,
    customerName: booking.customer.name,
    customerPhone: booking.customer.phone,
    customerEmail: booking.customer.email ?? (undefined as unknown as string),
    serviceName: booking.service.name,
    appointmentAt: booking.appointmentAt.toISOString(),
    amountKes: booking.priceKes,
  };

  if (twentyFourHoursBefore > now) {
    await schedule({
      bookingId,
      eventType: "APPOINTMENT_REMINDER",
      recipientType: "CLIENT",
      channel: "WHATSAPP",
      scheduledAt: twentyFourHoursBefore,
      template: "reminder_24h",
      context,
    });
  }
}

/**
 * Cancel all scheduled reminders for a booking when it is rescheduled,
 * then schedule fresh ones at the new time.
 */
export async function onBookingRescheduled(
  bookingId: string,
  newAppointmentAt: Date,
): Promise<void> {
  const existingReminders = await prisma.notification.findMany({
    where: {
      bookingId,
      type: "APPOINTMENT_REMINDER",
      status: "SCHEDULED",
    },
  });

  for (const reminder of existingReminders) {
    try {
      // Must match the jobId format used in schedule(): "scheduled.<id>"
      await notificationQueue.remove(`scheduled.${reminder.id}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.warn(
        {
          event: "reschedule.queue_remove_failed",
          notificationId: reminder.id,
          bookingId,
          error: err.message,
        },
        "Failed to remove old reminder job from queue — it may have already fired or been removed",
      );
      // Continue anyway — we still want to mark it CANCELLED and schedule the new one.
    }
  }

  if (existingReminders.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: existingReminders.map((r) => r.id) } },
      data: { status: "CANCELLED" },
    });
  }

  await scheduleAppointmentReminders(bookingId, newAppointmentAt);
}

/**
 * Cancel all scheduled reminders for a booking when it is cancelled.
 * Prevents orphaned reminder jobs from firing after cancellation.
 */
export async function onBookingCancelled(bookingId: string): Promise<void> {
  const scheduledReminders = await prisma.notification.findMany({
    where: {
      bookingId,
      type: "APPOINTMENT_REMINDER",
      status: "SCHEDULED",
    },
  });

  for (const reminder of scheduledReminders) {
    try {
      // remove both scheduled and  immediate(awiting processing) notifications
      await notificationQueue.remove(`scheduled.${reminder.id}`);
      await notificationQueue.remove(`whatsapp.${reminder.id}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.warn(
        {
          event: "cancel.queue_remove_failed",
          notificationId: reminder.id,
          bookingId,
          error: err.message,
        },
        "Failed to remove reminder job from queue — it may have already fired or been removed",
      );
    }
  }

  // update them to cancelled if they exists
  if (scheduledReminders.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: scheduledReminders.map((r) => r.id) } },
      data: { status: "CANCELLED" },
    });
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-KE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
