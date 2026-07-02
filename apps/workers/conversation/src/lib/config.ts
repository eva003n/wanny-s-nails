/**
 * Reminder worker config — validates only the env vars this worker needs.
 *
 * Runs inside Docker, so env vars are injected directly into process.env.
 * No dotenv call here (that's the API's job in development).
 */

const isDevelopment = (process.env.NODE_ENV || "development") === "development";

if (isDevelopment) {
  const { config } = await import("dotenv");
  config({
    path: "./.env",
  });
}

import { z } from "zod";

const schema = z.object({
  APP_NAME: z.string().default("WannysNails"),
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  // Redis (required for BullMQ + WhatsApp)
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  // WhatsApp (required for sending reminders)
  WHATSAPP_ACCESS_TOKEN: z.string().min(1, "WHATSAPP_ACCESS_TOKEN is required"),
  WHATSAPP_PHONE_NUMBER_ID: z
    .string()
    .min(1, "WHATSAPP_PHONE_NUMBER_ID is required"),
  WHATSAPP_API_VERSION: z.string().default(""),
  // Database (required for Prisma)
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LOG_LEVEL: z.string().default("info"),
  LOGTAIL_INGESTION_HOST: z.string().default(""),
  LOGTAIL_SOURCE_TOKEN: z.string().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Reminder worker — invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables for reminder worker.");
}

export const _config = parsed.data;
export type Config = z.infer<typeof schema>;