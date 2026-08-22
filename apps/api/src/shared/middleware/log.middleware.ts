// src/middleware/log.middleware.ts

import { pinoHttp } from "pino-http";
import type { Request, Response, RequestHandler } from "express";
import { logger } from "../lib/index.js";

export const logMiddleware: RequestHandler = pinoHttp({
  logger, // reuse your configured pino instance

  // add request id for logging
  customProps(req: Request & { requestId?: string }, _res: Response) {
    return {
      requestId: req.requestId,
    };
  },

  // assign each response a log level
  customLogLevel(_req: Request, res: Response, err?: Error) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },

  // ── Shape of the log line (mirrors your prodFormat fields) ────────────────
  customSuccessMessage(req: Request, res: Response) {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage(req: Request, res: Response, err: Error) {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },

  // Serialize req/res — controls which fields appear on the log line
  serializers: {
    req(req: Request & { requestId?: string }) {
      return {
        method: req.method,
        url: req.url,
        ip: req.socket?.remoteAddress || req.headers?.["x-forwarded-for"], //(behind proxies)
        userAgent: req.headers["user-agent"],
        requestId: req.requestId,
      };
    },
    res(res: Response) {
      return {
        status: res.statusCode,
        // contentLength: res.getHeader("content-length"),
      };
    },
  },

  // Dev: pretty output; Prod: structured JSON (handled by pino transport)
  // pino-http inherits the transport you already set on the logger instance,
  // so nothing extra needed here — dev gets pino-pretty, prod gets JSON.

  // Skip noisy routes
  autoLogging: {
    ignore: (req: Request) =>
      req.url === "/health" || req.url === "/favicon.ico",
  },
});
