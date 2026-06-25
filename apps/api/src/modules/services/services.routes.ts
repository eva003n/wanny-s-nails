import { Router } from "express";
import {
  authenticate,
  requireRole,
} from "../../shared/middleware/auth.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import * as servicesController from "./services.controller.js";
import {
  createServiceSchema,
  updateServiceSchema,
  uuidParamSchema,
} from "./services.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/services
router.get("/", authenticate, servicesController.listServices);

// GET /api/v1/services/:id
router.get("/:id", authenticate, validate({ params: uuidParamSchema }), servicesController.getService);

// POST /api/v1/services - owner only
router.post(
  "/",
  authenticate,
  requireRole("OWNER"),
  validate(createServiceSchema),
  servicesController.createService,
);

// PATCH /api/v1/services/:id - owner only
router.patch(
  "/:id",
  authenticate,
  requireRole("OWNER"),
  validate({ params: uuidParamSchema, body: updateServiceSchema }),
  servicesController.updateService,
);

// DELETE /api/v1/services/:id (soft delete) - owner only
router.delete(
  "/:id",
  authenticate,
  requireRole("OWNER"),
  validate({ params: uuidParamSchema }),
  servicesController.softDeleteService,
);

export { router as servicesRoutes };
