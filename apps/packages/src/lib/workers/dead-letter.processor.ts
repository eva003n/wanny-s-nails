import type { Job } from "bullmq";
import type { Logger } from "pino";

// ─── Dead Letter Queue Listener ──────────────────────────────
// BullMQ doesn't have a built-in DLQ. Instead, we monitor failed jobs
// on each queue using the 'failed' event and log them for admin alerting.

/**
 * Track dead letter counts per queue for monitoring.
 * In production, this would push to a metrics system (Prometheus, Datadog, etc.)
 */
const deadLetterCounts: Record<string, number> = {};

export function getDeadLetterCounts(): Record<string, number> {
  return { ...deadLetterCounts };
}

/**
 * Handle a permanently failed job (exhausted all retries).
 * Logs structured data for admin alerting and monitoring dashboards.
 */
export function handleDeadLetterJob(queueName: string, job: Job | undefined, log: Logger, error: Error): void {
  const key = queueName;
  deadLetterCounts[key] = (deadLetterCounts[key] ?? 0) + 1;

  log.child({module: "dead_letter_processor"})
  log.info({ event: "dead_letter.monitor.started" });

  log.error(
    {
      event: "dead_letter.job",
      queue: queueName,
      jobId: job?.id,
      jobName: job?.name,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
      error: error.message,
      deadLetterCount: deadLetterCounts[key],
    },
  );

  // In production, this could:
  // 1. Send an alert via email/Slack/PagerDuty
  // 2. Write to a dead_letter_jobs table in the database
  // 3. Push to a monitoring system
  if (deadLetterCounts[key] >= 10) {
    log.error(
      JSON.stringify({
        event: "dead_letter.alert",
        queue: queueName,
        count: deadLetterCounts[key],
      }),
    );
  }
}

// Reset counts periodically (every hour)
const RESET_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  for (const key of Object.keys(deadLetterCounts)) {
    deadLetterCounts[key] = 0;
  }
}, RESET_INTERVAL_MS);
