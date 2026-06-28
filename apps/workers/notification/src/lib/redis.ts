import { createRedisClient } from "@wannys-nails/packages";
import { _config } from "./config.js";
import {log} from "./logger.js"

const connectionName = "notification_worker";
// redis connection for normal redis connections
export const redis = createRedisClient(connectionName, _config);

// Each worker gets its on connection(workers establish blocking connections)
export const notificationWorkerRedisConn = createRedisClient(
  connectionName,
  _config,
);

export const whatsAppWorkerRedisConn = createRedisClient(
  "whatsapp_worker",
  _config,
);

redis.on("connect", () => {
  log.info(
    JSON.stringify({
      event: "Redis.connected",
      message: `[Redis:${connectionName}] connected`,
    }),
  );
});

redis.on("close", () => {
  log.warn(
    JSON.stringify({
      event: "Redis.disconnected",
      message: `[Redis:${connectionName}] connection closed`,
    }),
  );
});

redis.on("reconnecting", () => {
  log.warn(
    JSON.stringify({
      event: "Redis.disconnected",
      message: `[Redis:${connectionName}] reconnecting`,
    }),
  );
});

redis.on("error", (err: Error) => {
  log.error(
    JSON.stringify({
      event: "Redis.connection.error",
      connectionName: connectionName,
      error: err,
    }),
  );
});