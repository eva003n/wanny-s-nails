import type {Request, Response, NextFunction} from "express"
import { WhatsAppWebhookSchema } from "../../../shared/lib/schemas.js";
import { logger } from "../../../shared/lib/index.js";
import { normaliseWebhook } from "../normalise.js";

const log = logger.child({module: "whatsapp.validate"})

export const validateWhatsappWebhook = async(
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = WhatsAppWebhookSchema.safeParse(req.body);

  if (!result.success) {
    log.warn(
      {
        issues: result.error.issues,
        // Only log first 500 chars of body — avoid logging full customer messages
        body: JSON.stringify(req.body).slice(0, 500),
      },
      "Invalid webhook payload, skipping",
    );

    // Always 200 — returning 4xx causes WhatsApp to retry indefinitely
    res.status(200).json({ status: "ok" });
    return;
  }

  req.whatsappEvents = normaliseWebhook(result.data);
  
  next();
}