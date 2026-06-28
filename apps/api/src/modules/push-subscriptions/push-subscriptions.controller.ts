/**
 * PWA Push Subscription endpoints
 *
 * Standard Web Push API endpoints for registering, refreshing, and
 * unsubscribing push notification subscriptions.
 */
import type { Request, Response, NextFunction } from "express";
import { logger } from "../../shared/lib/index.js";

import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { success, noContent } from "../../shared/utils/response.js";
import { z } from "zod";
import {prisma} from "../../shared/lib/index.js"

const log = logger.child({ module: "push-subscriptions.controller" });

// ─── Schemas ───────────────────────────────────────────────────

export const createSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

// ─── Handlers ──────────────────────────────────────────────────

/**
 * POST /api/v1/push-subscriptions
 *
 * Save a new push subscription for the authenticated user.
 */
export const createSubscription = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user!.userId;
  const body = req.body as CreateSubscriptionInput;

  // Upsert: if the same endpoint already exists, update the keys
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: {
      p256dh: body.p256dh,
      auth: body.auth,
      userAgent: body.userAgent ?? null,
      isActive: true,
    },
    create: {
      userId,
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      userAgent: body.userAgent ?? null,
      isActive: true,
    },
  });

  log.info(
    { event: "push_subscription.created", userId, subscriptionId: subscription.id },
    "Push subscription saved",
  );

  success(res, { id: subscription.id });
});

/**
 * POST /api/v1/push-subscriptions/refresh
 *
 * Update a push subscription (called when the service worker detects
 * a `pushsubscriptionchange` event).
 */
export const refreshSubscription = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user!.userId;
  const { oldEndpoint, newSubscription } = req.body as {
    oldEndpoint?: string;
    newSubscription?: { endpoint: string; p256dh: string; auth: string };
  };

  if (!newSubscription?.endpoint) {
    res.status(400).json({ error: "newSubscription with endpoint is required" });
    return;
  }

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

  success(res, { id: subscription.id });
});

/**
 * DELETE /api/v1/push-subscriptions/:id
 *
 * Remove a push subscription.
 */
export const deleteSubscription = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user!.userId;
  const subscriptionId = req.params.id;

  // Ensure the subscription belongs to the current user
  const sub = await prisma.pushSubscription.findFirst({
    where: { id: subscriptionId as string, userId: userId as string },
  });

  if (!sub) {
    res.status(404).json({ error: "Subscription not found" });
    return;
  }

  await prisma.pushSubscription.update({
    where: { id: subscriptionId as string },
    data: { isActive: false },
  });

  log.info(
    { event: "push_subscription.deleted", userId, subscriptionId },
    "Push subscription deactivated",
  );

  noContent(res);
});

/**
 * GET /api/v1/push-subscriptions
 *
 * List all active push subscriptions for the authenticated user.
 */
export const listSubscriptions = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user!.userId;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, isActive: true },
    select: { id: true, endpoint: true, userAgent: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  success(res, subscriptions);
});