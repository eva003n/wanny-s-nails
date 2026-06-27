/**
 * Queue definitions and Redis connection factory.
 *
 * Shared by:
 *  - API process (producers that enqueue jobs)
 *  - Worker processes (consumers that process jobs)
 */

import { Queue } from "bullmq";
import { rotificationRedisConn, paymentRedisConn } from "./bullmq.js";
import { Queue_Names } from "../../constants.js";


// ─── Queue Definitions ─────────────────────────────────────────

export const notificationQueue = new Queue(Queue_Names.NOTIFICATIONS, {
  connection: rotificationRedisConn.options,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 86400, count: 100 },
    removeOnFail: { age: 86400, count: 100 },
  },
});

export const paymentQueue = new Queue(Queue_Names.PAYMENTS, {
  connection: paymentRedisConn.options,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 30000 }, // after 30s
  },
});

// export const reminderQueue = new Queue(, {
//   connection: redis.options,
//   defaultJobOptions: {
//     attempts: 3,
//     backoff: { type: "exponential", delay: 60000 },
//   },
// });

// export const bookingQueue = new Queue(Queue_Names.BOOKINGS, {
//   connection: redis.options,
//   defaultJobOptions: {
//     attempts: 2,
//     backoff: { type: "fixed", delay: 30000 },
//   },
// });



// ─── Enqueue Helpers ───────────────────────────────────────────


