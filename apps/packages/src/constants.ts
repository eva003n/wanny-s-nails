/**
 * Queue name constants — single source of truth for all BullMQ queue names.
 *
 * Used by:
 *  - API (producers that enqueue jobs via BullMQ Queue instances)
 *  - Workers (consumers that process jobs via BullMQ Worker instances)
 */

export const Queue_Names = {
  NOTIFICATIONS: "notifications",
  PAYMENTS: "payments",
  CONVERSATIONS: "conversations",
} as const;

export const JOB_NAMES = {
  WHATSAPP: "send-whatsapp",
  EMAIL: "send-email",
  FSM_IN: "whatsapp-inbound",
  FSM_OUT: "whatsapp-outbound",
  STK_PUSH: "stk-push",
  STK_CALLBACK: "stk-callback",
  PUSH_NOTIFICATION: "send-push"
} as const;

