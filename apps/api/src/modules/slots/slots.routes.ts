import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import * as slotsController from "./slots.controller.js";
import { availabilitySchema } from "./slots.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/slots/availability
router.get(
  "/availability",
  authenticate,
  validate(availabilitySchema),
  slotsController.getAvailability,
);

export { router as slotsRoutes };