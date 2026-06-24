import type { Request, Response, NextFunction } from "express";
import { redisClient } from "@wannys-nails/packages";

const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds
const redis = redisClient.cache
/**
 * Idempotency middleware.
 * Caches the response for a given Idempotency-Key for 24 hours.
 * On subsequent requests with the same key, returns the cached response.
 * Only applies to POST action endpoints.
 */
export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

  if (!idempotencyKey) {
    next();
    return;
  }

  const redisKey = `idempotency:${idempotencyKey}:${req.method}:${req.path}`;

  try {
    const cached = await redis.get(redisKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { status: number; body: unknown };
      res.status(parsed.status).json(parsed.body);
      return;
    }
  } catch {
    // Redis unavailable — continue without idempotency
  }

  // Store the original res.json and res.status to intercept the response
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);

  let capturedStatus = 200;
  let capturedBody: unknown;

  res.status = ((status: number) => {
    capturedStatus = status;
    return originalStatus(status);
  }) as typeof res.status;

  res.json = ((body: unknown) => {
    capturedBody = body;
    // Store in Redis (fire-and-forget)
    redis.setex(redisKey, IDEMPOTENCY_TTL, JSON.stringify({ status: capturedStatus, body: capturedBody })).catch(() => {});
    return originalJson(body);
  }) as typeof res.json;

  next();
};