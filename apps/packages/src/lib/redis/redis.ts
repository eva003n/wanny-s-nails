import { Redis, type RedisOptions } from "ioredis";
import { config } from "../config.js";
import { logger } from "../logger.js";

const isProduction = config.REDIS_URL.startsWith("rediss://");

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

  connectionName: `${config.APP_NAME}-${process.pid}`,
  keepAlive: 30000,
  enableOfflineQueue: true,
};

// factory function to generate redis clients per workload
export function createRedisClient(name: string) {
  const client = new Redis(config.REDIS_URL as string, {
    ...redisConfig,
    connectionName: name,
  });

  if (isProduction) {
    client.on("connect", () => {
      logger.info(`[Redis:${name}] connected`);
    });

    // client.on("ready", () => {
    //   logger.info(`[Redis:${name}] ready`);
    // });

    // client.on("close", () => {
    //   logger.warn(`[Redis:${name}] connection closed`);
    // });

    client.on("reconnecting", () => {
      logger.warn(`[Redis:${name}] reconnecting`);
    });
  }

  client.on("error", (err) => {
    logger.error(`[Redis:${name}] error ${err}`);
  });

  return client;
}

const destroyRedisClient = async (client: Redis) => {
  return client.quit();
};

const redisFactory = {
  create: createRedisClient,
  destruy: destroyRedisClient,
};
