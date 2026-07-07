import { z } from "zod";



// ─── M-Pesa Daraja Callback Schemas ──────────────────────────────

/**
 * Base callback fields that are always present in every Daraja STK Push callback.
 */
export const DarajaCallbackBaseSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string(),
    }),
  }),
});

/**
 * Individual metadata item from CallbackMetadata.
 */
export const DarajaCallbackItemSchema = z.object({
  Name: z.string(),
  Value: z.union([z.string(), z.number()]),
});

/**
 * Callback for a successful payment (ResultCode === 0) — includes CallbackMetadata.
 */
export const DarajaCallbackSuccessSchema = DarajaCallbackBaseSchema.extend({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.literal(0),
      ResultDesc: z.string(),
      CallbackMetadata: z.object({
        Item: z.array(DarajaCallbackItemSchema),
      }),
    }),
  }),
});

/**
 * Callback for a failed payment (ResultCode !== 0) — no CallbackMetadata.
 */
export const DarajaCallbackFailureSchema = DarajaCallbackBaseSchema.extend({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number().refine((v) => v !== 0, "ResultCode must be non-zero for failure"),
      ResultDesc: z.string(),
    }),
  }),
});

/**
 * Union schema that validates both success and failure callbacks.
 */
export const DarajaCallbackSchema = z.union([
  DarajaCallbackSuccessSchema,
  DarajaCallbackFailureSchema,
]);

// ─── Inferred Types ──────────────────────────────────────────────

export type DarajaCallback = z.infer<typeof DarajaCallbackSchema>;
export type DarajaCallbackSuccess = z.infer<typeof DarajaCallbackSuccessSchema>;
export type DarajaCallbackFailure = z.infer<typeof DarajaCallbackFailureSchema>;
export type DarajaCallbackBase = z.infer<typeof DarajaCallbackBaseSchema>;
export type DarajaCallbackItem = z.infer<typeof DarajaCallbackItemSchema>;