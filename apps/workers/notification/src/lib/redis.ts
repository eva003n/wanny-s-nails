import { createRedisClient } from "@wannys-nails/packages";
import { config } from "./config.js";

export const redis = createRedisClient("notification-cache", config)

export const notificationWorkerRedisConn = createRedisClient("notification_worker", config);

export const whatsAppWorkerRedisConn = createRedisClient("whatsapp_worker", config);