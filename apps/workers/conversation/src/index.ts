/**
 * Conversation worker entry point.
 *
 * Starts the  conversation worker and registers graceful shutdown handlers.
 * Run: node dist/workers/conversation/src/index.js
 */

import { log } from "./lib/index.js";
import "./worker.js";

log.info({
    event: "worker.process.started",
    worker: "conversation",
    pid: process.pid,
  },
);
