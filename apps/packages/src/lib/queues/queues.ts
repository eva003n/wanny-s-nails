/**
 * Queue definitions and Redis connection factory.
 *
 * Shared by:
 *  - API process (producers that enqueue jobs)
 *  - Worker processes (consumers that process jobs)
 */

import { Queue, type ConnectionOptions, type QueueOptions } from "bullmq";
import { redisClient } from "../redis/index.js";
import { Queue_Names } from "../../constants.js";


// ─── Queue Definitions ─────────────────────────────────────────

export const notificationQueue = new Queue(Queue_Names.NOTIFICATIONS, {
  connection: redisClient.messageQueue() as ConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  },
});

export const paymentQueue = new Queue(Queue_Names.PAYMENTS, {
  connection: redisClient.messageQueue() as ConnectionOptions,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 30000 },// after 30s 
  },
});

export const reminderQueue = new Queue("reminders", {
  connection: redisClient.messageQueue() as ConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60000 },
  },
});

export const bookingQueue = new Queue("bookings", {
  connection: redisClient.messageQueue() as ConnectionOptions,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 30000 },
  },
});



// ─── Enqueue Helpers ───────────────────────────────────────────


