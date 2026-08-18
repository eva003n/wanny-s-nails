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
  // missedBookingSchema
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


// PATCH /api/v1/bookings/:id
router.patch(
  "/:id",
  authenticate,
  validate({ params: uuidParamSchema, body: bookingsController.updateBookingSchema }),
  idempotencyMiddleware,
  bookingsController.updateBooking,
);



// DELETE /api/v1/bookings/:id — soft delete (OWNER only)
router.delete("/:id", authenticate, requireRole("OWNER"), validate({ params: uuidParamSchema }), bookingsController.softDeleteBooking);

export { router as bookingsRoutes };
