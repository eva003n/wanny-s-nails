import { createRedisClient } from "@wannys-nails/packages";
import { _config } from "./config.js";
const connectionName = "payment-worker";

export const redis = createRedisClient(connectionName, _config);

export const paymentWorkerRedisConn = createRedisClient(connectionName, _config);

