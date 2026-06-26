/**
 * Notification Routes — admin-facing endpoints
 */
import { Router } from "express";
import {
  authenticate,
  requireRole,
} from "../../shared/middleware/auth.middleware.js";
import * as notificationsController from "./notifications.controller.js";

const router: ReturnType<typeof Router> = Router();


// ── Notification record routes ────────────────────────────

// GET /api/v1/notifications — paginated, filterable notification list
router.get("/", authenticate, requireRole("OWNER"), notificationsController.listNotifications);

// GET /api/v1/notifications/dead-letters — dead-letter queue
router.get("/dead-letters", authenticate, requireRole("OWNER"), notificationsController.listDeadLetters);

// GET /api/v1/notifications/:id — single notification detail
router.get("/:id", authenticate, notificationsController.getNotification);

// POST /api/v1/notifications/:id/retry — retry a dead-letter notification
router.post("/:id/retry", authenticate, requireRole("OWNER"), notificationsController.retryNotification);

export { router as notificationsRoutes };