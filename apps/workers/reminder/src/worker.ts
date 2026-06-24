/**
 * Reminder worker — processes the "reminders" queue.
 *
 * Handles:
 *  - 24-hour appointment reminders
 *  - 1-hour appointment reminders
 */

import {
  createWorker,
  registerGracefulShutdown,
} from "@wannys-nails/packages";
import {
  reminder24hProcessor,
  type Reminder24hJobData,
} from "./processors/reminder-24h.processor.js";
import {
  reminder1hProcessor,
  type Reminder1hJobData,
} from "./processors/reminder-1h.processor.js";
import { QueueNames } from "@wanny/shared";
import type { Job } from "bullmq";

// ─── Reminder Worker ─────────────────────────────────────────

interface ReminderJobData {
  [key: string]: any;
}

const worker = createWorker<ReminderJobData>(
  { queueName: QueueNames.REMINDERS, workerName: "reminder", concurrency: 10 },
  async (job: Job<ReminderJobData>) => {
    switch (job.name) {
      case "reminder-24h":
        return reminder24hProcessor(job as any);
      case "reminder-1h":
        return reminder1hProcessor(job as any);
      default:
        console.warn(
          JSON.stringify({
            event: "worker.unknown_job",
            queue: QueueNames.REMINDERS,
            jobName: job.name,
          }),
        );
    }
  },
);

// ─── Graceful Shutdown ────────────────────────────────────────

registerGracefulShutdown([worker]);
