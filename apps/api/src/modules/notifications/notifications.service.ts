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
    log.warn({ event: "dispatch.unknown_type", eventType }, "No trigger registered for event type");
    return;
  }

  log.info(
    { event: "dispatch.start", eventType, bookingId: context.bookingId },
    "Dispatching notifications",
  );

  for (const recipientConfig of trigger.recipients) {
    try {
      // 1. Evaluate condition
      const rc = recipientConfig as RecipientConfig & { condition?: string };
      if (rc.condition && !evaluateCondition(rc.condition, context)) {
        log.debug(
          { event: "dispatch.condition_skipped", condition: rc.condition, recipientType: rc.type },
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
          { event: "dispatch.no_endpoint", recipientType: recipientConfig.type, channel: recipientConfig.channel, bookingId: context.bookingId },
          "No active endpoint for recipient — skipping",
        );
        continue;
      }

      // 3. Generate idempotency key
      const idempotencyKey = `${context.bookingId}.${eventType}.${recipientConfig.channel}.${recipientConfig.type}`;

      // 4. Render template
      const payload = renderTemplateForChannel(recipientConfig.template, context as unknown as Record<string, unknown>);

      // 5. Resolve recipientId
      const recipientId = endpoint.type === "push_subscription"
        ? endpoint.address // push subscriptions use userId as recipientId
        : context.customerId;

      // 6. Write DB row (upsert — idempotent)
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
        update: {}, // no-op: if it already exists, don't reset status
      });

      // 7. Enqueue the job
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
      );

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
    const raw = context.customerPhone ?? "";
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
      log.debug({ event: "resolve_endpoint.no_admin_users" }, "No admin user IDs for push notification");
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