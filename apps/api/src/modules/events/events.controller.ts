import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { _config } from "../../shared/lib/config.js";
import { logger } from "../../shared/lib/index.js";


const log = logger.child({ module: "events" });
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { UnauthorizedError } from "../../shared/types/errors.js";

type SSEClient = {
  id: string;
  res: Response;
};

const clients: Map<string, SSEClient> = new Map();
let clientIdCounter = 0;

export function publishEvent(event: string, data: Record<string, unknown>) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, client] of clients) {
    client.res.write(payload);
  }
}

export const connectSse = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const token = req.query.token as string;

  if (!token) {
    res
      .status(401)
      .json(new UnauthorizedError());
    return;
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, _config.JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch {
    res
      .status(401)
      .json(new UnauthorizedError());
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // if the app is behind a reverse proxy this tells the proxy not to buffer the response to enhance the real time effect no delays
  });

  res.write(`event: connected\ndata: {"userId":"${userId}"}\n\n`);

  const clientId = String(++clientIdCounter);
  const client: SSEClient = { id: clientId, res };
  clients.set(clientId, client);

  const pingInterval = setInterval(() => {
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch {
      clearInterval(pingInterval);
      clients.delete(clientId);
    }
  }, 30_000);

  req.on("close", () => {
    clearInterval(pingInterval);
    clients.delete(clientId);
    log.debug({ event: "sse.client.disconnected", clientId }, "SSE client disconnected");
  });

  log.debug({ event: "sse.client.connected", clientId, userId }, "SSE client connected");
});