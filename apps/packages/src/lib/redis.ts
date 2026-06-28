/**
 * Factory for redis instances
 *
 * Reads REDIS_URL and APP_NAME from process.env directly — Docker injects these
 * at container start so no dotenv or zod validation is needed here.
 */

import { Redis, type RedisOptions } from "ioredis";
// const REDIS_URL = process.env.REDIS_URL!;
// const APP_NAME = process.env.APP_NAME || "Wanny's Nails";

// factory function to generate redis clients per workload
type Config = {
  APP_NAME: string | undefined
  REDIS_URL: string | undefined
}

export function createRedisClient(name: string, config: Config) {
  const isProduction = config.REDIS_URL?.startsWith("rediss://");

  const redisConfig: RedisOptions = {
    maxRetriesPerRequest: null, // due to queues
    enableReadyCheck: true, // wait until data is loaded from disk before being ready

    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);

      return delay;
    },

    reconnectOnError(err) {
      const targetErrors = ["READONLY", "ETIMEDOUT"];

      if (targetErrors.some((e) => err.message.includes(e))) {
        return true;
      }

      return false;
    },

    ...(isProduction
      ? {
          tls: {},
        }
      : {}),

    connectionName: name,
    keepAlive: 30000,
    enableOfflineQueue: true, // queues commands in memory when redis is down(monitor memory usage)
  };

  const url = config.REDIS_URL
  const appName = config.APP_NAME


    if(!url) {
    throw new Error("REDIS_URL is required");
  }
  if(!appName) {
    throw new Error("APP_NAME is required");
  }

  const client =
    globalThis.redis ??
    new Redis(url, {
      ...redisConfig,
      connectionName: `${appName}:${name}`,
    });

  // dev only during hot reload eg nodemon
  if (!isProduction) {
    globalThis.redis = client;
  }

  return client;

}
  


