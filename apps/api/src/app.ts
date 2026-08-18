import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

// Middlewares
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/requestId.middleware.js";
import { globalRateLimit } from "./shared/middleware/rateLimit.middleware.js";

// Routes
import { authRoutes } from "./modules/auth/auth.routes.js";
import { servicesRoutes } from "./modules/services/services.routes.js";
import { customersRoutes } from "./modules/customers/customers.routes.js";
import { slotsRoutes } from "./modules/slots/slots.routes.js";
import { bookingsRoutes } from "./modules/bookings/bookings.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { webhooksRoutes } from "./modules/webhooks/webhooks.routes.js";
import { notificationsRoutes } from "./modules/notifications/notifications.routes.js";
import { eventsRoutes } from "./modules/events/events.routes.js";
import { pushSubscriptionsRoutes } from "./modules/push-subscriptions/push-subscriptions.routes.js";
import { healthRoutes } from "./modules/v1/health/health.routes.js";
import { businessHoursRoutes } from "./modules/business-hours/business-hours.routes.js";
import { logMiddleware } from "./shared/middleware/log.middleware.js";
import { _config } from "./shared/lib/index.js";
import { notFound } from "./shared/middleware/404.middleware.js";
import { groupedBoard } from "./shared/lib/index.js";

/**
 * Create the Express application.
 *
 * Kept as a factory (per TESTING.md §4.1) so Supertest can run the app
 * entirely in-process without binding to a port. The production entry
 * (`index.ts`) is responsible for creating the HTTP server and listening.
 */
export function createApp() {
  const app = express();

  // express app is behind a proxy(trust first proxy hoop)
  app.set("trust proxy", 1);
  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: _config.CORS_ORIGIN.split(","),
      credentials: true,
    }),
  );

  // parse cookie
  app.use(cookieParser(_config.COOKIE_SECRET.split(",")));

  // Raw body for webhook signature verification
  app.use(
    express.json({
      limit: "16kb",
      verify: (req, _res, buf) => {
        (req as unknown as Record<string, unknown>).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  // serve static assets
  app.use(express.static("public"))
  // X-Request-ID middleware (runs on every request)
  app.use(requestIdMiddleware);

  // Global rate limiter
  app.use(globalRateLimit);

  // HTTP request logging
  app.use(logMiddleware);


  // Bull mq queues UI
  app.use("/api/v1/admin/queues", groupedBoard.getRouter())

  // Health check endpoint (public, no auth)
  // app.use("/health", healthRoutes);
  app.use("/api/v1/health", healthRoutes);

  // Webhook endpoints (public, no JWT, use HMAC/IP validation)
  app.use("/api/v1/webhooks", webhooksRoutes);



  // API routes (authenticated)
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/services", servicesRoutes);
  app.use("/api/v1/customers", customersRoutes);
  app.use("/api/v1/slots", slotsRoutes);
  app.use("/api/v1/bookings", bookingsRoutes);
  app.use("/api/v1/payments", paymentsRoutes);
  app.use("/api/v1/dashboard", dashboardRoutes);
  app.use("/api/v1/notifications", notificationsRoutes);
  app.use("/api/v1/push-subscriptions", pushSubscriptionsRoutes);
  app.use("/api/v1/business-hours", businessHoursRoutes);
  app.use("/api/v1/events", eventsRoutes);

  app.use(notFound);
  // Global error handler (must be last)
  app.use(errorMiddleware);

  return app;
}

export default createApp;