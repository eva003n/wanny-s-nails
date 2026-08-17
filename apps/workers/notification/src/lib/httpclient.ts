

import { _config } from "./config.js";
import { log } from "./logger.js";

import { createHttpClient } from "@wannys-nails/core";

export const whatsappHttpClient = createHttpClient({
  serviceName: "whatsapp",
  baseURL: `https://graph.facebook.com/${_config.WHATSAPP_API_VERSION}`,
  timeoutMs: 8_000, // sends should be snappy; fail fast and let BullMQ retry the job instead
  maxRetries: 1, // BullMQ already retries the whole job — don't double up on retries here
  getAuthHeader: async () => ({
    Authorization: `Bearer ${_config.WHATSAPP_ACCESS_TOKEN}`,
  }),
  defaultHeaders: {
    "Content-Type": "application/json",
  },
}, log);
