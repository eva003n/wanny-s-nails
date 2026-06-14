import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config } from "../../shared/lib/config.js";
import { logger } from "../../shared/lib/logger.js";
import { paymentsService } from "../payments/payments.service.js";
import { redis } from "../../shared/lib/redis.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

export const verifyWhatsApp = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  if (mode === "subscribe" && token === config.WHATSAPP_VERIFY_TOKEN) {
    logger.info("WhatsApp webhook verified");
    res.status(200).send(challenge);
  } else {
    logger.warn("WhatsApp webhook verification failed");
    res.sendStatus(403);
  }
});

export const handleWhatsApp = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = (req as unknown as Record<string, unknown>).rawBody;

  if (config.META_APP_SECRET && rawBody) {
    const expectedSignature = `sha256=${crypto
      .createHmac("sha256", config.META_APP_SECRET)
      .update(rawBody as Buffer)
      .digest("hex")}`;

    if (
      !signature ||
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      )
    ) {
      logger.warn("WhatsApp webhook HMAC validation failed");
      res.status(200).json({ status: "ok" });
      return;
    }
  }

  res.status(200).json({ status: "ok" });

  const body = req.body;
  if (body.object === "whatsapp_business_account") {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === "messages") {
          const messages = change.value?.messages ?? [];
          for (const message of messages) {
            const wamid = message.id;
            if (wamid) {
              const dedupKey = `whatsapp:dedup:${wamid}`;
              const exists = await redis.exists(dedupKey);
              if (exists) {
                logger.debug({ wamid }, "Duplicate WhatsApp message, skipping");
                continue;
              }
              await redis.setex(dedupKey, 300, "1");
            }

            logger.info(
              { from: message.from, type: message.type, wamid },
              "WhatsApp message received",
            );
            // TODO: Route to FSM engine
          }
        }
      }
    }
  }
});

export const handleDaraja = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  logger.info("M-Pesa callback received");
  await paymentsService.handleCallback(req.body);
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
});