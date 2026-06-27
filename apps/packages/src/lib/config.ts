/**
 * Shared config — loads env vars consumed by the common utilities in this package.
 *
 * These vars are needed by the logger, Redis clients, and Bull Board.
 * Each deployable service (API, workers) provides them via its own .env or Docker
 * environment variables *before* importing from @wannys-nails/packages.
 */
import { z } from "zod";
import { logger } from "./logger.js";

export const configSchema = z.object({
  BASE_URL: z.string().url().optional(),
  DATABASE_URL: z.string().url(),
  API_DOC_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string(),
  COOKIE_SECRET: z.string(),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().default(""),
  //   META_APP_ID: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  DARAJA_CONSUMER_KEY: z.string().default(""),
  DARAJA_CONSUMER_SECRET: z.string().default(""),
  DARAJA_SHORTCODE: z.string().default(""),
  DARAJA_PASSKEY: z.string().default(""),
  DARAJA_STK_PUSH_URL: z.url(),
  DARAJA_STK_QUERY_URL: z.url(),
  DARAJA_CALLBACK_URL: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),
  APP_NAME: z.string().default("Wanny's Nails"),
  LOG_LEVEL: z.string().default("info"),
  LOGTAIL_INGESTION_HOST: z.string().default(""),
  LOGTAIL_SOURCE_TOKEN: z.string().default(""),
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().default(8000),
});

export type Config = z.infer<typeof configSchema>;

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error(
    JSON.stringify({
      event: "Env.error",
      message: "❌ Invalid environment variables:",
      error: parsed.error.flatten().fieldErrors,
    }),
  );
  throw new Error("Invalid envigronment variables. Check server logs.");
}

export const config: Config = parsed.success
  ? parsed.data
  : configSchema.parse(process.env);