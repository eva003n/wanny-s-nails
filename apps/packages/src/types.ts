/**
 * Job payload types — the typed contract between API producers and worker consumers.
 *
 * These interfaces define the shape of data in each BullMQ job.
 * Workers should validate incoming job.data against these types using Zod at runtime.
 */

import type { NormalisedEvent } from "./lib/index.js";

// ─── Notification Job Payloads ────────────────────────────────

export interface NotificationJobData {
  notificationId: string;
  recipientId: string;
  recipientType: string;
  channel: string;
  template: string;
  payload: Record<string, unknown>;
  endpoint: {
    /** Phone number (E.164), email address, or push subscription ID */
    address: string;
    type: "phone" | "email" | "push_subscription";
  };
  eventType: string;
  bookingId: string;
}

export type WhatsAppTemplatePayload = {
  type: "template";
  to: string;
  templateName: string;
  languageCode: string;
  params: string[];
};

// Message (Incoming)
export type InboundMessage = {
  type: "text" | "button" | "interactive";
  from: string;
  text: string;
};

export type Message = {
  type: "text" | "interactive_list" | "interactive_button" | "template";
  text?: string;
  wamId?: string, 
  /** For interactive_list */
  listTitle?: string;
  listButtonText?: string;
  listSections?: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  /** For interactive_button */
  buttonTitle?: string;
  buttons?: Array<{ id: string; title: string }>;
};

export type OutboundMessage = {
  wamId: string;
  to: string;
  type: "text" | "interactive_list" | "interactive_button" | "template";
  text?: string;
  /** For interactive_list */
  listTitle?: string;
  listButtonText?: string;
  listSections?: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  /** For interactive_button */
  buttonTitle?: string;
  buttons?: Array<{ id: string; title: string }>;
};


export type WhatsAppConversationPayload = OutboundMessage | InboundMessage;

export type EmailNotificationPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

// ─── Payment Job Payloads ─────────────────────────────────────

export interface StkPushPayload {
  bookingId: string;
  paymentId: string;
  phoneNumber: string;
  amount: number;
  accountReference: string;
}

export interface PaymentVerifyPayload {
  resultCode: number;
  rawCallback: string;
  checkoutRequestId: string;
}

// ─── Reminder Job Payloads ────────────────────────────────────

export type Reminder1hPayload = {
  reminderId: string;
  bookingId: string;
  customerPhone: string;
  customerName: string;
  serviceName: string;
  appointmentAt: string; // ISO datetime
};

export type Reminder24hPayload = {
  reminderId: string;
  bookingId: string;
  customerPhone: string;
  customerName: string;
  serviceName: string;
  appointmentAt: string; // ISO datetime
};
