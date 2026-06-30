/**
 * Payment worker config — validates only the env vars this worker needs.
 *
 * Runs inside Docker, so env vars are injected directly into process.env.
 * No dotenv call here (that's the API's job in development).
 */

import { z } from "zod";

const schema = z.object({
  APP_NAME: z.string().default("WannysNails"),
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  // Redis (required for BullMQ)
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  // Database (required for Prisma)
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Daraja / M-Pesa (required for STK push + verification)
  DARAJA_CONSUMER_KEY: z.string().min(1, "DARAJA_CONSUMER_KEY is required"),
  DARAJA_CONSUMER_SECRET: z
    .string()
    .min(1, "DARAJA_CONSUMER_SECRET is required"),
  DARAJA_SHORTCODE: z.string().min(1, "DARAJA_SHORTCODE is required"),
  DARAJA_PASSKEY: z.string().min(1, "DARAJA_PASSKEY is required"),
  DARAJA_STK_PUSH_URL: z.string().min(1, "DARAJA_STK_PUSH_URL is required"),
  DARAJA_STK_QUERY_URL: z.string().min(1, "DARAJA_STK_QUERY_URL is required"),
  DARAJA_CALLBACK_URL: z.string().default(""),
  DARAJA_BASE_URL: z.url("DARAJA_BASE_URL is required"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Payment worker — invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables for payment worker.");
}

export const _config = parsed.data;
export type Config = z.infer<typeof schema>;