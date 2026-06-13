import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * X-Request-ID middleware.
 * Generates a UUID v4 if the client doesn't provide one, then echoes it in the response header.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const id = (req.headers["x-request-id"] as string) || randomUUID();
  req.headers["x-request-id"] = id;
  res.setHeader("X-Request-ID", id);
  next();
};