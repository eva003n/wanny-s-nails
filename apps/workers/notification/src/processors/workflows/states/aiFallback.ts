import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { logger } from "@wannys-nails/packages";

const log = logger.child({ module: "fsm-ai-fallback" });

const SYSTEM_PROMPT = `You are a helpful assistant for Wanny's Nails salon in Nairobi, Kenya.

RULES:
- Answer questions about the salon only. Never discuss unrelated topics.
- Keep all replies under 3 sentences. Be warm and friendly.
- If the customer wants to book, cancel, or reschedule, reply with exactly:
  "To manage your appointment, please type MENU."
  Do not attempt to book on their behalf.
- If you cannot confidently answer, reply with exactly:
  "Let me connect you with our team — type HUMAN for personal assistance."
- Never invent prices, availability, or service details.

SALON INFO:
Name:     Wanny's Nails
Location: Nairobi, Kenya
Hours:    Monday–Saturday, 7 AM – 7 PM EAT
Phone:    +254 700 000 000
Services: Gel Manicure KES 1,500 (60 min)
          Acrylic Set KES 2,500 (90 min)
          Nail Art KES 2,000 (75 min)
          Regular Manicure KES 800 (45 min)`;

/**
 * AI_FALLBACK
 *
 * Handles messages that the FSM couldn't understand after 3 invalid attempts,
 * or messages received outside any active flow.
 *
 * Uses Gemini 2.0 Flash (free tier) with last 6 messages as context.
 *
 * Transitions:
 *  AI reply contains "MENU"     → GREETING (re-enter booking flow)
 *  AI reply contains "HUMAN"   → HUMAN_ESCALATION
 *  Normal reply                 → AI_FALLBACK (stay)
 *  Gemini API error / timeout   → HUMAN_ESCALATION (fail safe)
 */

/* export async function handleAiFallback(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  // If GEMINI_API_KEY is not set, skip AI and go straight to HUMAN_ESCALATION
  if (!config.GEMINI_API_KEY) {
    return {
      messages: [],
      sessionUpdates: ctx.session,
      nextState: "HUMAN_ESCALATION",
    };
  }

  const message = ctx.message.trim();
  const history = ctx.session.aiContext?.slice(-6) ?? [];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [...history, { role: "user", parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 150 },
        }),
      },
    );

    if (!response.ok) {
      log.error(
        {
          event: "ai.gemini.http_error",
          status: response.status,
          phone: ctx.phone,
        },
        "Gemini API returned non-200",
      );
      // Fail safe to HUMAN_ESCALATION
      return {
        messages: [],
        sessionUpdates: ctx.session,
        nextState: "HUMAN_ESCALATION",
      };
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!reply) {
      log.error(
        { event: "ai.gemini.empty_reply", phone: ctx.phone },
        "Gemini returned empty reply",
      );
      return {
        messages: [],
        sessionUpdates: ctx.session,
        nextState: "HUMAN_ESCALATION",
      };
    }

    // Detect handoff signals in AI reply
    const wantsHuman = /HUMAN|connect you with|our team/i.test(reply);
    const wantsMenu = /MENU|type menu/i.test(reply);

    // Append to context window (capped at 6 messages)
    const newContext = [
      ...history,
      { role: "user" as const, parts: [{ text: message }] },
      { role: "model" as const, parts: [{ text: reply }] },
    ].slice(-6);

    const nextState: StateTransitionResult["nextState"] = wantsHuman
      ? "HUMAN_ESCALATION"
      : wantsMenu
        ? "GREETING"
        : "AI_FALLBACK";

    return {
      messages: [{ type: "text", text: reply }],
      sessionUpdates: {
        ...ctx.session,
        aiContext: newContext,
      },
      nextState,
    };
  } catch (error) {
    log.error(
      { event: "ai.gemini.error", error, phone: ctx.phone },
      "Gemini API call failed",
    );
    // Fail safe to HUMAN_ESCALATION
    return {
      messages: [],
      sessionUpdates: ctx.session,
      nextState: "HUMAN_ESCALATION",
    };
  }
} */
