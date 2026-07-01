// packages/mpesa/src/schemas/stkCallback.schema.ts
import { z } from "zod";

// --- CallbackMetadata.Item is a loosely-typed array: each item has a
// known set of possible `Name` values, but `Value` can be a string or
// number depending on which field it is, and a malformed/edge-case
// item can omit `Value` entirely (seen in real Daraja payloads for
// "Balance"). Model permissively, narrow later via the accessor below.
const CallbackMetadataItemSchema = z.object({
  Name: z.enum([
    "Amount",
    "MpesaReceiptNumber",
    "TransactionDate",
    "PhoneNumber",
    "Balance",
  ]),
  Value: z.union([z.string(), z.number()]).optional(),
});

const CallbackMetadataSchema = z.object({
  Item: z.array(CallbackMetadataItemSchema),
});

// --- Successful payment: ResultCode 0, CallbackMetadata always present ---
const StkCallbackSuccessSchema = z.object({
  MerchantRequestID: z.string(),
  CheckoutRequestID: z.string(),
  ResultCode: z.literal(0),
  ResultDesc: z.string(),
  CallbackMetadata: CallbackMetadataSchema,
});

// --- Failed/cancelled payment: any non-zero ResultCode, no metadata ---
const StkCallbackFailureSchema = z.object({
  MerchantRequestID: z.string(),
  CheckoutRequestID: z.string(),
  ResultCode: z
    .number()
    .int()
    .refine((code) => code !== 0, {
      message: "ResultCode 0 must use the success schema",
    }),
  ResultDesc: z.string(),
  CallbackMetadata: z.undefined().optional(),
});

// Use a simple union instead of discriminatedUnion since Zod v4 doesn't
// support the type-level workaround needed for "any non-zero number".
const StkCallbackUnionSchema = z.union([
  StkCallbackSuccessSchema,
  StkCallbackFailureSchema,
]);

export const StkCallbackBodySchema = z.object({
  Body: z.object({
    stkCallback: StkCallbackUnionSchema,
  }),
});

// --- Inferred types ---
export type StkCallbackMetadataItem = z.infer<
  typeof CallbackMetadataItemSchema
>;
export type StkCallbackSuccess = z.infer<typeof StkCallbackSuccessSchema>;
export type StkCallbackFailure = z.infer<typeof StkCallbackFailureSchema>;
export type StkCallback = z.infer<typeof StkCallbackUnionSchema>;
export type StkCallbackBody = z.infer<typeof StkCallbackBodySchema>;

// --- Type guard for narrowing in application code ---
export function isStkCallbackSuccess(
  callback: StkCallback,
): callback is StkCallbackSuccess {
  return callback.ResultCode === 0;
}

// --- Normalized metadata extraction ---
// Raw CallbackMetadata.Item is annoying to consume directly (find-by-Name
// everywhere). This turns it into a typed, validated shape with the
// correct primitive types per field, instead of `string | number` everywhere.
const NormalizedMetadataSchema = z.object({
  amount: z.number(),
  mpesaReceiptNumber: z.string(),
  transactionDate: z.string(), // raw value e.g. 20241101102115 — convert separately, see note below
  phoneNumber: z.string(), // normalize via coercion below; Daraja sends this as a number
});

export type NormalizedStkMetadata = z.infer<typeof NormalizedMetadataSchema>;

export function extractCallbackMetadata(
  callback: StkCallbackSuccess,
): NormalizedStkMetadata {
  const findValue = (name: StkCallbackMetadataItem["Name"]) =>
    callback.CallbackMetadata.Item.find((item) => item.Name === name)?.Value;

  return NormalizedMetadataSchema.parse({
    amount: findValue("Amount"),
    mpesaReceiptNumber: findValue("MpesaReceiptNumber"),
    transactionDate: String(findValue("TransactionDate")),
    phoneNumber: String(findValue("PhoneNumber")),
  });
}

// --- Parsing entry point for the webhook handler ---
export function parseStkCallbackBody(payload: unknown): StkCallbackBody {
  return StkCallbackBodySchema.parse(payload);
}
