import type { Request, Response, NextFunction } from "express";
import { _config } from "../../shared/lib/index.js";
import { logger } from "../../shared/lib/index.js";
import { conversationQueue, paymentQueue } from "../../shared/lib/index.js";

import { redis } from "../../shared/lib/index.js";
import { whatsappTransport, type WebhookEvent } from "@wannys-nails/packages";
import { DarajaCallbackSchema } from "./schemas.js";
import { JOB_NAMES, type InboundMessage } from "@wannys-nails/packages";
import {
  WhatsAppWebhookSchema,
  type NormalisedEvent,
} from "../../shared/lib/schemas.js";

const log = logger.child({ module: "webhooks.controller" });

export const verifyWhatsApp = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  if (mode === "subscribe" && token === _config.WHATSAPP_VERIFY_TOKEN) {
    log.info(
      { event: "whatsapp.webhook.verified" },
      "WhatsApp webhook verified",
    );
    res.status(200).send(challenge);
  } else {
    log.warn(
      { event: "whatsapp.webhook.verify_failed" },
      "WhatsApp webhook verification failed",
    );
    res.sendStatus(403);
  }
};



export const handleWhatsApp = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // Success  response is sent immediately(Avoid whatsapp retries)
  res.status(200).json({ status: "ok" });

  const events = req.whatsappEvents;

  let event: WebhookEvent;
  for (event of events) {

    if (event.type === "STATUS_UPDATE") {
      // idempotency
      try {
      } catch (err) {
        log.warn({
          event: "Status.enqueue.error",
          error: err,
        });
      }
    } else {
          const wamId = event.wamId;
          const dedupKey = `whatsapp:dedup:${wamId}`;
          try {
            const exists = await redis.exists(dedupKey);
            if (exists) {
              log.debug(
                { event: "whatsapp.message.duplicate", wamId },
                "Duplicate WhatsApp message, skipping",
              );
              continue;
            }
            await redis.setex(dedupKey, 300, "1");
          } catch (err) {
            log.error({
              event: "Redis.key_setup.error",
              error: err,
            });
          }
      try {
        if (!event.body) {
          log.debug(
            { event: "whatsapp.message.empty_body", wamId: event.wamId },
            "Message has no text body, skipping FSM",
          );
          continue;
        }
        const {sendTypingIndicator} = whatsappTransport(log)
        // fire and forget(UX experience)
        sendTypingIndicator(event.wamId, _config)
        // enqueue message for processing
        await conversationQueue.add(JOB_NAMES.FSM_IN, event, {
          jobId: event.wamId,
        });
      } catch (err) {
        log.warn({
          event: "Message.enqueue.error",
          error: err,
        });
      }
    }
  }

  log.debug(req.whatsappEvents);
};

export const handleDaraja = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  try {
    log.info(
      { event: "payment.callback.received" },
      "M-Pesa callback received",
    );

    // 1. Respond immediately to Daraja — acknowledge before processing
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    // 2. Validate the callback payload with Zod
    const parsed = DarajaCallbackSchema.safeParse(req.body);
    if (!parsed.success) {
      log.warn(
        { event: "payment.callback.invalid_schema", error: parsed.error },
        "Invalid M-Pesa callback payload",
      );
      return;
    }

    const { stkCallback } = parsed.data.Body;
    const { CheckoutRequestID, ResultCode } = stkCallback;

    // 3. Enqueue payment-callback job for async processing
    //    The worker handles all DB mutations and side effects inside a
    //    transaction — never mutate payment state inline in the HTTP handler.
    await paymentQueue.add(
      JOB_NAMES.STK_CALLBACK,
      {
        checkoutRequestId: CheckoutRequestID,
        resultCode: ResultCode,
        rawCallback: req.body, // pass full body for metadata extraction
      },
      {
        jobId: CheckoutRequestID, // idempotency: Daraja may redeliver
      },
    );

    log.info(
      {
        event: "payment.callback.enqueued",
        checkoutRequestId: CheckoutRequestID,
        resultCode: ResultCode,
      },
      "Payment callback enqueued for processing",
    );
  } catch (error) {
    const err = error as unknown as Error;
    log.error(
      {
        event: "Payment.callback.error",
        error,
      },
      err.message,
    );
  }
};
