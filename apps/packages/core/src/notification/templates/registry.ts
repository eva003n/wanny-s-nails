/**
 * Template Registry
 *
 * Every `template` string referenced in NOTIFICATION_TRIGGERS must resolve
 * to exactly one entry here. Never inline a message string in a handler —
 * register it here first, reference by key.
 */

// ─── Template Config ───────────────────────────────────────────

export interface TemplateConfig {
  channel: "WHATSAPP" | "EMAIL" | "PUSH";
  waTemplateName?: string;
  requiresApproval?: boolean;
  subject?: string;
  vars: string[];
  pushTitle?: string;
}

// ─── Template Map ──────────────────────────────────────────────

export const TEMPLATES = {
  // ── WhatsApp Templates ────────────────────────────────────────
  booking_confirmation: {
    channel: "WHATSAPP",
    waTemplateName: "booking_confirmation_v2",
    requiresApproval: true,
    vars: ["customerName", "serviceName", "appointmentAt", "amountKes"],
  },
  booking_pending_confirmation: {
    channel: "WHATSAPP",
    waTemplateName: "booking_pending_confirmation_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName", "appointmentAt"],
  },
  booking_rejected: {
    channel: "WHATSAPP",
    waTemplateName: "booking_rejected_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName", "salonAddress"],
  },
  booking_cancellation: {
    channel: "WHATSAPP",
    waTemplateName: "booking_cancellation_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName", "appointmentAt"],
  },
  booking_rescheduled: {
    channel: "WHATSAPP",
    waTemplateName: "booking_rescheduled_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName", "oldappointmentAt", "newappointmentAt"],
  },
  appointment_completed: {
    channel: "WHATSAPP",
    waTemplateName: "appointment_completed_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName"],
  },
  missed_appointment: {
    channel: "WHATSAPP",
    waTemplateName: "missed_appointment_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName", "appointmentAt"],
  },
  reminder_24h: {
    channel: "WHATSAPP",
    waTemplateName: "appointment_reminder_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName", "appointmentAt"],
  },
  reminder_1h: {
    channel: "WHATSAPP",
    waTemplateName: "appointment_reminder_1h_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName", "appointmentAt"],
  },
  payment_request: {
    channel: "WHATSAPP",
    waTemplateName: "payment_request_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName", "amount", "paymentLink"],
  },
  payment_receipt: {
    channel: "WHATSAPP",
    waTemplateName: "payment_receipt_v1",
    requiresApproval: true,
    vars: ["customerName", "amount", "receiptNumber", "serviceName"],
  },
  refund_confirmation: {
    channel: "WHATSAPP",
    waTemplateName: "refund_confirmation_v1",
    requiresApproval: true,
    vars: ["customerName", "amount", "refundReference"],
  },
  payment_failed: {
    channel: "WHATSAPP",
    waTemplateName: "payment_failed_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName", "amount"],
  },
  payment_expired: {
    channel: "WHATSAPP",
    waTemplateName: "payment_expired_v1",
    requiresApproval: true,
    vars: ["customerName", "serviceName"],
  },
  thank_you: {
    channel: "WHATSAPP",
    waTemplateName: "thank_you_v1",
    requiresApproval: true,
    vars: ["customerName"],
  },
  feedback_request: {
    channel: "WHATSAPP",
    waTemplateName: "feedback_request_v1",
    requiresApproval: true,
    vars: ["customerName", "feedbackLink"],
  },
  review_request: {
    channel: "WHATSAPP",
    waTemplateName: "review_request_v1",
    requiresApproval: true,
    vars: ["customerName", "reviewLink"],
  },

  // ── Push Templates (admin-facing) ─────────────────────────────
  new_booking_alert: {
    channel: "PUSH",
    pushTitle: "New Booking",
    requiresApproval: false,
    vars: ["customerName", "serviceName", "appointmentAt"],
  },
  booking_awaiting_approval: {
    channel: "PUSH",
    pushTitle: "Booking Awaiting Approval",
    requiresApproval: false,
    vars: ["customerName", "serviceName", "appointmentAt"],
  },
  booking_confirmed_alert: {
    channel: "PUSH",
    pushTitle: "Booking Confirmed",
    requiresApproval: false,
    vars: ["customerName", "serviceName", "appointmentAt"],
  },
  booking_rejected_alert: {
    channel: "PUSH",
    pushTitle: "Booking Rejected",
    requiresApproval: false,
    vars: ["customerName", "serviceName"],
  },
  booking_cancelled_alert: {
    channel: "PUSH",
    pushTitle: "Booking Cancelled",
    requiresApproval: false,
    vars: ["customerName", "serviceName", "appointmentAt"],
  },
  booking_rescheduled_alert: {
    channel: "PUSH",
    pushTitle: "Booking Rescheduled",
    requiresApproval: false,
    vars: ["customerName", "serviceName", "newappointmentAt"],
  },
  booking_completed_alert: {
    channel: "PUSH",
    pushTitle: "Appointment Completed",
    requiresApproval: false,
    vars: ["customerName", "serviceName"],
  },
  booking_no_show_alert: {
    channel: "PUSH",
    pushTitle: "No Show",
    requiresApproval: false,
    vars: ["customerName", "serviceName", "appointmentAt"],
  },
  payment_received_alert: {
    channel: "PUSH",
    pushTitle: "Payment Received",
    requiresApproval: false,
    vars: ["customerName", "amount", "serviceName"],
  },
  payment_failed_alert: {
    channel: "PUSH",
    pushTitle: "Payment Failed",
    requiresApproval: false,
    vars: ["customerName", "amount", "serviceName"],
  },
  payment_expired_alert: {
    channel: "PUSH",
    pushTitle: "Payment Expired",
    requiresApproval: false,
    vars: ["customerName", "serviceName"],
  },
  refund_processed_alert: {
    channel: "PUSH",
    pushTitle: "Refund Processed",
    requiresApproval: false,
    vars: ["customerName", "amount"],
  },

  // ── Email Templates ──────────────────────────────────────────
  payment_receipt_email: {
    channel: "EMAIL",
    subject: "Your Payment Receipt — Wanny's Nails",
    requiresApproval: false,
    vars: ["customerName", "amount", "receiptUrl", "serviceName", "appointmentAt"],
  },
} as const;

export type TemplateName = keyof typeof TEMPLATES;

// ─── Render Helpers ────────────────────────────────────────────

function resolveVar(varName: string, context: Record<string, unknown>): string {
  const value = context[varName];
  if (value === undefined || value === null) {
    throw new Error(`Missing required template variable: ${varName}`);
  }
  return String(value);
}

export function renderTemplate(
  templateName: string,
  context: Record<string, unknown>,
): Record<string, unknown> {
  const config = TEMPLATES[templateName as TemplateName];
  if (!config) {
    throw new Error(`Unknown template: ${templateName}`);
  }

  const rendered: Record<string, unknown> = {};

  for (const varName of config.vars) {
    rendered[varName] = resolveVar(varName, context);
  }

  return rendered;
}

export function renderTemplateForChannel(
  templateName: string,
  context: Record<string, unknown>,
): Record<string, unknown> {
  return renderTemplate(templateName, context);
}