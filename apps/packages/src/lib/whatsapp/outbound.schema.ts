import { z } from "zod";

// ── Text ────────────────────────────────────────────────
export const WaTextPayloadSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  recipient_type: z.literal("individual"),
  to: z.string().regex(/^\+\d{10,15}$/, "Must be E.164 format"),
  type: z.literal("text"),
  text: z.object({
    preview_url: z.boolean().default(false),
    body: z.string().min(1).max(4096),
  }),
});

// ── Interactive buttons ─────────────────────────────────
const WaButtonSchema = z.object({
  type: z.literal("reply"),
  reply: z.object({
    id: z.string().min(1).max(256),
    title: z
      .string()
      .min(1)
      .max(20, "Button title must be 20 characters or fewer")
      .refine(
        (t) => !/\p{Emoji_Presentation}/u.test(t),
        "Button titles cannot contain emoji — WhatsApp API requirement",
      ),
  }),
});

export const WaButtonPayloadSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  recipient_type: z.literal("individual"),
  to: z.string().regex(/^\+\d{10,15}$/),
  type: z.literal("interactive"),
  interactive: z.object({
    type: z.literal("button"),
    header: z
      .object({ type: z.literal("text"), text: z.string().max(60) })
      .optional(),
    body: z.object({ text: z.string().min(1).max(1024) }),
    footer: z.object({ text: z.string().max(60) }).optional(),
    action: z.object({
      buttons: z
        .array(WaButtonSchema)
        .min(1)
        .max(3, "WhatsApp allows a maximum of 3 buttons per message")
        .refine(
          (btns) => new Set(btns.map((b) => b.reply.id)).size === btns.length,
          "Button IDs must be unique within the message",
        ),
    }),
  }),
});

// ── Interactive list ────────────────────────────────────
const WaListRowSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(24, "Row title must be 24 characters or fewer"),
  description: z
    .string()
    .max(72, "Row description must be 72 characters or fewer")
    .optional(),
});

export const WaListPayloadSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  recipient_type: z.literal("individual"),
  to: z.string().regex(/^\+\d{10,15}$/),
  type: z.literal("interactive"),
  interactive: z.object({
    type: z.literal("list"),
    header: z
      .object({ type: z.literal("text"), text: z.string().max(60) })
      .optional(),
    body: z.object({ text: z.string().min(1).max(1024) }),
    footer: z.object({ text: z.string().max(60) }).optional(),
    action: z.object({
      button: z.string().min(1).max(20),
      sections: z
        .array(
          z.object({
            title: z.string().max(24).optional(),
            rows: z.array(WaListRowSchema).min(1).max(10),
          }),
        )
        .min(1)
        .max(10)
        // Total rows across ALL sections must not exceed 10
        .refine(
          (sections) =>
            sections.reduce((sum, s) => sum + s.rows.length, 0) <= 10,
          "Total rows across all sections must not exceed 10",
        )
        // Row IDs must be unique across ALL sections (not just within one)
        .refine((sections) => {
          const ids = sections.flatMap((s) => s.rows.map((r) => r.id));
          return new Set(ids).size === ids.length;
        }, "Row IDs must be unique across all sections"),
    }),
  }),
});

export type WaOutboundPayload =
  | z.infer<typeof WaTextPayloadSchema>
  | z.infer<typeof WaButtonPayloadSchema>
  | z.infer<typeof WaListPayloadSchema>;
