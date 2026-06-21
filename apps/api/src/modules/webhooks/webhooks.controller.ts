import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import crypto from "crypto";
import { config } from "../../shared/lib/config.js";
import { logger } from "../../shared/lib/logger.js";

const log = logger.child({ module: "webhooks" });
import { paymentsService } from "../payments/payments.service.js";
import { redis } from "../../shared/lib/redis.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { processMessage } from "../../workflows/engine.js";
import { sendMessage, sendTemplateMessage } from "../../workflows/whatsapp.js";
import { loadSession, saveSession, deleteSession } from "../../workflows/session.js";
import { formatDateEAT, formatTime12h } from "../../workflows/helpers.js";
import { prisma } from "../../shared/lib/prisma.js";
import type { Message } from "../../workflows/types.js";


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
  profile: z.object({
    name: z.string(),
  }).optional(),
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
        res.status(200).json({ status: "ok" });
        return;
      }
    }

    // Success  response is sent immediately
    res.status(200).json({ status: "ok" });
  

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
                messageBody = (message as unknown as { text: { body: string } }).text.body;
              } else if (message.type === "button") {
                messageBody = (message as unknown as { button: { text: string } }).button.text;
              } else if (message.type === "interactive") {
                const interactive = (message as unknown as { interactive: { button_reply?: { id: string }; list_reply?: { id: string; title: string } } }).interactive;
              if (interactive.button_reply) {
                  messageBody = interactive.button_reply.id;
                } else if (interactive.list_reply) {
                  messageBody = interactive.list_reply.id;
                }
              }

              // if no message body skip FSM engine
              if (!messageBody) {
                log.debug({ event: "whatsapp.message.empty_body", wamid }, "Message has no text body, skipping FSM");
                continue;
              }

              const whatsappMessage: Message = {
                type: "Incoming",
                phone: message.from,
                messageBody
              } 

              processMessage(whatsappMessage).catch((err) => {
                log.error(
                  { event: "webhook.fsm.error", from: message.from, error: err },
                  "FSM processing failed",
                );
              });
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

    // Process the payment callback first
    await paymentsService.handleCallback(req.body);

    // Extract callback data to determine success/failure
    const body = req.body as { Body?: { stkCallback?: Record<string, unknown> } };
    const stkCallback = body.Body?.stkCallback ?? {};
    const resultCode = stkCallback.ResultCode as number;
    const checkoutRequestId = stkCallback.CheckoutRequestID as string;

    // Look up the payment and booking to find the customer's phone
    try {
      const payment = await prisma.payment.findUnique({
        where: { checkoutRequestId },
        include: {
          booking: {
            include: {
              customer: { select: { id: true, name: true, phone: true } },
              service: { select: { name: true, durationMinutes: true, priceKes: true } },
            },
          },
        },
      });

      if (payment && payment.booking?.customer) {
        const customerPhone = payment.booking.customer.phone;
        const customerName = payment.booking.customer.name;
        const booking = payment.booking;
        const serviceName = booking.service.name;

        // Find the customer's WhatsApp session
        const session = await loadSession(customerPhone);

        if (resultCode === 0) {
          // Payment succeeded
          log.info(
            { event: "payment.callback.success", checkoutRequestId, phone: customerPhone },
            "Payment succeeded, sending WhatsApp confirmation",
          );

          const dateDisplay = formatDateEAT(booking.appointmentAt.toISOString());
          const eatDate = new Date(booking.appointmentAt.getTime() + 3 * 60 * 60 * 1000);
          const period = eatDate.getUTCHours() >= 12 ? "PM" : "AM";
          const hours12 = eatDate.getUTCHours() % 12 || 12;
          const timeDisplay = `${hours12}:${String(eatDate.getUTCMinutes()).padStart(2, "0")} ${period}`;

          const confirmationText = [
            "Payment received! ✅",
            "",
            `📋 Booking: ${booking.reference}`,
            `✂️ Service: ${serviceName}`,
            `📅 ${dateDisplay}`,
            `⏰ ${timeDisplay}`,
            "📍 Wanny's Nails, Nairobi",
            "",
            "We'll send you a reminder 24 hours before. See you then! 💅",
          ].join("\n");

          await sendMessage(customerPhone, { type: "text", text: confirmationText });

          // Clear the customer's session
          await deleteSession(customerPhone);
        } else {
          // Payment failed
          log.info(
            { event: "payment.callback.failed", checkoutRequestId, resultCode, phone: customerPhone },
            "Payment failed, notifying customer",
          );

          await sendMessage(customerPhone, {
            type: "text",
            text: "The payment wasn't completed.",
          });

          await sendMessage(customerPhone, {
            type: "interactive_button",
            text: "What would you like to do?",
            buttonTitle: "Choose an option",
            buttons: [
              { id: "1", title: "Try Again" },
              { id: "2", title: "Cancel Booking" },
            ],
          });

          // Update session to stay in AWAITING_PAYMENT
          if (session) {
            session.state = "AWAITING_PAYMENT";
            await saveSession(customerPhone, session);
          }
        }
      }
    } catch (error) {
      log.error(
        { event: "payment.callback.whatsapp_notify_failed", error, checkoutRequestId },
        "Failed to send WhatsApp payment notification",
      );
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  },
);
