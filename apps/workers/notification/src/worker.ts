/**
 * Notification worker — processes the "notifications" queue.
 *
 * Handles:
 *  - WhatsApp text/template messages
 *  - Email notifications
 */

import {
  createWorker,
  registerGracefulShutdown,
  Queue_Names,
  WhatsAppNotificationPayload,
  JOB_NAMES,
  InboundMessage,
} from "@wannys-nails/packages";
import { whatsappProcessor } from "./processors/whatsapp.processor.js";
import {
  emailProcessor,
  type EmailJobData,
} from "./processors/email.processor.js";
import type { Job } from "bullmq";
import { processMessage } from "./processors/workflows/engine.js";

// ─── WhatsApp Worker ──────────────────────────────────────────

const whatsappWorker = createWorker<WhatsAppNotificationPayload>(
  {
    queueName: Queue_Names.NOTIFICATIONS,
    workerName: JOB_NAMES.WHATSAPP,
    concurrency: 1,
  },
  async (job: Job<WhatsAppNotificationPayload>) => {
    switch (job.name) {
      case "whatsapp":
        return whatsappProcessor(job);
      default:
        console.warn(
          JSON.stringify({
            event: "worker.unknown_job",
            queue: Queue_Names.NOTIFICATIONS,
            jobName: job.name,
          }),
        );
    }
  },
);

// ─── Email Worker ─────────────────────────────────────────────

const emailWorker = createWorker<EmailJobData>(
  {
    queueName: Queue_Names.NOTIFICATIONS,
    workerName: JOB_NAMES.EMAIL,
    concurrency: 1,
  },
  async (job: Job<EmailJobData>) => {
    switch (job.name) {
      case "email":
        return emailProcessor(job);
      default:
        // Skip — WhatsApp and message jobs are handled by the other worker instance
        break;
    }
  },
);

type InMessageJobData = InboundMessage;

const fsmWorker = createWorker<InMessageJobData>(
  {
    queueName: Queue_Names.NOTIFICATIONS,
    workerName: "message",
    concurrency: 1,
  },
  async (job: Job<InMessageJobData>) => {
    switch (job.name) {
      case "message":
        processMessage(job.data);

      default:
        // Skip — WhatsApp and email jobs are handled by the other worker instance
        break;
    }
  },
);

// ─── Graceful Shutdown ────────────────────────────────────────
registerGracefulShutdown([whatsappWorker, emailWorker, fsmWorker]);
