/**
 * Payment worker — processes the "payments" queue.
 *
 * Handles:
 *  - STK Push (initiates M-Pesa payment)
 *  - Payment verification (polls Daraja for result)
 */

import { createWorker, JOB_NAMES, Queue_Names, registerGracefulShutdown } from "@wannys-nails/packages";
import { stkPushProcessor, type StkPushJobData } from "./processors/stk-push.processor.js";
import { paymentVerifyProcessor, type PaymentVerifyJobData } from "./processors/payment-verify.processor.js";
import type { Job } from "bullmq";
import { paymentWorkerRedisConn } from "./lib/redis.js";
import { log } from "./lib/logger.js";

// ─── Payment Worker ──────────────────────────────────────────

interface PaymentJobData {
  bookingId: string;
  paymentId: string;
  [key: string]: any;
}

const worker = createWorker<PaymentJobData>(
  { queueName: Queue_Names.PAYMENTS, workerName: "payment", concurrency: 5 },
  async (job: Job<PaymentJobData>) => {
    switch (job.name) {
      case JOB_NAMES.STK_PUSH:
        return stkPushProcessor(job as any);
      case JOB_NAMES.STK_CALLBACK:
        return paymentVerifyProcessor(job as any);
      
      default:
        log.warn(
          { event: "worker.unknown_job", queue: Queue_Names.PAYMENTS, jobName: job.name })
    }
  },
  paymentWorkerRedisConn.options
);

// ─── Graceful Shutdown ────────────────────────────────────────

registerGracefulShutdown([worker]);