import { type ZodType } from "zod";

/**
 * Validates data against a Zod schema. Throws on failure in dev, logs and throws for debugging.
 * Use this at every API response boundary before calling `setState`.
 */
export function validateOrThrow<T>(
  schema: ZodType<T>,
  data: unknown,
  label: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Fail loud in development
    if (import.meta.env.DEV) {
      console.error(`[validateOrThrow] ${label} failed:`, result.error.issues);
      throw new Error(`Runtime validation failed: ${label}`);
    }
    // In production: log to Sentry and return a safe fallback
    // (add Sentry.captureException here)
    throw new Error(`Data shape error: ${label}`);
  }
  return result.data;
}