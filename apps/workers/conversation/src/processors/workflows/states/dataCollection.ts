import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { incrementInvalidCount, resetInvalidCount } from "../session.js";
import { log as logger, } from "../../../lib/index.js";
import {z} from "zod"

import { prisma } from "../../../lib/prisma.js";
import { normalizeKenyanPhone } from "@wannys-nails/packages";

const log = logger.child({ module: "fsm-data-collection" });

/** Commands the user can send to skip email collection */
const SKIP_KEYWORDS = /^(skip|no|nah|none|n\/a)$/i;

/**
 * DATA_COLLECTION
 *
 * Collects name and email from new customers before they enter the main menu.
 *
 * Sub-phases (tracked via session.collectionPhase):
 *  "NAME"  → Ask for the customer's name
 *  "EMAIL" → Ask for the customer's email (optional, can skip)
 *
 * After both fields are collected:
 *  - Create the customer record in DB
 *  - Transition to GREETING (menu auto-prompted by engine)
 */

export const phoneNumberSchema = z
  .string()
  .trim()
  .min(10, "Phone number is too short.")
  .max(12, "Phone number is too long.")
  .regex(
    /^\+[1-9]\d{1,14}$/,
    "Phone number must be in E.164 format (e.g. +254712345678)",
  );

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
      { event: "data_collection.name_collected", phone: ctx.phone },
      "Customer name collected",
    );

    // Save name and move to EMAIL phase
    return {
      messages: [
        {
          type: "text",
          text: `Nice to meet you, ${name}! \u{1F60A}\n\nCould you share your whatsapp phone number for automated remainders?`,
        },
      ],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        temporaryName: name,
        collectionPhase: "PHONE",
      },
      nextState: "DATA_COLLECTION",
    };
  }

  // ── Phase: PHONE ──
  if (phase === "PHONE") {
    const input = ctx.rawMessage.trim();
    // 1. Remove all spaces, dashes, or parentheses if any exist
    let phone = input.replace(/[\s\-\(\)]/g, "");

    try {
      phone = normalizeKenyanPhone(phone);
      const {data} = phoneNumberSchema.safeParse(phone)
      ctx.phone = data ?? ctx.phone
  

    }catch(error) {
      const newSession = incrementInvalidCount(ctx.session);
      return {
        messages: [
          {
            type: "text",
            text: "That doesn't look like a valid phone number. Please enter a valid phone number",
          },
        ],
        sessionUpdates: newSession,
        nextState: "DATA_COLLECTION",
      };
    
    }
    

    // Create customer record in DB
    const name = ctx.session.temporaryName || "Customer";
    try {
      const customer = await prisma.customer.create({
        data: {
          name,
          phone: ctx.phone,
          // email: email ?? null,
          consentGiven: true,
          consentAt: new Date(),
        },
      });

      log.info(
        {
          event: "data_collection.customer_created",
          customerId: customer.id,
          phone: ctx.phone,
        },
        "New customer record created from WhatsApp data collection",
      );

      // Transition to GREETING — engine step 8b will auto-prompt the greeting menu
      return {
        messages: [],
        sessionUpdates: {
          ...resetInvalidCount(ctx.session),
          customerId: customer.id,
          customerName: customer.name,
          isNewCustomer: false,
          collectionPhase: undefined,
          temporaryName: undefined,
          temporaryEmail: undefined,
        },
        nextState: "BOOKING_CONFIRMATION",
      };
    } catch (error) {
      log.error(
        {
          event: "data_collection.create_customer_failed",
          error,
          phone: ctx.phone,
        },
        "Failed to create customer record",
      );
    
      // Graceful fallback — still proceed to GREETING with the name we collected
      return {
        messages: [],
        sessionUpdates: {
          ...resetInvalidCount(ctx.session),
          customerName: name,
          isNewCustomer: false,
          collectionPhase: undefined,
          temporaryName: undefined,
          temporaryEmail: undefined,
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
