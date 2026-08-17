import { createRedisClient } from "@wannys-nails/core";
import { _config } from "./config.js";


const connectionName = "conversation-worker";

export const redis = createRedisClient(connectionName, _config);

// Redis connection spesific for the convesation worker
export const conversationWorkerRedisConn = createRedisClient(connectionName, _config);

