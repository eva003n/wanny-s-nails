/**
 * Reminder worker entry point.
 *
 * Starts the reminder worker and registers graceful shutdown handlers.
 * Run: node dist/workers/reminder/src/index.js
 */

import "./worker.js";

console.info(
  JSON.stringify({
    event: "worker.process.started",
    worker: "reminder",
    pid: process.pid,
  }),
);
