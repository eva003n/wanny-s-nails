import {z} from"zod"

// whatsapp callback schema

// metadata object is the smae for both incoming and outgoing messages
const MetadataSchema = z.object({
  display_phone_number: z.string(),
  phone_number_id: z.string(),
});

// constact schema diffent structure for incoming and outgoing
const ContactSchema = z.object({
  profile: z
    .object({
      name: z.string(),
    })
    .optional(), // incoming
  wa_id: z.string(),// both
});

// --- Message types(incoming) ---

const TextMessageSchema = z.object({
  type: z.literal("text"),
  text: z.object({ body: z.string() }),
});


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
  errors: z.array(z.object({ code: z.number(), title: z.string(), message: z.string(), error_data: z.object({details: z.string()}) })).optional(),
});

export const MessageSchema = BaseMessageSchema.and(MessageTypeSchema);

// --- Status updates (delivered, read, sent, failed) ---

export const StatusSchema = z.object({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string(),
  recipient_id: z.string(),
  errors: z
    .array(z.object({ code: z.number(), message: z.string() }))
    .optional(),
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

export type NormalisedEventType =
  | "TEXT"
  | "BUTTON_REPLY"
  | "LIST_REPLY"
  | "UNSUPPORTED"
  | "STATUS_UPDATE";

export interface NormalisedEvent {
  type: Exclude<NormalisedEventType, "STATUS_UPDATE">;
  phone: string;
  customerName: string;
  wamId: string; // dedup key
  body: string; // what fsm processes
  timestamp: Date;
}

export interface StatusEvent {
  type: "STATUS_UPDATE";
  wamId: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipientPhone: string;
  errorCode?: number;
}

export type WebhookEvent = NormalisedEvent | StatusEvent;
