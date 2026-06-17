import { z } from "zod";
import { config as loadDotenv } from "dotenv";

loadDotenv({
  path: "./.env",
});
loadDotenv({
  path: `./.env.${process.env.NODE_ENV || "development"}`,
});

const configSchema = z.object({
  BASE_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
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

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid envigronment variables. Check server logs.");
}

export const config = parsed.data;
export type Config = z.infer<typeof configSchema>;
