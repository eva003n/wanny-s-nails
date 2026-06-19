import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount } from "../session.js";
import { redis } from "../../shared/lib/redis.js";
import { logger } from "../../shared/lib/logger.js";
import { config } from "../../shared/lib/config.js";

const log = logger.child({ module: "fsm-human-escalation" });

/**
 * HUMAN_ESCALATION
 *
 * Triggered when:
 *  1. Customer explicitly asks for a human ("human", "agent", "help me", "talk to someone")
 *  2. AI_FALLBACK cannot resolve the issue
 *
 * Actions:
 *  1. Send Web Push notification to owner's PWA (via SSE)
 *  2. Send confirmation message to customer
 *  3. Clear session → IDLE
 */
export async function handleHumanEscalation(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const customerName = ctx.session.customerName || "Customer";
  const phone = ctx.phone;

  // Build conversation summary from AI context
  const aiContext = ctx.session.aiContext ?? [];
  const lastMessages = aiContext
    .slice(-4)
    .map((m) => `${m.role}: ${m.parts.map((p) => p.text).join(" ")}`)
    .join("\n");

  // 1. Send notification to owner via SSE/Redis pubsub
  try {
    const notificationPayload = JSON.stringify({
      title: "Customer needs help — Wanny's Nails",
      body: `${customerName} (${phone}) needs assistance.`,
      data: {
        url: ctx.session.customerId ? `/customers/${ctx.session.customerId}` : "/customers",
        customerPhone: phone,
        conversationSummary: lastMessages || "No conversation history available",
      },
      timestamp: new Date().toISOString(),
    });

    // Publish to Redis channel for SSE to pick up
    await redis.publish("notification:human-escalation", notificationPayload);
    log.info(
      { event: "human_escalation.notification_sent", phone, customerName },
      "Human escalation notification sent",
    );
  } catch (error) {
    log.error(
      { event: "human_escalation.notification_failed", error, phone },
      "Failed to send human escalation notification",
    );
  }

  // 2. Send confirmation message to customer
  const customerMessage = [
    "I'm going to connect you with our team right away.",
    "Please wait a moment — someone will be with you shortly.",
    "",
    `You can also call us on ${config.APP_NAME === "Wanny's Nails" ? "+254 700 000 000" : config.APP_NAME}.`,
  ].join("\n");

  return {
    messages: [{ type: "text", text: customerMessage }],
    sessionUpdates: {
      ...resetInvalidCount(ctx.session),
      // Clear all flow-related data
      bookingId: undefined,
      bookingRef: undefined,
      paymentPhone: undefined,
      selectedService: undefined,
      selectedDate: undefined,
      selectedTime: undefined,
      appointmentAt: undefined,
      flow: undefined,
      aiContext: undefined,
    },
    nextState: "IDLE",
  };
}