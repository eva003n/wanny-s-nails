import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount } from "../session.js";
import { createRedisClient, } from "@wannys-nails/core";
import { log as logger, _config as config, redis, prisma } from "../../../lib/index.js";
import { sendMessage } from "../whatsapp.js";

const log = logger.child({ module: "fsm-human-escalation" });

/**
 * HUMAN_ESCALATION
 *
 * Triggered when:
 *  1. Customer explicitly asks for a human ("human", "agent", "help me", "talk to someone")
 *  2. Invalid input reaches the escalation threshold (this was previously routed
 *     through AI_FALLBACK; that path is now disabled — future versions may
 *     re-introduce AI handling before escalating)
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

  // 1. Send notification to owner via SSE/Redis pubsub
  try {
    const notificationPayload = JSON.stringify({
      title: "Customer needs help — Wanny's Nails",
      body: `${customerName} (${phone}) needs assistance.`,
      data: {
        url: ctx.session.customerId
          ? `/customers/${ctx.session.customerId}`
          : "/customers",
        customerPhone: phone,
        conversationSummary: "Customer requested human assistance.",
      },
      timestamp: new Date().toISOString(),
    });

    // Publish to Redis channel for SSE to pick up
    await redis.publish(
      "events",
      notificationPayload,
    );
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

  // 1b. Fallback: if the owner has no active Web Push subscription, text
  // them directly on WhatsApp so the escalation isn't silently missed.
  if (config.OWNER_WHATSAPP_PHONE) {
    try {
      const activeSubscriptions = await prisma.pushSubscription.count({
        where: { isActive: true },
      });

      if (activeSubscriptions === 0) {
        await sendMessage(config.OWNER_WHATSAPP_PHONE, {
          type: "text",
          text: `Customer needs help: ${customerName} (${phone}) is asking for assistance on WhatsApp.`,
        });
        log.info(
          { event: "human_escalation.owner_whatsapp_fallback_sent", phone },
          "No active push subscribers — sent WhatsApp fallback to owner",
        );
      }
    } catch (error) {
      log.error(
        { event: "human_escalation.owner_whatsapp_fallback_failed", error, phone },
        "Failed to send owner WhatsApp fallback",
      );
    }
  }

  // 2. Send confirmation message to customer
  const customerMessage = [
    "I'm going to connect you with our staff",
    "Please wait a moment — someone will be with you shortly.",
    "",
    `You can also call us on ${config.APP_NAME === "Wanny's Nails" ? "+254 700 000 000" : config.APP_NAME}.`,
  ].join("\n");

  return {
    messages: [{type: "text", text: customerMessage }],
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
    },
    nextState: "IDLE",
  };
}
