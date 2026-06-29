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
  type NotificationJobData,
  JOB_NAMES,
  type InboundMessage,
  type OutboundMessage,
  type WhatsAppMessagePayload,
} from "@wannys-nails/packages";
import { whatsappProcessor } from "./processors/whatsapp.processor.js";
import {
  emailProcessor,
  type EmailJobData,
} from "./processors/email.processor.js";
import { pushSender } from "./processors/push-sender.js";
import type { Job } from "bullmq";
import { log as logger} from "./lib/logger.js";
import { notificationWorkerRedisConn, whatsAppWorkerRedisConn } from "./lib/redis.js";

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
    return  await whatsappProcessor(job as unknown as Job<WhatsAppMessagePayload
        >);
    
    }

    // — handles whatsapp notifications (NotificationService.dispatch) —
    case JOB_NAMES.WHATSAPP: {
      const whatsappPayload: WhatsAppMessagePayload & { to: string } = {
        type: "text",
        to: job.data.endpoint.address,
        text: buildWhatsAppText(job.data),
      };
    return  await whatsappProcessor(job as unknown as Job<WhatsAppMessagePayload>);
    }
    case JOB_NAMES.EMAIL: {
      const emailPayload: EmailJobData = {
        to: job.data.endpoint.address,
        subject: job.data.template,
        html: JSON.stringify(job.data.payload),
      };
      return await emailProcessor(job as unknown as Job<EmailJobData>);
      
    }
    case JOB_NAMES.PUSH_NOTIFICATION: {
      return await pushSender(job);
      
    }
    default:
      log.warn(
        { event: "worker.unknown_job", queue: Queue_Names.NOTIFICATIONS, jobName },
        "Unknown notification job name",
      );
  }
}



// Finite state machine workers
const whatAppWorker = createWorker<InboundMessage | OutboundMessage>(
  {
    queueName: Queue_Names.NOTIFICATIONS,
    workerName: "fsm_worker",
    concurrency: 1,
    limiter: {
      // base on whatsapp tier
    },
  },
  async (job: Job<InboundMessage | OutboundMessage>) => {
    await whatsappProcessor(job.data as any);
  },
  whatsAppWorkerRedisConn.options,
  log,
);
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
   notificationWorkerRedisConn.options,
   log

);


// ─── Graceful Shutdown ────────────────────────────────────────

registerGracefulShutdown([notificationWorker, whatAppWorker]);

log.info(
  {
    event: "worker.process.started",
    worker: "notification",
    pid: process.pid,
  },
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