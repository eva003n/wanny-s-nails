import axios, { AxiosError } from "axios";
import type { OutboundMessage } from "../../types.js";
import type { Config } from "../config.js";
import {
  type WaOutboundPayload,
  WaButtonPayloadSchema,
  WaListPayloadSchema,
  WaTextPayloadSchema,
} from "./outbound.schema.js";
import { type Result } from "./result.js";
import type { Logger } from "pino";

export function whatsappTransport(log: Logger) {
  return {
    buildPayload(to: string, msg: OutboundMessage): WaOutboundPayload {
      const base = {
        messaging_product: "whatsapp" as const,
        recipient_type: "individual" as const,
        to,
      };

      if (msg.type === "text") {
        return {
          ...base,
          type: "text",
          text: { preview_url: false, body: msg.text! },
        };
      }

      if (msg.type === "interactive_button") {
        return {
          ...base,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: msg.buttonTitle ?? "" },
            action: {
              buttons: (msg.buttons ?? []).map((b) => ({
                type: "reply",
                reply: { id: b.id, title: b.title },
              })),
            },
          },
        };
      }

      if (msg.type === "interactive_list") {
        return {
          ...base,
          type: "interactive",
          interactive: {
            type: "list",
            header: msg.listTitle
              ? { type: "text", text: msg.listTitle }
              : undefined,
            body: { text: msg.listTitle ?? " " },
            action: {
              button: msg.listButtonText ?? "Select",
              sections: msg.listSections ?? [],
            },
          },
        };
      }

      throw new Error(`Unknown OutboundMessage type: ${(msg as any).type}`);
    },

    // ── Validate the wire payload against the appropriate Zod schema ──
    validatePayload(payload: unknown): Result<WaOutboundPayload> {
      const schemas = [
        WaTextPayloadSchema,
        WaButtonPayloadSchema,
        WaListPayloadSchema,
      ];
      for (const schema of schemas) {
        const r = schema.safeParse(payload);
        if (r.success) return { ok: true, value: r.data as WaOutboundPayload };
      }
      // Use text schema to surface the most useful errors
      const r = WaTextPayloadSchema.safeParse(payload);
      return {
        ok: false,
        type: "VALIDATION_ERROR",
        errors:
          r.error?.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })) ?? [],
      };
    },

    send(to: string, msg: OutboundMessage) {
      let payload: WaOutboundPayload;

      try {
        payload = this.buildPayload(to, msg);
      } catch (err) {
        return {
          ok: false,
          type: "VALIDATION_ERROR",
          errors: [{ path: "", message: (err as Error).message }],
        };
      }

      // Validate — if this fails, no HTTP call is made
      const validation = this.validatePayload(payload);
      if (!validation.ok) {
        log.warn(
          { to, errors: validation },
          "outbound payload failed validation — not sent",
        );
        return validation;
      }
    },

    async sendTypingIndicator(wamId: string, config: Config) {
      const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
      try {
        const response = await axios.post(
          `https://graph.facebook.com/${config.WHATSAPP_API_VERSION}/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            status: "read",
            message_id: wamId,
            typing_indicator: {
              type: "text",
            },
          },
          {
            headers: {
              Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
          },
        );

      } catch (error) {
        if(error instanceof AxiosError) {
        log.warn(error.response?.data, "Typing indicator failed");
        }
      }
    },
  };
}
