import { createRedisClient } from "@wannys-nails/packages";
import { config } from "./config.js";
const connectionName = "payment-worker";

export const redis = createRedisClient(connectionName, config);

export const paymentWorkerRedisConn = createRedisClient(connectionName, config);

