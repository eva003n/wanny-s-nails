/**
 * Worker base — shared factory for standalone worker processes.
 *
 * Each worker entry point imports this to get:
 *  - Redis connection config (from env, no shared/lib dependency)
 *  - Graceful shutdown handling
 *  - Dead letter wiring
 */

import { Worker, type Job } from "bullmq";
import { handleDeadLetterJob } from "./dead-letter.processor.js";
import { logger } from "../logger.js";

const log = logger.child({module: "Worker"})


// ─── Redis Connection (reads from env directly) ─────────────

export function createWorkerConnection() {
  const url = new URL(process.env.REDIS_URL as string);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

// ─── Worker Factory ─────────────────────────────────────────

export interface WorkerOptions {
  queueName: string;
  workerName: string;
  concurrency?: number;
}

export function createWorker<T = any>(
  opts: WorkerOptions,
  processor: (job: Job<T>) => Promise<void>,
): Worker<T> {
  const connection = createWorkerConnection();

  const worker = new Worker<T>(
    opts.queueName,
    async (job) => {
      await processor(job);
    },
    {
      connection,
      concurrency: opts.concurrency ?? 1,
      name: opts.workerName
    },
  );

  // Wire dead letter handling
  worker.on("failed", (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      handleDeadLetterJob(opts.workerName, job, err);
    }
  });

  worker.on("completed", (job) => {
    log.debug(
      JSON.stringify({
        event: "worker.job.completed",
        queue: opts.workerName,
        jobId: job.id,
      }),
    );
  });

  worker.on("error", (err) => {
    log.error(
      JSON.stringify({
        event: "worker.error",
        queue: opts.workerName,
        error: err.message,
      }),
    );
  });

  log.info(
    JSON.stringify({
      event: "worker.started",
      queue: opts.queueName,
      worker: opts.workerName,
    }),
  );

  return worker;
}

// ─── Graceful Shutdown ──────────────────────────────────────

export function registerGracefulShutdown(
  workers: Array<{ close(): Promise<void> }>,
): void {
  const shutdown = async (signal: string) => {
    log.info(JSON.stringify({ event: "worker.shutdown.start", signal }));

    await Promise.all(workers.map((w) => w.close()));

    log.info(JSON.stringify({ event: "worker.shutdown.complete" }));
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
      JSON.stringify({
        event: "worker.unhandled_rejection",
        reason: String(reason),
      }),
    );
  });
}