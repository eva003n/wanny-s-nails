/**
 * Push notification sender — sends Web Push notifications via VAPID.
 *
 * §7 PWA Push Delivery (admin-facing)
 *
 * Handles:
 *  - Sending push notifications to all active subscriptions for a user
 *  - Marking subscriptions inactive on 410/404 (unsubscribed)
 *  - Updating notification DB records
 *  - TTL and urgency headers based on priority
 *  - Payload serialized ONCE outside the fan-out loop
 */

import { type Job } from "bullmq";

import { log as logger } from "../lib/index.js";
import { _config as config } from "../lib/config.js";

import type { NotificationJobData } from "@wannys-nails/core";
import { prisma } from "../lib/prisma.js";

const log = logger.child({ module: "job:push" });

interface PushPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  data: {
    url: string;
    notificationId: string;
  };
  tag: string;
  priority?: "high" | "normal" | "low";
}

interface SubscriptionFailure {
  subscriptionId: string;
  endpoint: string; // truncated, no PII/secrets
  statusCode?: number;
  message: string;
}

export async function pushSender(job: Job<NotificationJobData>): Promise<void> {
  const { notificationId, recipientId, template, payload, bookingId,  } =
    job.data;

  log.info(
    { event: "push.job.start", jobId: job.id, notificationId, recipientId },
    "Processing push notification job",
  );

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: recipientId, isActive: true },
  });

  if (subscriptions.length === 0) {
    log.warn(
      {
        event: "push.no_active_subscriptions",
        userId: recipientId,
        notificationId,
      },
      "No active push subscriptions found",
    );
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "FAILED", lastError: "no_active_subscriptions" },
    });
    return;
  }

  const pushPriority = getPushPriority(template);

  const pushPayload: PushPayload = {
    title: "Wanny's Nails",
    body: getPushBody(template, payload),
    icon: "/icons/192.png",
    badge: "/icons/badge-96.png",
    data: {
      url: getBookingUrl(bookingId),
      notificationId,
    },
    tag: notificationId,
    priority: pushPriority,
  };

  const serializedPayload = JSON.stringify(pushPayload);
  const ttl = getTTLForPriority(pushPriority);
  const urgency = mapPriorityToUrgency(pushPriority);

  const failures: SubscriptionFailure[] = [];
  let sentCount = 0;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await sendPushToSubscription(
          sub,
          serializedPayload,
          ttl,
          urgency,
          pushPayload.tag,
        );
        sentCount++;
      } catch (error: unknown) {
        const err = error as {
          statusCode?: number;
          message?: string;
          stack?: string;
        };
        const failure: SubscriptionFailure = {
          subscriptionId: sub.id,
          endpoint: truncateEndpoint(sub.endpoint),
          statusCode: err.statusCode,
          message: err.message ?? String(error),
        };
        failures.push(failure);

        // Log EVERY individual failure — this is what was missing before.
        // Previously this only logged for the 410/404 branch, so any other
        // error (network, VAPID, unexpected 4xx/5xx) was silently dropped
        // whenever at least one other subscription succeeded.
        log.warn(
          {
            event: "push.subscription_failed",
            notificationId,
            subscriptionId: sub.id,
            endpoint: failure.endpoint,
            statusCode: err.statusCode,
            error: err.message,
            stack: err.stack,
          },
          "Push send failed for subscription",
        );

        if (
          error instanceof PushSubscriptionError &&
          (error.statusCode === 410 || error.statusCode === 404)
        ) {
          log.info(
            {
              event: "push.subscription_gone",
              subscriptionId: sub.id,
              userId: recipientId,
            },
            "Push subscription no longer valid — marking inactive",
          );
          try {
            await prisma.pushSubscription.update({
              where: { id: sub.id },
              data: { isActive: false },
            });
          } catch (updateError: unknown) {
            // Don't let a failure to mark the subscription inactive get lost —
            // this used to be an unhandled rejection inside the catch handler.
            const uErr = updateError as { message?: string };
            log.error(
              {
                event: "push.subscription_deactivate_failed",
                subscriptionId: sub.id,
                error: uErr.message,
              },
              "Failed to mark stale push subscription inactive",
            );
          }
        }
      }
    }),
  );

  const failCount = failures.length;

  if (sentCount > 0) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        // Use null (not undefined) so a fully-successful retry clears any
        // stale error from a previous partial failure.
        lastError: failCount > 0 ? summarizeFailures(failures) : null,
      },
    });
    log.info(
      {
        event: "push.job.success",
        jobId: job.id,
        notificationId,
        sentCount,
        failCount,
        failures,
      },
      failCount > 0
        ? "Push notification partially sent"
        : "Push notification sent",
    );
    return;
  }

  // sentCount === 0 — everything failed
  const summary = summarizeFailures(failures);
  await prisma.notification.update({
    where: { id: notificationId },
    data: { status: "FAILED", lastError: summary },
  });
  log.error(
    {
      event: "push.job.all_failed",
      jobId: job.id,
      notificationId,
      failCount,
      failures,
    },
    "All push subscriptions failed",
  );
  throw new Error(`All push subscriptions failed: ${summary}`);
}

/**
 * Send a push notification to a single subscription using web-push.
 * Includes TTL and urgency headers based on priority.
 */
async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  serializedPayload: string,
  ttl: number,
  urgency: "very-low" | "low" | "normal" | "high",
  topic: string,
): Promise<void> {
  const webpush = await import("web-push");
  const client = webpush.default

  client.setVapidDetails(
    config.VAPID_SUBJECT,
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY,
  );

  try {
    await client.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      serializedPayload,
      { TTL: ttl, urgency },
    );
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode === 410 || err.statusCode === 404) {
      throw new PushSubscriptionError(
        err.statusCode,
        err.message || "Subscription not found",
      );
    }
    if (err.statusCode === 429) {
      log.warn(
        {
          event: "push.rate_limited",
          endpoint: truncateEndpoint(sub.endpoint),
        },
        "Push service rate limit hit",
      );
    }
    throw error; // Let BullMQ retry transient failures
  }
}

class PushSubscriptionError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "PushSubscriptionError";
    this.statusCode = statusCode;
  }
}

function getPushPriority(template: string): "high" | "normal" | "low" {
  const highPriority = [
    "new_booking_alert",
    "booking_confirmation",
    "booking_cancelled_alert",
    "payment_received_alert",
    "refund_processed_alert",
  ];
  const lowPriority = [
    "slot_released_alert",
    "booking_completed_alert",
    "booking_no_show_alert",
  ];

  if (highPriority.includes(template)) return "high";
  if (lowPriority.includes(template)) return "low";
  return "normal";
}

function getTTLForPriority(priority: "high" | "normal" | "low"): number {
  switch (priority) {
    case "high":
      return 4 * 60 * 60;
    case "normal":
      return 60 * 60;
    case "low":
      return 15 * 60;
  }
}

function mapPriorityToUrgency(
  priority: "high" | "normal" | "low",
): "very-low" | "low" | "normal" | "high" {
  switch (priority) {
    case "high":
      return "high";
    case "normal":
      return "normal";
    case "low":
      return "low";
  }
}

function getBookingUrl(bookingId: string): string {
  return `/bookings/${bookingId}`;
}

/** Strips the endpoint down to origin + short hash so logs don't leak full push URLs. */
function truncateEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const idPart = url.pathname.slice(-8);
    return `${url.origin}/…${idPart}`;
  } catch {
    return "unknown-endpoint";
  }
}

function summarizeFailures(failures: SubscriptionFailure[]): string {
  return failures
    .map(
      (f) =>
        `${f.subscriptionId}${f.statusCode ? `(${f.statusCode})` : ""}: ${f.message}`,
    )
    .join("; ")
    .slice(0, 1000); // keep it bounded for a text column
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

export interface NotificationContext {
  // bookingId: string;
  // customerId: string;
  /** Display name for the customer */
  customerName: string;
  /** E.164 phone no plus sign */
  // customerPhone: string;
  /** Email if on file */
  customerEmail?: string;
  serviceName: string;
  /** ISO datetime string */
  appointmentAt?: string;
  /** Amount in KES */
  amountKes?: number;
  /** For PAYMENT_RECEIVED — M-Pesa receipt number */
  mpesaReceiptNumber?: string;
  /** For PAYMENT_REFUNDED — refund reference */
  refundReference?: string;
  /** Original appointment time (for reschedule) */
  previousAppointmentAt?: string;
  /** Admin user IDs to notify (for push/email) */
  adminUserIds?: string[];
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

/* function getPushUrl(eventType: string, context: NotificationContext): string {
  if (eventType.startsWith("BOOKING") || eventType.startsWith("APPOINTMENT")) {
    return `/bookings/${context.bookingId}`;
  }
  if (eventType.startsWith("PAYMENT")) {
    return `/payments?bookingId=${context.bookingId}`;
  }
  return "/dashboard";
} */