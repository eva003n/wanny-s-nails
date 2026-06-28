/**
 * Notification worker entry point.
 *
 * Starts the notification worker and registers graceful shutdown handlers.
 * Run: node dist/workers/notification/src/index.js
 */
import { log} from "./lib/index.js";



import "./worker.js";
import { prisma } from "./lib/prisma.js";

log.info(
  {
    event: "worker.process.started",
    worker: "notification",
    pid: process.pid,
  },
);

process.on("SIGTERM", () => prisma.$disconnect())
process.on("SIGINT", () => prisma.$disconnect())