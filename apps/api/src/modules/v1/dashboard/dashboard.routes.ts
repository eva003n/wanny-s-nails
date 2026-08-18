import { Router } from "express";
import { authenticate } from "../../../shared/middleware/auth.middleware.js";
import * as dashboardController from "./dashboard.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/dashboard/stats
router.get("/stats", authenticate, dashboardController.getStats);

export { router as dashboardRoutes };
