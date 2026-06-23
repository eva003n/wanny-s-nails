import { config } from "../config.js"
import { createRedisClient } from "./redis.js";

const connectopnName = `${config.APP_NAME}-queues`

export const createQueuesClient = () => createRedisClient(connectopnName);
