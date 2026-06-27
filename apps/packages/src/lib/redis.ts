/**
 * Factory for redis instances
 *
 * Reads REDIS_URL and APP_NAME from process.env directly — Docker injects these
 * at container start so no dotenv or zod validation is needed here.
 */

import { Redis, type RedisOptions } from "ioredis";
import { logger } from "./logger.js";
// const REDIS_URL = process.env.REDIS_URL!;
// const APP_NAME = process.env.APP_NAME || "Wanny's Nails";

// factory function to generate redis clients per workload
type Config = {
  APP_NAME: string
  REDIS_URL: string
}

export function createRedisClient(name: string, config: Config) {
  const isProduction = config.REDIS_URL.startsWith("rediss://");

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

    connectionName: `${config.APP_NAME}-${process.pid}`,
    keepAlive: 30000,
    enableOfflineQueue: true, // queues commands in memory when redis is down(monitor memory usage)
  };

  const url = config.REDIS_URL
  const appName = config.APP_NAME

try {
    if(!url) {
    throw new Error("REDIS_URL is required");
  }
  if(!appName) {
    throw new Error("APP_NAME is required");
  }
}catch(err: any) {
  logger.error({
    event: "Redis.connection.error",
    connectionName: `${config.APP_NAME}:${name}`,
    error: err?.message
  })
}

  const client = globalThis.redis ?? 
   new Redis(url, {
    ...redisConfig,
    connectionName: `${appName}:${name}`,
  });

  // dev only during hot reload eg nodemon
  if(!isProduction) {
    globalThis.redis = client
  }

    client.on("connect", () => {
      logger.info(
        JSON.stringify({
          event: "Redis.connected",
          message: `[Redis:${name}] connected`,
        }),
      );
    });

    client.on("close", () => {
      logger.warn(
        JSON.stringify({
          event: "Redis.disconnected",
          message: `[Redis:${name}] connection closed`,
        }),
      );
    });

    client.on("reconnecting", () => {
      logger.warn(
        JSON.stringify({
          event: "Redis.disconnected",
          message: `[Redis:${name}] reconnecting`,
        }),
      );
    });
  
  client.on("error", (err: Error) => {
    logger.error(
      JSON.stringify({
        event: "Redis.error",
        connectionName: name,
        error: err,
      }),
    );
  });

  return client;
}

