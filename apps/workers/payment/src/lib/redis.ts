import { createRedisClient } from "@wannys-nails/core";
import { _config } from "./config.js";
const connectionName = "payment-worker";

export const redis = createRedisClient(connectionName, _config);

export const paymentWorkerRedisConn = createRedisClient(connectionName, _config);

