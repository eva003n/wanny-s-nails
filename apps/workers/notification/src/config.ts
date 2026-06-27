/**
 * Notification worker config — validates only the env vars this worker needs.
 *
 * Runs inside Docker, so env vars are injected directly into process.env.
 * No dotenv call here (that's the API's job in development).
 */
if (process.env.NODE_ENV === "development") {
  const { config } = await import("dotenv");
  config({
    path: "../../api/.env.development",
  });
}

import { z } from "zod";

const schema = z.object({
  // Redis (required for BullMQ, sessions, rate limiting)
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  // Database (required for Prisma)
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // WhatsApp (required for sending messages)
  WHATSAPP_ACCESS_TOKEN: z.string().min(1, "WHATSAPP_ACCESS_TOKEN is required"),
  WHATSAPP_PHONE_NUMBER_ID: z
    .string()
    .min(1, "WHATSAPP_PHONE_NUMBER_ID is required"),
  // Email (Resend) — optional; if not set, email sending will fail gracefully
  RESEND_API_KEY: z.string().default(""),
  // Gemini AI (fallback) — optional; if not set, AI fallback skips to human escalation
  GEMINI_API_KEY: z.string().default(""),
  VAPID_SUBJECT: z.string().default(""),
  VAPID_PUBLIC_KEY: z.string().default(""),
  VAPID_PRIVATE_KEY: z.string().default(""),
  // App metadata
  APP_NAME: z.string().default("Wanny's Nails"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Notification worker — invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables for notification worker.");
}

export const config = parsed.data;
export type Config = z.infer<typeof schema>;
