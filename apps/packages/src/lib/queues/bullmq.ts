import { configSchema } from "../../lib/config.js";
import { createRedisClient } from "../redis.js";
import { config } from "../../lib/config.js";
const connectionName = "queues";

// each queue gets its one connection
export const rotificationRedisConn =  createRedisClient(connectionName, config );
export const paymentRedisConn =  createRedisClient(connectionName, config );
