import axios from "axios";
import { redis } from "../shared/lib/redis.js";
import { config } from "../shared/lib/config.js";
import { logger } from "../shared/lib/logger.js";
import type { OutboundMessage, WhatsAppNotificationPayload } from "@wannys-nails/packages";

import { JOB_NAMES, notificationQueue } from "@wannys-nails/packages";

const log = logger.child({ module: "whatsapp-api" });


const RATE_LIMIT_RETRY_DELAY = 2000; // ms to re-enqueue if rate limited
const RATE_LIMIT_TTL = 2; // seconds between messages per recipient

/**
 * Enforce per-recipient rate limit using Redis token bucket.
 * Returns true if message is allowed, false if rate limited.
 */
async function checkRateLimit(phone: string): Promise<boolean> {
  const key = `whatsapp:ratelimit:${phone}`;
  const exists = await redis.exists(key);
  if (exists) {
    return false; // Rate limited
  }
  await redis.setex(key, RATE_LIMIT_TTL, "1");
  return true;
}

/**
 * High-level send function. Handles rate limiting and dispatches to the
 * appropriate WhatsApp message type.
 *
 * If rate limited, the message is silently dropped. In production, you'd
 * re-enqueue to BullMQ with a delay.
 */
export async function sendMessage(
  message: WhatsAppNotificationPayload | OutboundMessage,
) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;

  // Rate limiting
  const allowed = await checkRateLimit(message.to);
  if (!allowed) {
    log.warn(
      { event: "whatsapp.send.rate_limited", to: message.to },
      "Rate limited — message will be retried",
    );
    // Re-enqueue after delay (we'll integrate BullMQ for this in Phase 5)
    // For now, add a small delay and retry once
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY));
    const retryAllowed = await checkRateLimit(message.to);
    if (!retryAllowed) {
      log.warn(
        { event: "whatsapp.send.rate_limited_retry_failed", to: message.to },
        "Rate limit still active after retry",
      );
      return false;
    }
  }

  notificationQueue.add(JOB_NAMES.WHATSAPP, message)
}