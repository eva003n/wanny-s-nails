import type { Request, Response, NextFunction } from "express";
import { logger, _config } from "../../../../shared/lib/index.js";
import { createHmac, timingSafeEqual } from "crypto";

const log = logger.child({ module: "whatsapp.verify" });

export const verifyWebhookSignature = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = (req as unknown as Record<string, unknown>).rawBody;

  if (_config.META_APP_SECRET && rawBody) {
    const expectedSignature = `sha256=${createHmac(
      "sha256",
      _config.META_APP_SECRET,
    )
      .update(rawBody as Buffer)
      .digest("hex")}`;

    if (
      !signature ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      log.warn(
        { event: "whatsapp.webhook.hmac_failed" },
        "WhatsApp webhook HMAC validation failed, skipping",
      );
      // even when Hmac validation failed send a success to avoid whatsapp webhook retries
      res.status(200).json({ status: "ok" }); // but prevent further processing
      // return;
    }else {
      next(); // move to handler
    }
  }
};
