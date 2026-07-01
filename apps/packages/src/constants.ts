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

  // Payments
  STK_PUSH: "stk-push",
  STK_CALLBACK: "stk-callback",
  STK_TIMEOUT_CHECK: "payment-timeout-check",
  STK_RECONCILIATION: "payment_reconciliation",
  // Notifications
  PAYMENT_CONFIRMATION: "whatsapp-payment-confirmed",
  PAYMENT_FAILURE: "whatsapp-payment-failed",
  PAYMENT_RETRY: "payment-retry-prompt",
  PAYMENT_EXPIRED: "payment-expired-notification",
  PUSH_NOTIFICATION: "send-push",
} as const;

