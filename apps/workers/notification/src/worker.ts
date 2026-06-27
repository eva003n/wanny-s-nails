/**
 * Notification worker — processes the "notifications" queue.
 *
 * Handles:
 *  - WhatsApp text/template messages
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
    case "send-whatsapp": {
      // Build WhatsApp payload from notification data
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
    default:
      log.warn(
        { event: "worker.unknown_job", queue: Queue_Names.NOTIFICATIONS, jobName },
        "Unknown notification job name",
      );
  }
}

// ─── WhatsApp Worker ──────────────────────────────────────────

const whatsappWorker = createWorker<WhatsAppNotificationPayload>(
  {
    queueName: Queue_Names.NOTIFICATIONS,
    workerName: JOB_NAMES.WHATSAPP,
    concurrency: 1,
  },
  async (job: Job<WhatsAppNotificationPayload>) => {
    switch (job.name) {
      case JOB_NAMES.WHATSAPP: // text | interactive_button | interactive_list_buttons
        return whatsappProcessor(job);
      default:
        log.warn(
          { event: "worker.unknown_job", queue: Queue_Names.NOTIFICATIONS, jobName: job.name },
          "Unknown WhatsApp job name",
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
        break;
    }
  },
);

// ─── Notification Dispatch Worker ─────────────────────────────
// Processes jobs enqueued by NotificationService.dispatch()

const notificationWorker = createWorker<NotificationJobData>(
  {
    queueName: Queue_Names.NOTIFICATIONS,
    workerName: "notification-dispatch",
    concurrency: 1,
  },
  async (job: Job<NotificationJobData>) => {
    await handleNotificationJob(job);
  },
);

// ─── FSM Worker ───────────────────────────────────────────────

const fsmWorker = createWorker<InboundMessage>(
  {
    queueName: Queue_Names.NOTIFICATIONS,
    workerName: JOB_NAMES.FSM,
    concurrency: 1,
  },
  async (job: Job<InboundMessage>) => {
    switch (job.name) {
      case JOB_NAMES.FSM:
        return processMessage(job.data, job.id as string);
      default:
        break;
    }
  },
);

// ─── Graceful Shutdown ────────────────────────────────────────

registerGracefulShutdown([whatsappWorker, emailWorker, notificationWorker, fsmWorker]);

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