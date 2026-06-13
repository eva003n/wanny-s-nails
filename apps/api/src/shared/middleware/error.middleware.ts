import type { Request, Response, NextFunction } from "express";
import { AppError } from "../types/errors.js";
import { logger } from "../lib/logger.js";

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, path: req.path, details: err.details }, err.message);
    res.status(err.httpStatus);
    res.setHeader("X-Request-ID", err.requestId);
    res.json(err.toResponse());
    return;
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  const requestId = (req.headers["x-request-id"] as string) || "unknown";
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      details: {},
      requestId,
    },
  });
};