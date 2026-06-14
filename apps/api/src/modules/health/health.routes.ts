import { Router } from "express";
import * as healthController from "./health.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/health
router.get("/", healthController.healthCheck);

export { router as healthRoutes };