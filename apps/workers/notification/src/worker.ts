/**
 * Notification worker — processes the "notifications" queue.
 *
 * Handles:
 *  - WhatsApp text/template messages (outbound)
 *  - WhatsApp FSM (inbound messages)
 *  - Email notifications
 *  - Push notifications (admin-facing)
 */
import {
  createWorker,
  registerGracefulShutdown,
  Queue_Names,
  type WhatsAppNotificationPayload,
  type NotificationJobData,
  JOB_NAMES,
  type InboundMessage,
} from "@wannys-nails/packages";
import { whatsappProcessor } from "./processors/whatsapp.processor.js";
import {
  emailProcessor,
  type EmailJobData,
} from "./processors/email.processor.js";
import { pushSender } from "./processors/push-sender.js";
import type { Job } from "bullmq";
import { processMessage } from "./processors/workflows/engine.js";
import { logger } from "@wannys-nails/packages";

const log = logger.child({ module: "worker:notifications" });

// ─── Common Job Handler ───────────────────────────────────────

/**
 * Routes notification queue jobs to the correct handler based on job name.
 * All notification-type jobs update the Notification DB record.
 */
async function handleNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const jobName = job.name;

  switch (jobName) {
    // — Outbound WhatsApp messages (enqueued by notification triggers) —
    case JOB_NAMES.WHATSAPP: {
      await whatsappProcessor(job as unknown as Job<WhatsAppNotificationPayload>);
      break;
    }

    // — Inbound WhatsApp messages (enqueued by webhook controller → FSM) —
    case JOB_NAMES.FSM: {
      await processMessage(job.data as unknown as InboundMessage, job.id as string);
      break;
    }

    // — Legacy dispatch format (NotificationService.dispatch) —
    case "send-whatsapp": {
      const whatsappPayload: WhatsAppNotificationPayload & { to: string } = {
        type: "text",
        to: job.data.endpoint.address,
        text: buildWhatsAppText(job.data),
      };
      await whatsappProcessor(job as unknown as Job<WhatsAppNotificationPayload>);
      break;
    }
    case "send-email": {
      const emailPayload: EmailJobData = {
        to: job.data.endpoint.address,
        subject: job.data.template,
        html: JSON.stringify(job.data.payload),
      };
      await emailProcessor(job as unknown as Job<EmailJobData>);
      break;
    }
    case "send-push": {
      await pushSender(job);
      break;
    }
    case "email": {
      await emailProcessor(job as unknown as Job<EmailJobData>);
      break;
    }
    default:
      log.warn(
        { event: "worker.unknown_job", queue: Queue_Names.NOTIFICATIONS, jobName },
        "Unknown notification job name",
      );
  }
}

// ─── Single Notification Worker ──────────────────────────────
// Handles all job types on the notifications queue (outbound WhatsApp,
// inbound FSM, email, push) to avoid worker duplication and racing.

const notificationWorker = createWorker<NotificationJobData>(
  {
    queueName: Queue_Names.NOTIFICATIONS,
    workerName: "notification",
    concurrency: 1,
  },
  async (job: Job<NotificationJobData>) => {
    await handleNotificationJob(job);
  },
);

// ─── Graceful Shutdown ────────────────────────────────────────

registerGracefulShutdown([notificationWorker]);

log.info(
  JSON.stringify({
    event: "worker.process.started",
    worker: "notification",
    pid: process.pid,
  }),
);

/**
 * Build WhatsApp text from notification job data.
 * In production, this would render the appropriate template from TEMPLATES.
 */
function buildWhatsAppText(data: NotificationJobData): string {
  const payload = data.payload;
  const templateParts: string[] = [];

  for (const [key, value] of Object.entries(payload)) {
    templateParts.push(`${value}`);
  }

  return templateParts.join("\n");
}