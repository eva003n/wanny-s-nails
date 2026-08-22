import type { Request, Response, NextFunction } from "express";
import { AppError } from "../types/errors.js";
import { logger } from "../lib/index.js";

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const _log = req.log || logger;
  const requestId = req.requestId || (req.headers["x-request-id"] as string) || "unknown";

  if (err instanceof AppError) {
    _log.warn({ event: "app.error.handled", code: err.code, path: req.path, details: err.details, requestId }, err.message);
    res.status(err.httpStatus);
    res.setHeader("X-Request-ID", requestId);
    res.json(err.toResponse());
    return;
  }

  _log.error({ err, event: "app.error.unhandled", path: req.path, requestId }, "Unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      details: {},
      requestId,
    },
  });
};
