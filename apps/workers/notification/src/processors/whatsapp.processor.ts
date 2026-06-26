import { type Job } from "bullmq";
import axios from "axios"

import { logger } from "@wannys-nails/packages";
import type { OutboundMessage, WhatsAppNotificationPayload, WhatsAppTemplatePayload } from "@wannys-nails/packages";

const log = logger.child({ module: "job:whatsapp" });

const GRAPH_API_VERSION = "v23.0";
const MAX_LIST_ROWS = 10; // WhatsApp Cloud API limit for interactive list messages


const config = {
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
};
/**
 * Send a single outbound WhatsApp message via the Cloud API.
 */

async function sendText(message: OutboundMessage): Promise<void> {
   try {
    await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: message.to,
        type: "text",
        text: { body: message.text },
      },
      {
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
    log.error(
      {
        event: "whatsapp.send.failed",
        to: message.to,
        status: axiosError.response?.status,
        error: axiosError.response?.data,
      },
      "Failed to send WhatsApp text message",
    );

    throw axiosError // trigger retry logic

    // If rate limited (429), we could re-enqueue, but for simplicity log and drop
    
  }
}

/**
 * Truncate interactive list sections to respect WhatsApp's 10-row limit.
 * Returns a new sections array with rows capped at maxRows total.
 */
function truncateListSections(
  sections: NonNullable<OutboundMessage["listSections"]>,
  maxRows = MAX_LIST_ROWS,
): NonNullable<OutboundMessage["listSections"]> {
  let totalRows = 0;
  const result: NonNullable<OutboundMessage["listSections"]> = [];

  for (const section of sections) {
    const remaining = maxRows - totalRows;
    if (remaining <= 0) break;

    const rows = section.rows.slice(0, remaining);
    result.push({ ...section, rows });
    totalRows += rows.length;
  }

  return result;
}

/**
 * Send an interactive list message via WhatsApp Cloud API.
 */
async function sendInteractiveListMessage(
 message: OutboundMessage
) {
   let sections: NonNullable<OutboundMessage["listSections"]> = message.listSections || []

   const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID

  // Enforce WhatsApp's 10-row limit across all sections
  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);
  if (totalRows > MAX_LIST_ROWS) {
    log.warn(
      { event: "whatsapp.list.rows_truncated", to: message.to, totalRows, maxRows: MAX_LIST_ROWS },
      "Interactive list rows exceed limit — truncating",
    );
    sections = truncateListSections(sections);
  }

  try {
    await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.to,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: message.listTitle },
          body: { text: message.text },
          action: {
            button: message.listButtonText,
            sections: sections.map((section) => ({
              ...(section.title ? { title: section.title } : {}),
              rows: section.rows,
            })),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
    log.error(
      {
        event: "whatsapp.send.list.failed",
        to: message.to,
        status: axiosError.response?.status,
        error: axiosError.response?.data,
      },
      "Failed to send WhatsApp interactive list message",
    );
     throw error
  }
}

/**
 * Send an interactive button message via WhatsApp Cloud API.
 */
async function sendInteractiveButtonMessage(
message: OutboundMessage
) {

  const buttons: NonNullable<OutboundMessage["buttons"]> = message.buttons || []

     const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;

  try {
    await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: message.to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: message.text},
          action: {
            buttons: buttons.map((btn) => ({
              type: "reply",
              reply: { id: btn.id, title: btn.title },
            })),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
    log.error(
      {
        event: "whatsapp.send.button.failed",
        to: message.to,
        status: axiosError.response?.status,
        error: axiosError.response?.data,
      },
      "Failed to send WhatsApp interactive button message",
    );
    throw error;
  }
}
/**
 * Send a WhatsApp template message (for pre-approved templates outside the 24h window).
 */

async function sendTemplate(
  template: WhatsAppTemplatePayload
): Promise<void> {

     const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  // const { default: axios } = await import("axios");
 try {
   await axios.post(
     url,
     {
       messaging_product: "whatsapp",
       to: template.to,
       type: "template",
       template: {
         name: template.templateName,
         language: { code: template.languageCode },
         components:
           template.params.length > 0
             ? [
                 {
                   type: "body",
                   parameters: template.params.map((p) => ({
                     type: "text",
                     text: p,
                   })),
                 },
               ]
             : [],
       },
     },
     {
       headers: {
         Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
         "Content-Type": "application/json",
       },
     },
   );
 } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      log.error(
        {
          event: "whatsapp.send.template.failed",
          to: template.to,
          templateName: template.templateName,
          status: axiosError.response?.status,
          error: axiosError.response?.data,
        },
        "Failed to send WhatsApp template message",
      );
      throw error

 }
}

// ─── Processor ─────────────────────────────────────────────────

export async function whatsappProcessor(job: Job<WhatsAppNotificationPayload>): Promise<void> {
  const { type, to } = job.data;

  log.info(
    { event: "whatsapp.job.start", jobId: job.id, to, type },
    "Processing WhatsApp notification job",
  );

  try {
      switch (type) {
        case "text":
          return sendText(job.data);

        case "interactive_list":
        
          return sendInteractiveListMessage(job.data);

        case "interactive_button":
          return sendInteractiveButtonMessage(job.data);

        case "template":
          return sendTemplate(job.data as WhatsAppTemplatePayload)

        default:
          log.warn(
            { event: "whatsapp.send.unknown_type", to },
            "Unknown message type",
          );
      }

    log.info(
      { event: "whatsapp.job.success", jobId: job.id, to },
      "WhatsApp message sent successfully",
    );
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: unknown }; message?: string };
    log.error(
      {
        event: "whatsapp.job.failed",
        jobId: job.id,
        to,
        status: err.response?.status,
        response: err.response?.data,
        error: err.message,
      },
      "WhatsApp message delivery failed",
    );
    throw error; // BullMQ will retry
  }
}

