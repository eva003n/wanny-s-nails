import type { WhatsAppWebhook, WebhookEvent } from "../../shared/lib/schemas.js";

function normalisePhone(raw: string): string {
    return raw.startsWith("+") ? raw : `+${raw}`;
  }
  // creates a contract btw the api and fsm engine
  export function normaliseWebhook(webhook: WhatsAppWebhook): WebhookEvent[] {
    const events: WebhookEvent[] = [];

    for (const entry of webhook.entry) {
      for (const change of entry.changes) {
        const { value } = change;

        // Build a phone → name lookup from the contacts array
        const nameByPhone = new Map(
          (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]),
        );

        // Status updates — delivery receipts for your NotificationLog
        for (const status of value.statuses ?? []) {
          events.push({
            type: "STATUS_UPDATE",
            wamId: status.id,
            status: status.status,
            recipientPhone: status.recipient_id,
            errorCode: status.errors?.[0]?.code as number,
          });
        }

        // Inbound messages
        for (const msg of value.messages ?? []) {
          const phone = msg.from;
          const customerName = nameByPhone.get(msg.from) ?? "";
          const timestamp = new Date(Number(msg.timestamp) * 1000);

          console.log(msg.id)
          if (msg.type === "text") {
            events.push({
              type: "TEXT",
              wamId: msg.id,
              phone,
              customerName,
              body: msg.text.body.trim(),
              timestamp,
            });
          } else if (msg.type === "interactive") {
            // TypeScript needs a nudge here because the union is wide
            const iMsg = msg as any;
            if (iMsg.interactive.type === "button_reply") {
              events.push({
                type: "BUTTON_REPLY",
                wamId: msg.id,
                phone,
                customerName,
                body: iMsg.interactive.button_reply.id, // machine ID only
                timestamp,
              });
            } else {
              events.push({
                type: "LIST_REPLY",
                wamId: msg.id,
                phone,
                customerName,
                body: iMsg.interactive.list_reply.id, // machine ID only
                timestamp,
              });
            }
          } else {
            // Image, audio, sticker, document.
            events.push({
              type: "UNSUPPORTED",
              wamId: msg.id,
              phone,
              customerName,
              body: "",
              timestamp,
            });
          }
        }
      }
    }

    return events;
  }