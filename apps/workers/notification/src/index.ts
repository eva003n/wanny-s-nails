/**
 * Notification worker entry point.
 *
 * Starts the notification worker and registers graceful shutdown handlers.
 * Run: node dist/workers/notification/src/index.js
 */
import { logger } from "@wannys-nails/packages";

 const log = logger.child({ module: "worker:notifications" });


import "./worker.js";
import { prisma } from "./lib/prisma.js";

log.info(
  JSON.stringify({
    event: "worker.process.started",
    worker: "notification",
    pid: process.pid,
  }),
);

process.on("SIGTERM", () => prisma.$disconnect())
process.on("SIGINT", () => prisma.$disconnect())