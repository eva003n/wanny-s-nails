/**
 * Notification Triggers
 *
 * Maps each domain event to its notification recipients, channels, and templates.
 * This is the single source of truth for "who gets notified for what."
 */

// ─── Recipient Config ──────────────────────────────────────────

export interface RecipientConfig {
  type: "OWNER" | "STAFF" | "CLIENT";
  channel: "WHATSAPP" | "EMAIL" | "PUSH";
  template: string;
  condition?: string;
}

export interface TriggerConfig {
  recipients: RecipientConfig[];
}

// ─── Event Type ────────────────────────────────────────────────

export type NotificationEventType = keyof typeof NOTIFICATION_TRIGGERS;

// ─── Context passed to dispatch() ──────────────────────────────

export interface NotificationContext {
  bookingId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceName: string;
  appointmentAt?: string;
  amountKes?: number;
  mpesaReceiptNumber?: string;
  refundReference?: string;
  previousAppointmentAt?: string;
  adminUserIds?: string[];
}

// ─── Trigger Map ───────────────────────────────────────────────

export const NOTIFICATION_TRIGGERS = {
  BOOKING_CREATED: {
    recipients: [
      { type: "OWNER", channel: "PUSH", template: "new_booking_alert" },
    ],
  },
  BOOKING_PENDING_CONFIRMATION: {
    recipients: [
      // { type: "CLIENT", channel: "WHATSAPP", template: "booking_pending_confirmation" },
      { type: "OWNER", channel: "PUSH", template: "booking_awaiting_approval" },
    ],
  },
  BOOKING_CONFIRMED: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "booking_confirmation" },
      { type: "OWNER", channel: "PUSH", template: "booking_confirmed_alert" },
    ],
  },
  BOOKING_REJECTED: {
    recipients: [
      // { type: "CLIENT", channel: "WHATSAPP", template: "booking_rejected" },
      // { type: "OWNER", channel: "PUSH", template: "booking_rejected_alert" },
    ],
  },
  BOOKING_CANCELLED: {
    recipients: [
      // { type: "CLIENT", channel: "WHATSAPP", template: "booking_cancellation" },
      { type: "OWNER", channel: "PUSH", template: "booking_cancelled_alert" },
    ],
  },
  BOOKING_RESCHEDULED: {
    recipients: [
      // { type: "CLIENT", channel: "WHATSAPP", template: "booking_rescheduled" },
      { type: "OWNER", channel: "PUSH", template: "booking_rescheduled_alert" },
    ],
  },
  BOOKING_COMPLETED: {
    recipients: [
      // { type: "CLIENT", channel: "WHATSAPP", template: "appointment_completed" },
      { type: "OWNER", channel: "PUSH", template: "booking_completed_alert" },
    ],
  },
  BOOKING_NO_SHOW: {
    recipients: [
      // { type: "CLIENT", channel: "WHATSAPP", template: "missed_appointment" },
      { type: "OWNER", channel: "PUSH", template: "booking_no_show_alert" },
    ],
  },
  APPOINTMENT_REMINDER: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "reminder_24h" },
    ],
  },
  PAYMENT_REQUEST: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "payment_request" },
    ],
  },
  PAYMENT_RECEIVED: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "payment_receipt" },
      { type: "OWNER", channel: "PUSH", template: "payment_received_alert" },
      { type: "CLIENT", channel: "EMAIL", template: "payment_receipt_email", condition: "hasEmail" },
    ],
  },
  PAYMENT_REFUNDED: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "refund_confirmation" },
      { type: "OWNER", channel: "PUSH", template: "refund_processed_alert" },
      { type: "CLIENT", channel: "EMAIL", template: "payment_receipt_email", condition: "hasEmail" },
    ],
  },
  PAYMENT_SUCCESS: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "payment_receipt" },
    ],
  },
  PAYMENT_FAILED: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "payment_failed" },
      { type: "OWNER", channel: "PUSH", template: "payment_failed_alert" },
    ],
  },
  PAYMENT_EXPIRED: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "payment_expired" },
      { type: "OWNER", channel: "PUSH", template: "payment_expired_alert" },
    ],
  },
  REVIEW_RECEIPT: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "booking_confirmation" },
    ],
  },
  THANK_YOU: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "thank_you" },
    ],
  },
  FEEDBACK_REQUEST: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "feedback_request" },
    ],
  },
  REVIEW_REQUEST: {
    recipients: [
      { type: "CLIENT", channel: "WHATSAPP", template: "review_request" },
    ],
  },
} as const;

// ─── Condition Evaluator ───────────────────────────────────────

export function evaluateCondition(
  condition: string | undefined,
  context: NotificationContext,
): boolean {
  if (!condition) return true;

  switch (condition) {
    case "hasEmail":
      return !!context.customerEmail;
    case "isOptedIn":
      return true;
    default:
      return true;
  }
}