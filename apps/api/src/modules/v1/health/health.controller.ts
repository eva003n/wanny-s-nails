import type { Request, Response, NextFunction } from "express";
import { logger } from "../../../shared/lib/index.js";

import { prisma } from "../../../shared/lib/index.js";

import { redis } from "../../../shared/lib/index.js";
const log = logger.child({ module: "health" });

import { asyncHandler } from "../../../shared/utils/asyncHandler.js";

const startTime = Date.now();


export const healthCheck = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const checks: { database: string; redis: string; queue: string } = {
    database: "ok",
    redis: "ok",
    queue: "ok",
  };

  let status = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    log.error({ err, event: "health.check.database_failed" }, "Health check: database failed");
    checks.database = "error";
    status = "degraded";
  }

  try {
    await redis.ping();
  } catch (err) {
    log.error({ err, event: "health.check.redis_failed" }, "Health check: redis failed");
    checks.redis = "error";
    status = "degraded";
  }

  const response: Record<string, unknown> = {
    status,
    version: "2.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  };

  const httpStatus = status === "ok" ? 200 : 503;
  res.status(httpStatus).json(response);
});