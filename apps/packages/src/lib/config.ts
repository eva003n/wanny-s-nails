/**
 * Shared config — loads env vars consumed by the common utilities in this package.
 *
 * These vars are needed by the logger, Redis clients, and Bull Board.
 * Each deployable service (API, workers) provides them via its own .env or Docker
 * environment variables *before* importing from @wannys-nails/packages.
 */

const getEnv = (key: string, defaultValue?: string): string => {
  return process.env[key] ?? defaultValue ?? "";
};

export const config = {
  APP_NAME: getEnv("APP_NAME", "Wanny's Nails"),
  NODE_ENV: getEnv("NODE_ENV", "development"),
  LOG_LEVEL: getEnv("LOG_LEVEL", "info"),
  LOGTAIL_SOURCE_TOKEN: getEnv("LOGTAIL_SOURCE_TOKEN", ""),
  LOGTAIL_INGESTION_HOST: getEnv("LOGTAIL_INGESTION_HOST", ""),
  API_DOC_URL: getEnv("API_DOC_URL", ""),
} as const;

export type Config = typeof config;