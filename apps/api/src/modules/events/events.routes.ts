import { Router } from "express";
import * as eventsController from "./events.controller.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", eventsController.connectSse);

export { router as eventsRoutes };