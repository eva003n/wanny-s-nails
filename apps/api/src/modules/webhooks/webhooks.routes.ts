import { Router } from "express";
import { webhookRateLimit } from "../../shared/middleware/rateLimit.middleware.js";
import * as webhooksController from "./webhooks.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/webhooks/whatsapp — Webhook verification (Meta setup)
router.get("/whatsapp", webhooksController.verifyWhatsApp);

// POST /api/v1/webhooks/whatsapp — WhatsApp message events
router.post("/whatsapp", webhookRateLimit, webhooksController.handleWhatsApp);

// POST /api/v1/webhooks/daraja — M-Pesa payment callback
router.post("/daraja", webhooksController.handleDaraja);

export { router as webhooksRoutes };