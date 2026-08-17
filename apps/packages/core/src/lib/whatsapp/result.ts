export type Result<T = void> =
  | { ok: true; value: T }
  | ValidationError
  | TransportError
  | WhatsAppApiError;

export interface ValidationError {
  ok: false;
  type: "VALIDATION_ERROR";
  errors: Array<{ path: string; message: string }>;
}

export interface TransportError {
  ok: false;
  type: "TRANSPORT_ERROR";
  status?: number;
  message: string;
}

export interface WhatsAppApiError {
  ok: false;
  type: "WHATSAPP_ERROR";
  // Common Daraja-like error codes from WhatsApp API:
  // 130472 — parameter format doesn't match template
  // 131009 — template not found or not approved
  // 131047 — re-engagement message blocked (outside 24h window)
  // 131056 — too many messages sent to this phone
  code: number;
  title: string;
  details?: string;
}
