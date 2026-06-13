import { createServer } from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";

// Middlewares
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/requestId.js";
import { globalRateLimit } from "./shared/middleware/rateLimit.js";

// Routes
import { authRoutes } from "./modules/auth/auth.routes.js";
import { servicesRoutes } from "./modules/services/services.routes.js";
import { customersRoutes } from "./modules/customers/customers.routes.js";
import { slotsRoutes } from "./modules/slots/slots.routes.js";
import { bookingsRoutes } from "./modules/bookings/bookings.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { webhooksRoutes } from "./modules/webhooks/webhooks.routes.js";
import { notificationsRoutes } from "./modules/notifications/notifications.routes.js";
import { eventsRoutes } from "./modules/events/events.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { logMiddleware } from "./shared/middleware/log.middleware.js";
import { config } from "./shared/lib/config.js";

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.CORS_ORIGIN.split(","),
    credentials: true,
  }),
);

// Raw body for webhook signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as unknown as Record<string, unknown>).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// X-Request-ID middleware (runs on every request)
app.use(requestIdMiddleware);

// Global rate limiter
app.use(globalRateLimit);

// HTTP request logging
app.use(logMiddleware);

// Health check endpoint (public, no auth)
app.use("/health", healthRoutes);
app.use("/api/v1/health", healthRoutes);

// Webhook endpoints (public, no JWT, use HMAC/IP validation)
app.use("/api/v1/webhooks", webhooksRoutes);

// SSE events endpoint (public with query param token)
app.use("/api/v1/events", eventsRoutes);

// API routes (authenticated)
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/services", servicesRoutes);
app.use("/api/v1/customers", customersRoutes);
app.use("/api/v1/slots", slotsRoutes);
app.use("/api/v1/bookings", bookingsRoutes);
app.use("/api/v1/payments", paymentsRoutes);
app.use("/api/v1/notifications", notificationsRoutes);

// Global error handler (must be last)
app.use(errorMiddleware);

export const server = createServer(app);
