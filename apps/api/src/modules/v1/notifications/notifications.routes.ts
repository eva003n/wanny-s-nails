/**
 * Notification Routes — admin-facing endpoints
 */
import { Router } from "express";
import {
  authenticate,
  requireRole,
} from "../../../shared/middleware/auth.middleware.js";
import * as notificationsController from "./notifications.controller.js";

const router: ReturnType<typeof Router> = Router();


// ── Notification record routes ────────────────────────────

// GET /api/v1/notifications — paginated, filterable notification list
router.get("/", authenticate, requireRole("OWNER"), notificationsController.listNotifications);

// GET /api/v1/notifications/dead-letters — dead-letter queue
router.get("/dead-letters", authenticate, requireRole("OWNER"), notificationsController.listDeadLetters);

// GET /api/v1/notifications/unread-count — unread notification count (before :id route)
router.get("/unread-count", authenticate, notificationsController.unreadCount);

// GET /api/v1/notifications/:id — single notification detail
router.get("/:id", authenticate, notificationsController.getNotification);

// POST /api/v1/notifications/:id/retry — retry a dead-letter notification
router.post("/:id/retry", authenticate, requireRole("OWNER"), notificationsController.retryNotification);

// PATCH /api/v1/notifications/:id/read — mark notification as read
router.patch("/:id/read", authenticate, notificationsController.markAsRead);

export { router as notificationsRoutes };
