import { _config } from "./config.js";
import { logger } from "./logger.js";
import { createRedisClient } from "@wannys-nails/packages";

const connectionName = "api";

// shared redis connection for caching | queues
export const redis = createRedisClient(connectionName, _config);

redis.on("connect", () => {
  logger.info(
    JSON.stringify({
      event: "Redis.connected",
      message: `[Redis:${connectionName}] connected`,
    }),
  );
});

redis.on("close", () => {
  logger.warn(
    JSON.stringify({
      event: "Redis.disconnected",
      message: `[Redis:${connectionName}] connection closed`,
    }),
  );
});

redis.on("reconnecting", () => {
  logger.warn(
    JSON.stringify({
      event: "Redis.disconnected",
      message: `[Redis:${connectionName}] reconnecting`,
    }),
  );
});

redis.on("error", (err: Error) => {
  logger.error(
    JSON.stringify({
      event: "Redis.connection.error",
      connectionName: connectionName,
      error: err,
    }),
  );
});