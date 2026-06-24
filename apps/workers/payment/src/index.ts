/**
 * Payment worker entry point.
 *
 * Starts the payment worker and registers graceful shutdown handlers.
 * Run: node dist/workers/payment/src/index.js
 */

import "./worker.js";

console.info(
  JSON.stringify({
    event: "worker.process.started",
    worker: "payment",
    pid: process.pid,
  }),
);