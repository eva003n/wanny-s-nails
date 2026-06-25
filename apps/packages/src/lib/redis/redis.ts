/**
 * Factory for redis instances
 *
 * Reads REDIS_URL and APP_NAME from process.env directly — Docker injects these
 * at container start so no dotenv or zod validation is needed here.
 */

import { Redis, type RedisOptions } from "ioredis";
import { logger } from "../logger.js";

const REDIS_URL = process.env.REDIS_URL!;
const APP_NAME = process.env.APP_NAME || "Wanny's Nails";

const isProduction = REDIS_URL.startsWith("rediss://");


const redisConfig: RedisOptions = {
  maxRetriesPerRequest: null, // due to queues
  lazyConnect: true, // only connect when a command is sent
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

  connectionName: `${APP_NAME}-${process.pid}`,
  keepAlive: 30000,
  enableOfflineQueue: true,
};

// factory function to generate redis clients per workload
export function createRedisClient(name: string) {
  const client = new Redis(REDIS_URL, {
    ...redisConfig,
    connectionName: name,
  });

  if (isProduction) {
    client.on("connect", () => {
      logger.info(
        JSON.stringify({
          event: "Redis.connected",
          message: `[Redis:${name}] connected`,
        }),
      );
    });

    // client.on("ready", () => {
    //   logger.info(`[Redis:${name}] ready`);
    // });

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
  }

  client.on("error", (err) => {
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

export const destroyRedisClient = async (client: Array<Redis>) => {
  return Promise.all(client.map(c => c.quit()));
};


