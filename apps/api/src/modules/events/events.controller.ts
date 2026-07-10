import type { Request, Response, NextFunction } from "express";
import { _config } from "../../shared/lib/config.js";
import { logger, subscriber } from "../../shared/lib/index.js";


const log = logger.child({ module: "events" });
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import type { PubSubEvent } from "@wannys-nails/packages";

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

subscriber.subscribe("events")

subscriber.on("message", (_channel, message) => {
  const payload: PubSubEvent = JSON.parse(message)
  publishEvent(payload.event, payload.data)

})

export const connectSse = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
// client will retry with default 3s
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // if the app is behind a reverse proxy this tells the proxy not to buffer the response to enhance the real time effect no delays
  });

  res.write(`event: connected\ndata: {"userId":"${req.user?.id}"}\n\n`);

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

  log.debug({ event: "sse.client.connected", clientId, userId: req.user?.id }, "SSE client connected");
});