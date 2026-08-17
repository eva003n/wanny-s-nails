import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { incrementInvalidCount, resetInvalidCount } from "../session.js";
import { log as logger } from "../../../lib/index.js";

import { prisma } from "../../../lib/prisma.js";
import { maskKenyanPhone } from "@wannys-nails/core";

const log = logger.child({ module: "fsm-data-collection" });

/**
 * DATA_COLLECTION
 *
 * Collects the customer's name from new customers before creating
 * their customer record in the database.
 *
 * Sub-phases (tracked via session.collectionPhase):
 *  "NAME"  → Ask for the customer's name
 *
 * After the name is collected:
 *  - Create the customer record in DB using the WhatsApp phone number (ctx.phone)
 *  - Transition back to BOOKING_CONFIRMATION (or fallback to GREETING on error)
 */

export async function handleDataCollection(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const phase = ctx.session.collectionPhase;

  // ── Entry with empty message (called by engine on state transition) ──
  if (!ctx.rawMessage || ctx.message === "") {
    return sendNamePrompt(ctx);
  }

  // ── Phase: NAME ──
  if (phase === "NAME") {
    const name = ctx.rawMessage.trim();

    // Validate name
    if (!name || name.length < 5) {
      const newSession = incrementInvalidCount(ctx.session);
      return {
        messages: [
          {
            type: "text",
            text: "Please enter your full name (at least 5 characters).",
          },
        ],
        sessionUpdates: newSession,
        nextState: "DATA_COLLECTION",
      };
    }

    log.info(
      {
        event: "data_collection.name_collected",
        phone: maskKenyanPhone(ctx.phone),
      },
      "Customer name collected",
    );

    // Create customer record in DB using the WhatsApp phone number
    const senderPhone = ctx.session.customerPhone || ctx.phone;
    try {
      const customer = await prisma.customer.create({
        data: {
          name,
          phone: senderPhone,
          consentGiven: true,
          consentAt: new Date(),
        },
      });

      log.info(
        {
          event: "data_collection.customer_created",
          customerId: customer.id,
          phone: maskKenyanPhone(ctx.phone),
        },
        "New customer record created from WhatsApp data collection",
      );

      // Transition back to BOOKING_CONFIRMATION — engine auto-prompt will render the confirmation buttons
      return {
        messages: [],
        sessionUpdates: {
          ...resetInvalidCount(ctx.session),
          customerId: customer.id,
          customerName: customer.name,
          isNewCustomer: false,
          collectionPhase: undefined,
          temporaryName: undefined,
        },
        nextState: "BOOKING_CONFIRMATION",
      };
    } catch (error) {
      log.error(
        {
          event: "data_collection.create_customer_failed",
          error,
          phone: maskKenyanPhone(ctx.phone),
        },
        "Failed to create customer record",
      );

      // Graceful fallback — still proceed to GREETING with the name we collected
      return {
        messages: [
          {
            type: "text",
            text: `Thanks, ${name}! We'll pick up where we left off. 😊`,
          },
        ],
        sessionUpdates: {
          ...resetInvalidCount(ctx.session),
          customerName: name,
          isNewCustomer: false,
          collectionPhase: undefined,
          temporaryName: undefined,
        },
        nextState: "GREETING",
      };
    }
  }

  // ── Fallback (shouldn't happen) ──
  return {
    messages: [],
    sessionUpdates: resetInvalidCount(ctx.session),
    nextState: "GREETING",
  };
}

function sendNamePrompt(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  return Promise.resolve({
    messages: [
      {
        type: "text" as const,
        text: "1'd love to get to know you better.\nWhat's your name?",
      },
    ],
    sessionUpdates: {
      ...resetInvalidCount(ctx.session),
      collectionPhase: "NAME",
    },
    nextState: "DATA_COLLECTION" as const,
  });
}
