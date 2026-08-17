import { createQueues } from "@wannys-nails/core";
import { redis } from "./redis.js";

// queuss by producers
export const { notificationQueue, paymentQueue } = createQueues(redis);
