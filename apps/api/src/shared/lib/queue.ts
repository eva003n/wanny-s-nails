import { Queue } from "bullmq";
import { config } from "./config.js";

const connectionOptions = {
  host: new URL(config.REDIS_URL).hostname,
  port: Number(new URL(config.REDIS_URL).port || 6379),
  password: new URL(config.REDIS_URL).password || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const notificationQueue = new Queue("notifications", {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

export const paymentQueue = new Queue("payments", {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 30000,
    },
  },
});

export const reminderQueue = new Queue("reminders", {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 60000,
    },
  },
});

export const bookingQueue = new Queue("bookings", {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 30000,
    },
  },
});