import { Router } from "express";
import {
  authenticate,
  requireRole,
} from "../../shared/middleware/auth.middleware.js";
import * as notificationsController from "./notifications.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/notifications/reminders — paginated, filterable
router.get(
  "/reminders",
  authenticate,
  requireRole("OWNER"),
  notificationsController.listReminders,
);

export { router as notificationsRoutes };