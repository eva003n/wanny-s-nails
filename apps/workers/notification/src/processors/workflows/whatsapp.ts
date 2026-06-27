import { logger } from "@wannys-nails/packages";
import type {
  OutboundMessage,
} from "@wannys-nails/packages";

import { JOB_NAMES, notificationQueue } from "@wannys-nails/packages";
import { config } from "../../lib/config.js";
import { redis } from "../../lib/redis.js";

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
export async function sendMessage(message: OutboundMessage, messageId: string) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;

  // Rate limiting
  const allowed = await checkRateLimit(message.to as string);
  if (!allowed) {
    log.warn(
      { event: "whatsapp.send.rate_limited", to: message.to },
      "Rate limited — message will be retried",
    );
    // Re-enqueue after delay (we'll integrate BullMQ for this in Phase 5)
    // For now, add a small delay and retry once
   
    notificationQueue.add(JOB_NAMES.FSM_OUT, message, {jobId: messageId, delay: RATE_LIMIT_RETRY_DELAY})
    
    const retryAllowed = await checkRateLimit(message.to as string);
    if (!retryAllowed) {
      log.warn(
        { event: "whatsapp.send.rate_limited_retry_failed", to: message.to },
        "Rate limit still active after retry",
      );
      return false;
    }
  }

  const job = await notificationQueue.add(JOB_NAMES.FSM_OUT, message, {
    jobId: messageId,
  });

  log.info({
    event: "fsm.message.enqueued",
    jobId: job?.id
  }, "Outbound message enqueued")
}
