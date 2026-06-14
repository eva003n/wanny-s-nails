import { Router } from "express";
import {
  authenticate,
  requireRole,
} from "../../shared/middleware/auth.middleware.js";
import { idempotencyMiddleware } from "../../shared/middleware/idempotency.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import * as bookingsController from "./bookings.controller.js";
import {
  createBookingSchema,
  cancelSchema,
  rescheduleSchema,
  markPaidSchema,
  patchNotesSchema,
} from "./bookings.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/bookings — paginated, filterable list
router.get("/", authenticate, bookingsController.listBookings);

// GET /api/v1/bookings/today
router.get("/today", authenticate, bookingsController.getTodayBookings);

// GET /api/v1/bookings/:id
router.get("/:id", authenticate, bookingsController.getBookingById);

// POST /api/v1/bookings — create booking
router.post("/", authenticate, validate(createBookingSchema), bookingsController.createBooking);

// POST /api/v1/bookings/:id/approve
router.post(
  "/:id/approve",
  authenticate,
  requireRole("OWNER", "STAFF"),
  idempotencyMiddleware,
  bookingsController.approveBooking,
);

// POST /api/v1/bookings/:id/cancel
router.post(
  "/:id/cancel",
  authenticate,
  validate(cancelSchema),
  idempotencyMiddleware,
  bookingsController.cancelBooking,
);

// POST /api/v1/bookings/:id/reschedule
router.post(
  "/:id/reschedule",
  authenticate,
  validate(rescheduleSchema),
  idempotencyMiddleware,
  bookingsController.rescheduleBooking,
);

// PATCH /api/v1/bookings/:id — update notes only
router.patch("/:id", authenticate, validate(patchNotesSchema), bookingsController.updateBookingNotes);

// POST /api/v1/bookings/:id/mark-paid
router.post(
  "/:id/mark-paid",
  authenticate,
  requireRole("OWNER"),
  validate(markPaidSchema),
  bookingsController.markBookingPaid,
);

// DELETE /api/v1/bookings/:id — soft delete (OWNER only)
router.delete("/:id", authenticate, requireRole("OWNER"), bookingsController.softDeleteBooking);

export { router as bookingsRoutes };