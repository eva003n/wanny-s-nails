/**
 * PWA Push Subscription endpoints
 *
 * Standard Web Push API endpoints for registering, refreshing, and
 * unsubscribing push notification subscriptions.
 */
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import { success, noContent } from "../../../shared/utils/response.js";
import { pushSubscriptionsService } from "./push-subscriptions.service.js";

// ─── Schemas ───────────────────────────────────────────────────

export const createSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
});

export const refreshSubscriptionSchema = z.object({
  oldEndpoint: z.string().optional(),
  newSubscription: z.object({
    endpoint: z.string().url(),
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// ─── Handlers ──────────────────────────────────────────────────

/**
 * POST /api/v1/push-subscriptions
 *
 * Save a new push subscription for the authenticated user.
 */
export const createSubscription = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    const input = req.validated!.body as z.infer<typeof createSubscriptionSchema>;

    const result = await pushSubscriptionsService.create(userId, input);
    success(res, result);
  },
);

/**
 * POST /api/v1/push-subscriptions/refresh
 *
 * Update a push subscription (called when the service worker detects
 * a `pushsubscriptionchange` event).
 */
export const refreshSubscription = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    const input = req.validated!.body as z.infer<typeof refreshSubscriptionSchema>;

    const result = await pushSubscriptionsService.refresh(
      userId,
      input.oldEndpoint,
      input.newSubscription,
    );
    success(res, result);
  },
);

/**
 * DELETE /api/v1/push-subscriptions/unsubscribe
 *
 * Deactivate a push subscription by endpoint sent in the request body.
 */
export const unsubscribeSubscription = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    const input = req.validated!.body as z.infer<typeof unsubscribeSchema>;

    const result = await pushSubscriptionsService.unsubscribe(userId, input.endpoint);

    if (result === null) {
      res.status(404).json({ error: "Subscription not found" });
      return;
    }

    noContent(res);
  },
);

/**
 * GET /api/v1/push-subscriptions
 *
 * List all active push subscriptions for the authenticated user.
 */
export const listSubscriptions = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    const subscriptions = await pushSubscriptionsService.list(userId);
    success(res, subscriptions);
  },
);