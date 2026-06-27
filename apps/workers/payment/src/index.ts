/**
 * Payment worker entry point.
 *
 * Starts the payment worker and registers graceful shutdown handlers.
 * Run: node dist/workers/payment/src/index.js
 */

import { log } from "./lib/logger.js";
import "./worker.js";

log.info({
    event: "worker.process.started",
    worker: "payment",
    pid: process.pid,
  });