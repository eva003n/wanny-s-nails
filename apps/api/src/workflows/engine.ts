import type { ConversationSession, ConversationState, StateHandlerContext, StateTransitionResult } from "./types.js";
import { loadSession, saveSession, deleteSession, createNewSession } from "./session.js";
import { sendMessage } from "./whatsapp.js";
import { logger } from "../shared/lib/logger.js";
import { redis } from "../shared/lib/redis.js";

// State handlers
import { handleIdle } from "./states/idle.js";
import { handleGreeting, buildMainMenuMessage } from "./states/greeting.js";
import { handleDataCollection } from "./states/dataCollection.js";
import { handleCategorySelection } from "./states/categorySelection.js";
import { handleServiceSelection } from "./states/serviceSelection.js";
import { handleDateSelection } from "./states/dateSelection.js";
import { handleTimeSelection } from "./states/timeSelection.js";
import { handleBookingConfirmation } from "./states/bookingConfirmation.js";
import { handleAwaitingPaymentPhone } from "./states/awaitingPaymentPhone.js";
import { handleAwaitingPayment } from "./states/awaitingPayment.js";
import { handleCancelConfirmation } from "./states/cancelConfirmation.js";
import { handleRescheduleDate, handleRescheduleTime, handleRescheduleConfirmation } from "./states/reschedule.js";
import { handleAiFallback } from "./states/aiFallback.js";
import { handleHumanEscalation } from "./states/humanEscalation.js";

const log = logger.child({ module: "fsm-engine" });

// ─── Global Intent Keywords ───

const HUMAN_KEYWORDS = /^(human|agent|help me|talk to someone)$/i;
const STOP_KEYWORDS = /^(stop|unsubscribe)$/i;
const MENU_KEYWORDS = /^(menu|start)$/i;

// ─── State Handler Map ───

type StateHandler = (ctx: StateHandlerContext) => Promise<StateTransitionResult>;

const STATE_HANDLERS: Record<ConversationState, StateHandler> = {
  IDLE: handleIdle,
  GREETING: handleGreeting,
  DATA_COLLECTION: handleDataCollection,
  CATEGORY_SELECTION: handleCategorySelection,
  SERVICE_SELECTION: handleServiceSelection,
  DATE_SELECTION: handleDateSelection,
  TIME_SELECTION: handleTimeSelection,
  BOOKING_CONFIRMATION: handleBookingConfirmation,
  AWAITING_PAYMENT_PHONE: handleAwaitingPaymentPhone,
  AWAITING_PAYMENT: handleAwaitingPayment,
  RESCHEDULE_DATE: handleRescheduleDate,
  RESCHEDULE_TIME: handleRescheduleTime,
  RESCHEDULE_CONFIRMATION: handleRescheduleConfirmation,
  CANCEL_CONFIRMATION: handleCancelConfirmation,
  AI_FALLBACK: handleAiFallback,
  HUMAN_ESCALATION: handleHumanEscalation,
};

// ─── FSM Engine ───

/**
 * Process an incoming WhatsApp message through the FSM.
 *
 * This is the main entry point called by the webhook handler.
 * It handles:
 *  1. Session loading (or creation)
 *  2. Global intent detection
 *  3. State routing
 *  4. Transition execution
 *  5. Session saving
 *  6. Outbound message sending
 */


export async function processMessage(
  phone: string,
  messageText: string,
): Promise<void> {
  log.info({ event: "fsm.process.start", phone }, "Processing WhatsApp message");

  // ── 1. Load or create session ──

  let session = await loadSession(phone);
  let isNewSession = false;

  if (!session) {
    session = createNewSession();
    isNewSession = true;
  }

  const previousState = session.state;

  // ── 2. Global intent detection (before state handler) ──

  const trimmedMessage = messageText.trim();

  // STOP — opt out
  if (STOP_KEYWORDS.test(trimmedMessage)) {
    log.info({ event: "fsm.global.stop", phone }, "Customer opted out");
    await deleteSession(phone);

    await sendMessage(phone, {
      type: "text",
      text: "You've been unsubscribed from messages. If you'd like to re-subscribe, just send us a message. Take care! 👋",
    });

    // Log consent withdrawal
    try {
      const { prisma } = await import("../shared/lib/prisma.js");
      const { customersService } = await import("../modules/customers/customers.service.js");
      const customer = await customersService.getByPhone(phone);
      if (customer) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { consentGiven: false, consentAt: new Date() },
        });
      }
    } catch (error) {
      log.error({ event: "fsm.global.stop.consent_log_failed", error, phone }, "Failed to log consent withdrawal");
    }

    return;
  }

  // HUMAN — explicit request for human (skip AI, go directly to escalation)
  if (HUMAN_KEYWORDS.test(trimmedMessage) && session.state !== "IDLE" && session.state !== "HUMAN_ESCALATION") {
    log.info({ event: "fsm.global.human", phone }, "Customer explicitly requested human");
    session.state = "HUMAN_ESCALATION";
  }

  // MENU / START — restart flow (only in non-IDLE states)
  if (MENU_KEYWORDS.test(trimmedMessage) && session.state !== "IDLE" && session.state !== "GREETING") {
    log.info({ event: "fsm.global.menu", phone }, "Customer requested menu restart");
    session.state = "GREETING";
    // Clear flow-specific data
    session.selectedService = undefined;
    session.selectedCategory = undefined;
    session.selectedDate = undefined;
    session.selectedTime = undefined;
    session.appointmentAt = undefined;
    session.flow = undefined;
    session.invalidInputCount = 0;
  }

  // ── 3. Handle IDLE state → transition to GREETING or DATA_COLLECTION ──

  if (session.state === "IDLE") {
    const ctx: StateHandlerContext = {
      message: trimmedMessage.toLowerCase(),
      rawMessage: messageText,
      session,
      phone,      
    };

    const result = await handleIdle(ctx);
    applyTransition(session, result);
    await saveSession(phone, session);

    // If the IDLE handler returned messages, send them
    for (const msg of result.messages) {
      await sendMessage(phone, msg);
    }

    // Reload session after IDLE handler
    session = (await loadSession(phone)) ?? session;

    // Check what state the IDLE handler transitioned to
    if (session.state === "DATA_COLLECTION") {
      // New customer — send the DATA_COLLECTION entry prompt (name question)
      const entryHandler = STATE_HANDLERS["DATA_COLLECTION"];
      if (entryHandler) {
        try {
          const entryCtx: StateHandlerContext = {
            message: "",
            rawMessage: "",
            session: { ...session, invalidInputCount: 0 },
            phone,
          };
          const entryResult = await entryHandler(entryCtx);
          for (const msg of entryResult.messages) {
            await sendMessage(phone, msg);
          }
        } catch (error) {
          log.error(
            { event: "fsm.entry_prompt.error", state: "DATA_COLLECTION", error, phone },
            "Failed to generate DATA_COLLECTION prompt",
          );
        }
      }
      await saveSession(phone, session);
      return;
    }

    // Returning customer — send greeting menu
    session.state = "GREETING";

    const name = session.customerName || "there";
    await sendMessage(phone, buildMainMenuMessage(name));

    await saveSession(phone, session);
    return;
  }

  // ── 5. Route to current state handler ──

  const currentState = session.state;
  const handler = STATE_HANDLERS[currentState];

  if (!handler) {
    log.error({ event: "fsm.no_handler", state: currentState, phone }, "No handler for state");
    session.state = "GREETING";
    await saveSession(phone, session);
    return;
  }

  const ctx: StateHandlerContext = {
    message: trimmedMessage.toLowerCase(),
    rawMessage: messageText,
    session: { ...session }, // Clone to avoid mutation during processing
    phone,
  };

  let result: StateTransitionResult;
  try {
    result = await handler(ctx);
  } catch (error) {
    log.error(
      { event: "fsm.handler.error", state: currentState, error, phone },
      "State handler threw an error",
    );
    // Fail safe: escalate to human on any unhandled error
    result = {
      messages: [],
      sessionUpdates: {},
      nextState: "HUMAN_ESCALATION",
    };
  }

  // ── 6. Apply transition ──

  applyTransition(session, result);

  // ── 7. Handle invalid input count escalation to AI_FALLBACK ──

  if (
    session.invalidInputCount >= 3 &&
    currentState !== "AI_FALLBACK" &&
    currentState !== "HUMAN_ESCALATION" &&
    result.nextState !== "AI_FALLBACK" &&
    result.nextState !== "HUMAN_ESCALATION" &&
    result.nextState !== "GREETING"
  ) {
    log.info(
      { event: "fsm.invalid_input.escalation", count: session.invalidInputCount, phone },
      "Invalid input count reached 3 — escalating to AI_FALLBACK",
    );
    session.state = "AI_FALLBACK";
    session.invalidInputCount = 0;

    // Try AI fallback
    const aiCtx: StateHandlerContext = {
      message: trimmedMessage.toLowerCase(),
      rawMessage: messageText,
      session: { ...session },
      phone,
    };

    try {
      const aiResult = await handleAiFallback(aiCtx);
      applyTransition(session, aiResult);

      // Send AI response
      for (const msg of aiResult.messages) {
        await sendMessage(phone, msg);
      }

      await saveSession(phone, session);
      return;
    } catch (error) {
      log.error({ event: "fsm.ai_fallback.error", error, phone }, "AI fallback handler failed");
      // Fall through to HUMAN_ESCALATION
      session.state = "HUMAN_ESCALATION";
    }
  }

  // ── 8. Send outbound messages ──

  for (const msg of result.messages) {
    await sendMessage(phone, msg);
  }

  // ── 8b. Send initial prompt if transitioning to a new state with no messages ──
  //
  // State handlers return messages: [] when they transition to a new state
  // (e.g. GREETING → SERVICE_SELECTION). The new state's handler only renders
  // its menu on *user input* (its "invalid input" branch). Without this step
  // the user would never see the menu for the new state.

  if (result.messages.length === 0 && session.state !== previousState) {
    const nextHandler = STATE_HANDLERS[session.state];
    if (nextHandler) {
      try {
        const entryCtx: StateHandlerContext = {
          message: "",
          rawMessage: "",
          session: { ...session, invalidInputCount: 0 },
          phone,
        };
        const entryResult = await nextHandler(entryCtx);
        for (const msg of entryResult.messages) {
          await sendMessage(phone, msg);
        }
      } catch (error) {
        log.error(
          { event: "fsm.entry_prompt.error", state: session.state, error, phone },
          "Failed to generate initial prompt for new state",
        );
      }
    }
  }

  // ── 9. Save updated session ──

  await saveSession(phone, session);

  log.info(
    {
      event: "fsm.process.complete",
      phone,
      previousState,
      newState: session.state,
      messagesSent: result.messages.length,
    },
    "Message processing complete",
  );
}

/**
 * Apply a state transition result to the session.
 */
function applyTransition(
  session: ConversationSession,
  result: StateTransitionResult,
): void {
  // Apply session updates
  Object.assign(session, result.sessionUpdates);

  // Apply state transition
  if (result.nextState) {
    session.state = result.nextState;
  }

  // Reset invalid count on successful transition (if not already reset by handler)
  if (result.nextState && result.nextState !== session.state) {
    session.invalidInputCount = 0;
  }

  session.lastActivity = new Date().toISOString();
}