/**
 * Push Subscription Routes
 */
import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import * as pushSubscriptionsController from "./push-subscriptions.controller.js";

const router: ReturnType<typeof Router> = Router();

// POST /api/v1/push-subscriptions — save a new subscription
router.post(
  "/",
  authenticate,
  validate(pushSubscriptionsController.createSubscriptionSchema),
  pushSubscriptionsController.createSubscription,
);

// POST /api/v1/push-subscriptions/refresh — update on pushsubscriptionchange
router.post(
  "/refresh",
  authenticate,
  pushSubscriptionsController.refreshSubscription,
);

// DELETE /api/v1/push-subscriptions/:id — remove a subscription
router.delete(
  "/:id",
  authenticate,
  pushSubscriptionsController.deleteSubscription,
);

// GET /api/v1/push-subscriptions — list active subscriptions
router.get(
  "/",
  authenticate,
  pushSubscriptionsController.listSubscriptions,
);

export { router as pushSubscriptionsRoutes };