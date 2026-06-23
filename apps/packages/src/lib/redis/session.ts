import { createRedisClient } from "./redis.js";
import {config} from "../config.js"

const connectionName = `${config.APP_NAME}-auth`

export const authRedisClient = createRedisClient(connectionName)
