/**
 * Push Subscription Service
 *
 * Business logic for managing Web Push API subscriptions.
 */
import { prisma, logger } from "../../../shared/lib/index.js";

const log = logger.child({ module: "push-subscriptions.service" });

interface CreateSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | undefined;
}

export const pushSubscriptionsService = {
  /**
   * Create or update a push subscription (upsert by endpoint).
   */
  async create(userId: string, input: CreateSubscriptionInput) {
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      update: {
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        isActive: true,
      },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        isActive: true,
      },
    });

    log.info(
      { event: "push_subscription.created", userId, subscriptionId: subscription.id },
      "Push subscription saved",
    );

    return { id: subscription.id };
  },

  /**
   * Refresh a subscription on pushsubscriptionchange event.
   */
  async refresh(
    userId: string,
    oldEndpoint: string | undefined,
    newSubscription: { endpoint: string; p256dh: string; auth: string },
  ) {
    // Deactivate the old subscription if provided
    if (oldEndpoint) {
      await prisma.pushSubscription.updateMany({
        where: { userId, endpoint: oldEndpoint },
        data: { isActive: false },
      });
    }

    // Create or update the new subscription
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint: newSubscription.endpoint },
      update: {
        p256dh: newSubscription.p256dh,
        auth: newSubscription.auth,
        isActive: true,
      },
      create: {
        userId,
        endpoint: newSubscription.endpoint,
        p256dh: newSubscription.p256dh,
        auth: newSubscription.auth,
        isActive: true,
      },
    });

    log.info(
      { event: "push_subscription.refreshed", userId, subscriptionId: subscription.id },
      "Push subscription refreshed",
    );

    return { id: subscription.id };
  },

  /**
   * Unsubscribe (deactivate) a subscription by endpoint belonging to the user.
   */
  async unsubscribe(userId: string, endpoint: string) {
    const sub = await prisma.pushSubscription.findFirst({
      where: { endpoint, userId },
    });

    if (!sub) {
      return null; // not found — caller handles 404
    }

    await prisma.pushSubscription.update({
      where: { id: sub.id },
      data: { isActive: false },
    });

    log.info(
      { event: "push_subscription.deleted", userId, endpoint },
      "Push subscription deactivated",
    );
  },

  /**
   * List all active subscriptions for a user.
   */
  async list(userId: string) {
    return prisma.pushSubscription.findMany({
      where: { userId, isActive: true },
      select: { id: true, endpoint: true, userAgent: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  },
};