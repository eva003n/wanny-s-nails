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
  REMINDERS: "reminders",
  BOOKINGS: "bookings",
} as const;

export const JOB_NAMES = {
  WHATSAPP: "whatsapp",
  EMAIL: "email",
  FSM: "message", 
  STK_PUSH: "stkpush",
  STK_CALLBACK: "stkcallback"
} as const

