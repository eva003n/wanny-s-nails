import { z } from "zod";

/**
 * Common WhatsApp text object
 */
export const WhatsAppTextSchema = z.object({
  text: z.string().min(1).max(1024),
});

/**
 * Header
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
export const WhatsAppInteractiveHeaderSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(60),
});

/**
 * Footer
 */
export const WhatsAppInteractiveFooterSchema = z.object({
  text: z.string().min(1).max(60),
});

/**
 * Shared interactive message shape
 */
export const WhatsAppInteractiveBaseSchema = z.object({
  header: WhatsAppInteractiveHeaderSchema.optional(),
  body: WhatsAppTextSchema,
  footer: WhatsAppInteractiveFooterSchema.optional(),
});

// Button message
const WhatsAppReplyButtonSchema = z.object({
  type: z.literal("reply"),
  reply: z.object({
    id: z.string().min(1).max(256),
    title: z.string().min(1).max(20),
  }),
});

export const WhatsAppInteractiveButtonMessageSchema =
  WhatsAppInteractiveBaseSchema.extend({
    type: z.literal("button"),

    action: z.object({
      buttons: z.array(WhatsAppReplyButtonSchema).min(1).max(3),
    }),
  });
// list message

const WhatsAppListRowSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(24),
  description: z.string().max(72).optional(),
});

const WhatsAppListSectionSchema = z.object({
  title: z.string().max(24).optional(),

  rows: z.array(WhatsAppListRowSchema).min(1).max(10),
});

const WhatsAppListActionSchema = z.object({
  button: z.string().min(1).max(20),

  sections: z.array(WhatsAppListSectionSchema).min(1).max(10),
});

export const WhatsAppInteractiveListMessageSchema =
  WhatsAppInteractiveBaseSchema.extend({
    type: z.literal("list"),

    action: WhatsAppListActionSchema,
  });

// union
export const WhatsAppInteractiveMessageSchema = z.discriminatedUnion("type", [
  WhatsAppInteractiveButtonMessageSchema,
  WhatsAppInteractiveListMessageSchema,
]);

export type WhatsAppText = z.infer<typeof WhatsAppTextSchema>;

export type WhatsAppInteractiveHeader = z.infer<
  typeof WhatsAppInteractiveHeaderSchema
>;

export type WhatsAppInteractiveFooter = z.infer<
  typeof WhatsAppInteractiveFooterSchema
>;

export type WhatsAppInteractiveBase = z.infer<
  typeof WhatsAppInteractiveBaseSchema
>;

export type WhatsAppReplyButton = z.infer<typeof WhatsAppReplyButtonSchema>;

export type WhatsAppInteractiveButtonMessage = z.infer<
  typeof WhatsAppInteractiveButtonMessageSchema
>;

export type WhatsAppListRow = z.infer<typeof WhatsAppListRowSchema>;

export type WhatsAppListSection = z.infer<typeof WhatsAppListSectionSchema>;

export type WhatsAppListAction = z.infer<typeof WhatsAppListActionSchema>;

export type WhatsAppInteractiveListMessage = z.infer<
  typeof WhatsAppInteractiveListMessageSchema
>;

export type WhatsAppInteractiveMessage = z.infer<
  typeof WhatsAppInteractiveMessageSchema
>;

// export type WhatsAppInteractive = z.infer<typeof WhatsAppInteractiveSchema>;