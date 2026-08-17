/**
 * Worker base — shared factory for standalone worker processes.
 *
 * Each worker entry point imports this to get:
 *  - Redis connection config (from env, no shared/lib dependency)
 *  - Graceful shutdown handling
 *  - Dead letter wiring
 */

import { Worker, type ConnectionOptions, type Job } from "bullmq";
import { handleDeadLetterJob } from "./dead-letter.processor.js";
import { createRedisClient } from "../redis.js";
import type { Logger } from "pino";





// ─── Worker Factory ─────────────────────────────────────────

export interface WorkerOptions {
  queueName: string;
  workerName: string;
  concurrency?: number;
  limiter?: {
    max?: number
    duration?: number
  }
}

export function createWorker<T = any>(
  opts: WorkerOptions,
  processor: (job: Job<T>) => Promise<void>,
  connection: ConnectionOptions,
  log: Logger 
): Worker<T> {
  
  const worker = new Worker<T>(
    opts.queueName,
    async (job) => {
      await processor(job);
    },
    {
      connection,
      concurrency: opts.concurrency ?? 1,
      name: opts.workerName,
      limiter: {
        max: opts.limiter?.max ?? 0,
        duration: opts.limiter?.duration ?? 0
      }
    },
  );

  // Wire dead letter handling
  worker.on("failed", (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      handleDeadLetterJob(opts.workerName, job, log, err);
    }
  });

  worker.on("completed", (job) => {
    log.debug(
      {
        event: "worker.job.completed",
        queue: opts.workerName,
        jobId: job.id,
      },
    );
  });

  worker.on("error", (err) => {
    log.error(
      {
        event: "worker.error",
        queue: opts.workerName,
        error: err.message,
      },
    );
  });

  log.info(
    {
      event: "worker.started",
      queue: opts.queueName,
      worker: opts.workerName,
    },
  );

  return worker;
}

// ─── Graceful Shutdown ──────────────────────────────────────

export function registerGracefulShutdown(
  workers: Array<{ close(): Promise<void> }>,
  log: Logger
): void {
  const shutdown = async (signal: string) => {
    log.info(JSON.stringify({ event: "worker.shutdown.start", signal }));

    await Promise.all(workers.map((w) => w.close()));

    log.info({ event: "worker.shutdown.complete" });
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    log.error(
      JSON.stringify({ event: "worker.uncaught", error: err.message }),
    );
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    log.error(
      {
        event: "worker.unhandled_rejection",
        reason: String(reason),
      },
    );
  });
}