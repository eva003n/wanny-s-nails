import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import crypto from "crypto";
import { config } from "../../shared/lib/config.js";
import {
  logger,
  redisClient,
  notificationQueue,
  paymentQueue,
} from "@wannys-nails/packages";

import { paymentsService } from "../payments/payments.service.js";
import {  } from "@wannys-nails/packages";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { DarajaCallbackSchema } from "./schemas.js";
import { JOB_NAMES, type InboundMessage } from "@wannys-nails/packages";

const log = logger.child({ module: "webhooks" });
const redis = redisClient.cache;


export const verifyWhatsApp = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    if (mode === "subscribe" && token === config.WHATSAPP_VERIFY_TOKEN) {
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
  },
);

// --- Primitives ---

const MetadataSchema = z.object({
  display_phone_number: z.string(),
  phone_number_id: z.string(),
});

const ContactSchema = z.object({
  profile: z
    .object({
      name: z.string(),
    })
    .optional(),
  wa_id: z.string(),
});

// --- Message types ---

const TextMessageSchema = z.object({
  type: z.literal("text"),
  text: z.object({ body: z.string() }),
});

// const ImageMessageSchema = z.object({
//   type: z.literal("image"),
//   image: z.object({
//     id: z.string(),
//     mime_type: z.string().optional(),
//     sha256: z.string().optional(),
//     caption: z.string().optional(),
//   }),
// });

// const AudioMessageSchema = z.object({
//   type: z.literal("audio"),
//   audio: z.object({
//     id: z.string(),
//     mime_type: z.string().optional(),
//   }),
// });

// const DocumentMessageSchema = z.object({
//   type: z.literal("document"),
//   document: z.object({
//     id: z.string(),
//     mime_type: z.string().optional(),
//     filename: z.string().optional(),
//     caption: z.string().optional(),
//   }),
// });

// const VideoMessageSchema = z.object({
//   type: z.literal("video"),
//   video: z.object({
//     id: z.string(),
//     mime_type: z.string().optional(),
//     caption: z.string().optional(),
//   }),
// });

// const LocationMessageSchema = z.object({
//   type: z.literal("location"),
//   location: z.object({
//     latitude: z.number(),
//     longitude: z.number(),
//     name: z.string().optional(),
//     address: z.string().optional(),
//   }),
// });

// const StickerMessageSchema = z.object({
//   type: z.literal("sticker"),
//   sticker: z.object({
//     id: z.string(),
//     mime_type: z.string().optional(),
//   }),
// });

// const ReactionMessageSchema = z.object({
//   type: z.literal("reaction"),
//   reaction: z.object({
//     message_id: z.string(),
//     emoji: z.string(),
//   }),
// });

const ButtonMessageSchema = z.object({
  type: z.literal("button"),
  button: z.object({
    text: z.string(),
    payload: z.string(),
  }),
});

const InteractiveMessageSchema = z.object({
  type: z.literal("interactive"),
  interactive: z.object({
    type: z.enum(["button_reply", "list_reply"]),
    button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    list_reply: z
      .object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
      })
      .optional(),
  }),
});

// const UnknownMessageSchema = z.object({
//   type: z.string(), // fallback for any type not listed above
// });

const MessageTypeSchema = z.discriminatedUnion("type", [
  TextMessageSchema,
  ButtonMessageSchema,
  InteractiveMessageSchema,
]);

// --- Base message fields (common to all types) ---

const BaseMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(), // Unix epoch as string — coerce if you want a Date
  context: z
    .object({
      from: z.string(),
      id: z.string(), // wamid of the message being replied to
    })
    .optional(),
  errors: z.array(z.object({ code: z.number(), title: z.string() })).optional(),
});

export const MessageSchema = BaseMessageSchema.and(MessageTypeSchema);

// --- Status updates (delivered, read, sent, failed) ---

export const StatusSchema = z.object({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string(),
  recipient_id: z.string(),
  errors: z.array(z.object({ code: z.number(), title: z.string() })).optional(),
});

// --- Change value ---

const ChangeValueSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  metadata: MetadataSchema,
  contacts: z.array(ContactSchema).optional(),
  messages: z.array(MessageSchema).optional(),
  statuses: z.array(StatusSchema).optional(),
});

// --- Top-level webhook payload ---

export const WhatsAppWebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: ChangeValueSchema,
          field: z.string(),
        }),
      ),
    }),
  ),
});

// --- Inferred types ---

export type WhatsAppWebhook = z.infer<typeof WhatsAppWebhookSchema>;
export type WhatsAppMessage = z.infer<typeof MessageSchema>;
export type WhatsAppStatus = z.infer<typeof StatusSchema>;
export type TextMessage = z.infer<typeof TextMessageSchema>;
// export type ImageMessage = z.infer<typeof ImageMessageSchema>;

export const handleWhatsApp = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
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
        log.warn(
          { event: "whatsapp.webhook.hmac_failed" },
          "WhatsApp webhook HMAC validation failed",
        );
        // even when Hmac validation failed send a success to avoid whatsapp webhook retries
        res.status(200).json({ status: "ok" });// but prevent further processing
        return;
      }
    }

    // Success  response is sent immediately
    res.status(200).json({ status: "ok" });

    // validate and extract data
    const parsed = WhatsAppWebhookSchema.safeParse(req.body);
    // Only supported message formats are allowed
    if (!parsed.success) {
      log.warn(
        {
          event: "whatsapp.webhook.invalid_schema",
          error: parsed.error,
        },
        "Invalid webhook payload",
      );
      return;
    }

    const body = parsed.data;
    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field === "messages") {
            const messages = change.value?.messages ?? [];
            for (const message of messages) {
              const wamid = message.id;
              if (wamid) {
                // idempotency
                const dedupKey = `whatsapp:dedup:${wamid}`;
                const exists = await redis.exists(dedupKey);
                if (exists) {
                  log.debug(
                    { event: "whatsapp.message.duplicate", wamid },
                    "Duplicate WhatsApp message, skipping",
                  );
                  continue;
                }
                await redis.setex(dedupKey, 300, "1");
              }

              log.info(
                {
                  event: "whatsapp.message.received",
                  from: message.from,
                  type: message.type,
                  wamid,
                },
                "WhatsApp message received",
              );

              // Extract message body text based on message type(text, button, interactive)
              let messageBody = "";
              if (message.type === "text") {
                messageBody = (message as unknown as { text: { body: string } })
                  .text.body;
              } else if (message.type === "button") {
                messageBody = (
                  message as unknown as { button: { text: string } }
                ).button.text;
              } else if (message.type === "interactive") {
                const interactive = (
                  message as unknown as {
                    interactive: {
                      button_reply?: { id: string };
                      list_reply?: { id: string; title: string };
                    };
                  }
                ).interactive;
                if (interactive.button_reply) {
                  messageBody = interactive.button_reply.id;
                } else if (interactive.list_reply) {
                  messageBody = interactive.list_reply.id;
                }
              }

              // if no message body skip FSM engine
              if (!messageBody) {
                log.debug(
                  { event: "whatsapp.message.empty_body", wamid },
                  "Message has no text body, skipping FSM",
                );
                continue;
              }

              const whatsappMessage: InboundMessage = {
                type: message.type,
                from: message.from,
                text: messageBody,
              };

              // enqueue message for processing by fsm engine
              notificationQueue.add(JOB_NAMES.FSM, whatsappMessage, {jobId: message.from})
         
            }
          }
        }
      }
    }
  },
);
export const handleDaraja = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    log.info(
      { event: "payment.callback.received" },
      "M-Pesa callback received",
    );

    // 1. Validate the callback payload with Zod (discriminated union for success/failure)
    const parsed = DarajaCallbackSchema.safeParse(req.body);
    if (!parsed.success) {
      log.warn(
        { event: "payment.callback.invalid_schema", error: parsed.error },
        "Invalid M-Pesa callback payload",
      );
      // Always respond 200 to Daraja to prevent retries
      res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    const resultCode = parsed.data.Body.stkCallback.ResultCode;
    const checkoutRequestId = parsed.data.Body.stkCallback.CheckoutRequestID;

    // 2. Persist DB updates (existing service — unchanged)
    await paymentsService.handleCallback(req.body);

    // 3. Respond immediately to daraja
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    // 4. Enqueue payment-callback job for asynchronous side effects (WhatsApp notifications)
    await paymentQueue.add(
      "payment-callback",
      {
        resultCode,
        checkoutRequestId,
        rawCallback: req.body,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    log.info(
      { event: "payment.callback.enqueued", checkoutRequestId, resultCode },
      "Payment callback enqueued for processing",
    );
  },
);
