import Redis from "ioredis";
import { authRedisClient } from "./session.js";
import { cacheRedisClient } from "./cache.js";
import { createQueuesClient } from "./bullmq.js";
import { createWorkerRedisClient } from "./worker.js";

export const redis = {
  auth: authRedisClient,
  cache: cacheRedisClient,
  messageQueue: createQueuesClient,
  worker: createWorkerRedisClient,
};

// For backward compatibility
export const redisClient = redis;
