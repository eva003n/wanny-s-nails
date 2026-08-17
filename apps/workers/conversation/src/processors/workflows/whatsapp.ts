import { log as logger, conversationQueue } from "../../lib/index.js";

import type { Message, OutboundMessage } from "@wannys-nails/core";

import { JOB_NAMES } from "@wannys-nails/core";

const log = logger.child({ module: "whatsapp-api" });

/**
 * High-level send function.
 * Constructs an OutboundMessage from the recipient phone and Message,
 * then enqueues it to the conversation queue for the WhatsApp processor.
 */
export async function sendMessage(
  to: string,
  message: Message,
) {
  const outbound: OutboundMessage = {
    wamId: message.wamId ?? `${to}:${Date.now()}`,
    to,
    type: message.type,
    text: message.text,
    listTitle: message.listTitle,
    listButtonText: message.listButtonText,
    listSections: message.listSections,
    buttonTitle: message.buttonTitle,
    buttons: message.buttons,
  };

  const job = await conversationQueue.add(JOB_NAMES.FSM_OUT, outbound);
  log.info(
    {
      event: "Conversation.message.enqueued",
      to,
      type: outbound.type,
      jobId: job?.id,
    },
    "Outbound message enqueued",
  );
}
