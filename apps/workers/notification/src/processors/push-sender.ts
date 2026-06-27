/**
 * Push notification sender — sends Web Push notifications via VAPID.
 *
 * §7 PWA Push Delivery (admin-facing)
 *
 * Handles:
 *  - Sending push notifications to all active subscriptions for a user
 *  - Marking subscriptions inactive on 410/404 (unsubscribed)
 *  - Updating notification DB records
 */

import { type Job } from "bullmq";
import { prisma, logger } from "@wannys-nails/packages";
import type { NotificationJobData } from "@wannys-nails/packages";
import { config } from "../config.js";

const log = logger.child({ module: "job:push" });


interface PushPayload {
  title: string;
  body: string;
  icon: string;
  data: {
    url: string;
    notificationId: string;
  };
  tag: string;
}

export async function pushSender(job: Job<NotificationJobData>): Promise<void> {
  const { notificationId, recipientId, template, payload, bookingId } = job.data;

  log.info(
    { event: "push.job.start", jobId: job.id, notificationId, recipientId },
    "Processing push notification job",
  );

  // Find all active push subscriptions for this user
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: recipientId,
      isActive: true,
    },
  });

  if (subscriptions.length === 0) {
    log.warn(
      { event: "push.no_active_subscriptions", userId: recipientId, notificationId },
      "No active push subscriptions found",
    );
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "FAILED", lastError: "no_active_subscriptions" },
    });
    return;
  }

  // Build the push payload
  const pushPayload: PushPayload = {
    title: (payload.title as string) || "Wanny's Nails",
    body: (payload.body as string) || "",
    icon: "/icons/icon-192.png",
    data: {
      url: getBookingUrl(bookingId),
      notificationId,
    },
    tag: notificationId, // collapses duplicate notifications for the same event
  };

  let sentCount = 0;
  let failCount = 0;

  for (const sub of subscriptions) {
    try {
      await sendPushToSubscription(sub, pushPayload);
      sentCount++;
    } catch (error) {
      failCount++;
      // If the error indicates the subscription is no longer valid, mark it inactive
      if (error instanceof PushSubscriptionError && (error.statusCode === 410 || error.statusCode === 404)) {
        log.warn(
          { event: "push.subscription_gone", subscriptionId: sub.id, userId: recipientId },
          "Push subscription no longer valid — marking inactive",
        );
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { isActive: false },
        });
      }
    }
  }

  // Update notification status
  if (sentCount > 0) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lastError: failCount > 0 ? `${failCount} subscription(s) failed` : undefined,
      },
    });
    log.info(
      { event: "push.job.success", jobId: job.id, notificationId, sentCount, failCount },
      "Push notification sent",
    );
  } else if (failCount > 0 && sentCount === 0) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "FAILED", lastError: "all_subscriptions_failed" },
    });
    log.error(
      { event: "push.job.all_failed", jobId: job.id, notificationId, failCount },
      "All push subscriptions failed",
    );
  }
}

/**
 * Send a push notification to a single subscription using web-push.
 * Uses dynamic import so the worker can start without the web-push dependency
 * if not used.
 */
async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<void> {
  // Dynamic import of web-push to avoid requiring it at startup
  const webpush = await import("web-push");

  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);

  try {
    await webpush.default.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      },
      JSON.stringify(payload),
    );
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode === 410 || err.statusCode === 404) {
      throw new PushSubscriptionError(err.statusCode, err.message || "Subscription not found");
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

function getBookingUrl(bookingId: string): string {
  return `/bookings/${bookingId}`;
}