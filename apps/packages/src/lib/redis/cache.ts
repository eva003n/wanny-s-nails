import { config } from "../config.js";
import { createRedisClient } from "./redis.js";

const connectionName = `${config.APP_NAME}-cache`;

export const cacheRedisClient = createRedisClient(connectionName);
