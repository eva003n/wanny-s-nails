import { Router } from "express";
import * as eventsController from "./events.controller.js";
import { authenticate } from "../../shared/middleware/auth.middleware.js";

const router: ReturnType<typeof Router> = Router();
// GET /api/v1/events
router.route("/").get(authenticate, eventsController.connectSse);

export { router as eventsRoutes };