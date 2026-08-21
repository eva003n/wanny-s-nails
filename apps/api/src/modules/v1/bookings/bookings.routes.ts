import { Router } from "express";
import {
  authenticate,
  requireRole,
} from "../../../shared/middleware/auth.middleware.js";
import { idempotencyMiddleware } from "../../../shared/middleware/idempotency.middleware.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";
import * as bookingsController from "./bookings.controller.js";
import {
  createBookingSchema,
  uuidParamSchema,
  listBookingsQuerySchema,
  patchNotesSchema,
  approveSchema,
  cancelSchema,
  rescheduleSchema,
  markPaidSchema,
  noShowSchema,
  completeSchema,
} from "./bookings.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/bookings — paginated, filterable list
router.get("/", authenticate, validate({ query: listBookingsQuerySchema }), bookingsController.listBookings);

// GET /api/v1/bookings/today
router.get("/today", authenticate, bookingsController.getTodayBookings);

// GET /api/v1/bookings/:id
router.get("/:id", authenticate, validate({ params: uuidParamSchema }), bookingsController.getBookingById);

// POST /api/v1/bookings — create booking
router.post("/", authenticate, validate(createBookingSchema), bookingsController.createBooking);


// PATCH /api/v1/bookings/:id — partial edit (notes only)
router.patch(
  "/:id",
  authenticate,
  validate({ params: uuidParamSchema, body: patchNotesSchema }),
  idempotencyMiddleware,
  bookingsController.patchBookingNotes,
);

// POST /api/v1/bookings/:id/approve (OWNER only)
router.post(
  "/:id/approve",
  authenticate,
  requireRole("OWNER"),
  validate({ params: uuidParamSchema, body: approveSchema }),
  idempotencyMiddleware,
  bookingsController.approveBooking,
);

// POST /api/v1/bookings/:id/cancel
router.post(
  "/:id/cancel",
  authenticate,
  validate({ params: uuidParamSchema, body: cancelSchema }),
  idempotencyMiddleware,
  bookingsController.cancelBooking,
);

// POST /api/v1/bookings/:id/reschedule
router.post(
  "/:id/reschedule",
  authenticate,
  validate({ params: uuidParamSchema, body: rescheduleSchema }),
  idempotencyMiddleware,
  bookingsController.rescheduleBooking,
);

// POST /api/v1/bookings/:id/mark-paid (OWNER only)
router.post(
  "/:id/mark-paid",
  authenticate,
  requireRole("OWNER"),
  validate({ params: uuidParamSchema, body: markPaidSchema }),
  idempotencyMiddleware,
  bookingsController.markBookingPaid,
);

// POST /api/v1/bookings/:id/no-show
router.post(
  "/:id/no-show",
  authenticate,
  validate({ params: uuidParamSchema, body: noShowSchema }),
  idempotencyMiddleware,
  bookingsController.markBookingAsMissed,
);

// POST /api/v1/bookings/:id/complete
router.post(
  "/:id/complete",
  authenticate,
  validate({ params: uuidParamSchema, body: completeSchema }),
  idempotencyMiddleware,
  bookingsController.markBookingCompleted,
);

// DELETE /api/v1/bookings/:id — soft delete (OWNER only)
router.delete("/:id", authenticate, requireRole("OWNER"), validate({ params: uuidParamSchema }), bookingsController.softDeleteBooking);

export { router as bookingsRoutes };
