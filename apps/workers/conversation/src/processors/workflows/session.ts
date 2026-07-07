// Whatsapp conversations are stateless
// This is the storage engine that remembers where we are in the conversation


import { redis } from "../../lib/redis.js";
import type { ConversationSession } from "./types.js";

const SESSION_TTL = 1800; // 30 minutes in seconds(only remember unregistered user last conversation state for 30 minutes)
const SESSION_PREFIX = "session:";


/**
 * Build the Redis key for a conversation session.
 * Expects phone without + prefix (e.g. 254712345678).
 */
export function sessionKey(phone: string): string {
  return `${SESSION_PREFIX}${phone}`;
}

/**
 * Load a session from Redis. Returns null if not found or expired.
 */
export async function loadSession(
  phone: string,
): Promise<ConversationSession | null> {
  const raw = await redis.get(sessionKey(phone));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConversationSession;
  } catch {
    // Corrupted session — delete and treat as new
    await redis.del(sessionKey(phone));
    return null;
  }
}

/**
 * Save (or update) a session in Redis with TTL reset.
 */
export async function saveSession(
  phone: string,
  session: ConversationSession,
): Promise<void> {
  session.lastActivity = new Date().toISOString();
  await redis.setex(sessionKey(phone), SESSION_TTL, JSON.stringify(session));
}

/**
 * Delete a session from Redis.
 */
export async function deleteSession(phone: string): Promise<void> {
  await redis.del(sessionKey(phone));
}

/**
 * Create a brand-new session in IDLE state.
 */
export function createNewSession(name: string): ConversationSession {
  return {
    state: "IDLE",
    customerName:name,
    invalidInputCount: 0,
    lastActivity: new Date().toISOString(),
  };
}

/**
 * Reset invalid input counter on a successful transition.
 */
export function resetInvalidCount(
  session: ConversationSession,
): ConversationSession {
  return { ...session, invalidInputCount: 0 };
}

/**
 * Increment invalid input counter.
 */
export function incrementInvalidCount(
  session: ConversationSession,
): ConversationSession {
  return {
    ...session,
    invalidInputCount: session.invalidInputCount + 1,
  };
}
