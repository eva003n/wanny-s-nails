import { type Job } from "bullmq";

import { log as logger, whatsappHttpClient } from "../lib/index.js";
import {
  HttpClientError,
  OutboundMessage,

  WhatsAppTemplatePayload,
} from "@wannys-nails/core";
import { _config as config } from "../lib/config.js";

const log = logger.child({ module: "job:whatsapp" });

const MAX_LIST_ROWS = 10; // WhatsApp Cloud API limit for interactive list messages

/**
 * Send a single outbound WhatsApp message via the Cloud API.
 */

// Last for 25 seconds or until u respond which must be < 25 seconds
// function sendTypingIndicator(wamId: string) {
//   const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;

//   whatsappHttpClient.post(
//     `/${phoneNumberId}/messages`,
//     {
//       messaging_product: "whatsapp",
//       status: "read",
//       message_id: wamId,
//       typing_indicator: {
//         type: "text",
//       },
//     },
//   ).catch((err) => log.warn(`Typing indicator: ${err.message}`));
// }

async function sendText(message: OutboundMessage): Promise<void> {

  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID
  try {
    await whatsappHttpClient.post(
     `/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: message.to,
        type: "text",
        text: { body: message.text },
      }
    );
  } catch (error: unknown) {
    const axiosError = error
  if( axiosError instanceof HttpClientError){
   
    log.error(
      {
        event: "whatsapp.send.failed",
        to: message.to,
        status: axiosError?.status,
        error: axiosError.responseBody,
      },
      "Failed to send WhatsApp text message",
    );
  }
    throw axiosError; // trigger retry logic

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
async function sendInteractiveListMessage( message: OutboundMessage) {
  let sections: NonNullable<OutboundMessage["listSections"]> =
    message.listSections || [];

  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;


  // Enforce WhatsApp's 10-row limit across all sections
  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);
  if (totalRows > MAX_LIST_ROWS) {
    log.warn(
      {
        event: "whatsapp.list.rows_truncated",
        to: message.to,
        totalRows,
        maxRows: MAX_LIST_ROWS,
      },
      "Interactive list rows exceed limit — truncating",
    );
    sections = truncateListSections(sections);
  }

  try {

    await whatsappHttpClient.post(
      `/${phoneNumberId}/messages`,
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
    );
  } catch (error: unknown) {
    const axiosError = error
  if( axiosError instanceof HttpClientError){
    log.error(
      {
        event: "whatsapp.send.list.failed",
        to: message.to,
        status: axiosError.status,
        error: axiosError.responseBody,
      },
      "Failed to send WhatsApp interactive list message",
    );
  }
    throw error;
  }
}

/**
 * Send an interactive button message via WhatsApp Cloud API.
 */
async function sendInteractiveButtonMessage(message: OutboundMessage) {
  const buttons: NonNullable<OutboundMessage["buttons"]> =
    message.buttons || [];

  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;

  try {

    await whatsappHttpClient.post(
      `/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: message.to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: message.text },
          action: {
            buttons: buttons.map((btn) => ({
              type: "reply",
              reply: { id: btn.id, title: btn.title },
            })),
          },
        },
      },
    );
  } catch (error: unknown) {
    const axiosError = error
  if( axiosError instanceof HttpClientError){
    log.error(
      {
        event: "whatsapp.send.button.failed",
        to: message.to,
        status: axiosError.status,
        error: axiosError.responseBody,
      },
      "Failed to send WhatsApp interactive button message",
    );
  }
    throw error;
  }
}
/**
 * Send a WhatsApp template message (for pre-approved templates outside the 24h window).
 */

async function sendTemplate(template: WhatsAppTemplatePayload): Promise<void> {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const url = `/${phoneNumberId}/messages`;
  // const { default: axios } = await import("axios");
  try {

    await whatsappHttpClient.post(
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
    );
  } catch (error: unknown) {
    const axiosError = error 
  if( axiosError instanceof HttpClientError){
    log.error(
      {
        event: "whatsapp.send.template.failed",
        to: template.to,
        templateName: template.templateName,
        status: axiosError.status,
        error: axiosError.responseBody
      },
      "Failed to send WhatsApp template message",
    );
  }
    throw axiosError;
  }
}

// ─── Processor ─────────────────────────────────────────────────

export async function whatsappProcessor(
  job: Job<OutboundMessage>,
): Promise<void> {
  const { type, to } = job.data;

  log.info(
    { event: "whatsapp.job.start", jobId: job.id, to, type },
    "Processing WhatsApp conversation job",
  );

  try {
    switch (type) {
      case "text":
        return await sendText(job.data);

      case "interactive_list":
        return await sendInteractiveListMessage(job.data);

      case "interactive_button":
        return await sendInteractiveButtonMessage(job.data);

      case "template":
        return await sendTemplate(job.data as any);

      default:
        log.warn(
          { event: "whatsapp.conversation.unknown_type", to, type: type },
          "Unknown message type",
        );
    }

    log.info(
      { event: "whatsapp.job.success", jobId: job.id, to },
      "WhatsApp conversation sent successfully",
    );
  } catch (error: unknown) {
    const err = error as HttpClientError
    if(err instanceof HttpClientError) {
    log.error(
      {
        event: "whatsapp.conversation.job.failed",
        jobId: job.id,
        to,
        status: err.status,
        response: err.responseBody,
        error: err.message || err,
      },
      "WhatsApp conversation delivery failed",
    );
    }

    throw error; // BullMQ will retry whatsapp after a while
  }
}
