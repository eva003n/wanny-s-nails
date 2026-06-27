import { createRedisClient } from "@wannys-nails/packages";
import { config } from "./config.js";
const connectionName = "api-cache";

export const redis = createRedisClient(connectionName, config);
