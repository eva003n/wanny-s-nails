import { Router } from "express";
import { healthRoutes } from "./health/health.routes.js";
import { webhooksRoutes } from "./webhooks/webhooks.routes.js";
import { authRoutes } from "./auth/auth.routes.js";
import { servicesRoutes } from "./services/services.routes.js";
import { customersRoutes } from "./customers/customers.routes.js";
import { slotsRoutes } from "./slots/slots.routes.js";
import { bookingsRoutes } from "./bookings/bookings.routes.js";
import { paymentsRoutes } from "./payments/payments.routes.js";
import { dashboardRoutes } from "./dashboard/dashboard.routes.js";
import { notificationsRoutes } from "./notifications/notifications.routes.js";
import { pushSubscriptionsRoutes } from "./push-subscriptions/push-subscriptions.routes.js";
import { businessHoursRoutes } from "./business-hours/business-hours.routes.js";
import { eventsRoutes } from "./events/events.routes.js";

const router: ReturnType<typeof Router> = Router();

// Health check endpoint (public, no auth)
router.use("/health", healthRoutes);

// Webhook endpoints (public, no JWT, use HMAC/IP validation)
router.use("/webhooks", webhooksRoutes);

// API routes (authenticated)
router.use("/auth", authRoutes);
router.use("/services", servicesRoutes);
router.use("/customers", customersRoutes);
router.use("/slots", slotsRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/payments", paymentsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/push-subscriptions", pushSubscriptionsRoutes);
router.use("/business-hours", businessHoursRoutes);
router.use("/events", eventsRoutes);

export { router as v1Routes };
