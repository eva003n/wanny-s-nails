import { Router } from "express";
import { authenticate, requireRole } from "../../../shared/middleware/auth.middleware.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";
import { updateHoursSchema } from "./business-hours.controller.js";
import * as businessHoursController from "./business-hours.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/business-hours
router.get("/", authenticate, businessHoursController.getHours);

// PATCH /api/v1/business-hours — owner only
router.patch(
  "/",
  authenticate,
  requireRole("OWNER"),
  validate(updateHoursSchema),
  businessHoursController.updateHours,
);

export { router as businessHoursRoutes };