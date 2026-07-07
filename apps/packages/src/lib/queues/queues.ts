/**
 * Queue definitions and Redis connection factory.
 *
 * Shared by:
 *  - API process (producers that enqueue jobs)
 *  - Worker processes (consumers that process jobs)
 */

import { Queue, type ConnectionOptions } from "bullmq";
import { Queue_Names } from "../../constants.js";
import type { Redis } from "ioredis";

// ─── Queue factory ─────────────────────────────────────────
export function createQueues(connection: Redis) {
  return {
    notificationQueue: new Queue(Queue_Names.NOTIFICATIONS, {
      connection: connection as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: { age: 86400, count: 100 },
      },
    }),
    conversationQueue: new Queue(Queue_Names.CONVERSATIONS, {
      connection: connection as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: false,
        removeOnFail: { age: 86400, count: 100 },
      },
    }),
    paymentQueue: new Queue(Queue_Names.PAYMENTS, {
      connection: connection as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 30000 }, // after 30s
        removeOnComplete: true,
        removeOnFail: { age: 86400, count: 100 },
      },
    }),
  };
}
