/**
 * Reminder worker — processes the "reminders" queue.
 *
 * Handles:
 *  - 24-hour appointment reminders
 *  - 1-hour appointment reminders
 */

import {
  createWorker,
  InboundMessage,
  JOB_NAMES,
  NormalisedEvent,
  OutboundMessage,
  registerGracefulShutdown,
} from "@wannys-nails/packages";


import { Queue_Names } from "@wannys-nails/packages";
import type { Job } from "bullmq";
import { conversationWorkerRedisConn, log } from "./lib/index.js";
import { processMessage } from "./processors/workflows/engine.js";
import { whatsappProcessor } from "./processors/whatsapp.processor.js";



async function handleWhatsappJob(
  job: Job<NormalisedEvent | OutboundMessage>,
) {
  switch (job.name) {
    // — Inbound WhatsApp messages (enqueued by webhook controller → FSM) —

    case JOB_NAMES.FSM_IN:
      return processMessage(job.data as NormalisedEvent);
    // Outbound Whatsapp messages (enqueued by FSM)
    case JOB_NAMES.FSM_OUT:
      return await whatsappProcessor(job as unknown as Job<OutboundMessage>);

    default:
      log.warn(
        {
          event: "worker.unknown_job",
          queue: Queue_Names.NOTIFICATIONS,
          jobName: job.name,
        },
        "Unknown conversation whatsapp job name",
      );
  }
}
// ─── Conversation Worker ─────────────────────────────────────────


const worker = createWorker<NormalisedEvent | OutboundMessage>(
  { queueName: Queue_Names.CONVERSATIONS, workerName: "conversation", concurrency: 1 },
  async (job: Job<NormalisedEvent | OutboundMessage>) => {
    await handleWhatsappJob(job as any)
  },
  conversationWorkerRedisConn.options,
  log
);

// ─── Graceful Shutdown ────────────────────────────────────────

registerGracefulShutdown([worker], log);
