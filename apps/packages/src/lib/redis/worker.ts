import { createRedisClient } from "./redis.js";
import {config} from "../config.js"

const connectionName = `${config.APP_NAME}-worker`

export const createWorkerRedisClient = () => createRedisClient(connectionName);
