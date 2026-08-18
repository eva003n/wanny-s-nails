import { describe, expect, it } from "vitest";
import {
  DarajaCallbackSchema,
  DarajaCallbackSuccessSchema,
  DarajaCallbackFailureSchema,
} from "./schemas.js";

describe("webhooks — Daraja callback schema validation (TESTING.md §4.2)", () => {
  const successPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: "29115-34620561-1",
        CheckoutRequestID: "ws_CO_08072024150000000",
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: 1500 },
            { Name: "MpesaReceiptNumber", Value: "NLJ7RT61SV" },
            { Name: "TransactionDate", Value: "20260802000000" },
            { Name: "PhoneNumber", Value: 254712345678 },
          ],
        },
      },
    },
  };

  const failurePayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: "29115-34620561-1",
        CheckoutRequestID: "ws_CO_FAIL_12345",
        ResultCode: 1032,
        ResultDesc: "Request cancelled by user",
      },
    },
  };

  describe("DarajaCallbackSuccessSchema", () => {
    it("accepts a valid success callback with metadata", () => {
      const result = DarajaCallbackSuccessSchema.safeParse(successPayload);
      expect(result.success).toBe(true);
    });

    it("rejects a success callback without CallbackMetadata", () => {
      const result = DarajaCallbackSuccessSchema.safeParse(failurePayload);
      expect(result.success).toBe(false);
    });

    it("rejects a non-zero ResultCode", () => {
      const bad = {
        Body: {
          stkCallback: {
            MerchantRequestID: "29115-34620561-1",
            CheckoutRequestID: "ws_CO_1",
            ResultCode: 1,
            ResultDesc: "Failed",
            CallbackMetadata: { Item: [] },
          },
        },
      };
      const result = DarajaCallbackSuccessSchema.safeParse(bad);
      expect(result.success).toBe(false);
    });

    it("rejects a missing CheckoutRequestID", () => {
      const bad = {
        Body: {
          stkCallback: {
            MerchantRequestID: "29115-34620561-1",
            ResultCode: 0,
            ResultDesc: "Success",
            CallbackMetadata: { Item: [] },
          },
        },
      };
      const result = DarajaCallbackSuccessSchema.safeParse(bad);
      expect(result.success).toBe(false);
    });
  });

  describe("DarajaCallbackFailureSchema", () => {
    it("accepts a valid failure callback without metadata", () => {
      const result = DarajaCallbackFailureSchema.safeParse(failurePayload);
      expect(result.success).toBe(true);
    });

    it("rejects a zero ResultCode", () => {
      const bad = {
        Body: {
          stkCallback: {
            MerchantRequestID: "29115-34620561-1",
            CheckoutRequestID: "ws_CO_0",
            ResultCode: 0,
            ResultDesc: "Success",
          },
        },
      };
      const result = DarajaCallbackFailureSchema.safeParse(bad);
      expect(result.success).toBe(false);
    });

    it("rejects a missing ResultDesc", () => {
      const bad = {
        Body: {
          stkCallback: {
            MerchantRequestID: "29115-34620561-1",
            CheckoutRequestID: "ws_CO_1",
            ResultCode: 1,
          },
        },
      };
      const result = DarajaCallbackFailureSchema.safeParse(bad);
      expect(result.success).toBe(false);
    });
  });

  describe("DarajaCallbackSchema (union)", () => {
    it("accepts a success callback", () => {
      const result = DarajaCallbackSchema.safeParse(successPayload);
      expect(result.success).toBe(true);
    });

    it("accepts a failure callback", () => {
      const result = DarajaCallbackSchema.safeParse(failurePayload);
      expect(result.success).toBe(true);
    });

    it("rejects a malformed payload", () => {
      const result = DarajaCallbackSchema.safeParse({ Body: {} });
      expect(result.success).toBe(false);
    });

    it("rejects a non-object payload", () => {
      const result = DarajaCallbackSchema.safeParse("not-an-object");
      expect(result.success).toBe(false);
    });

    it("rejects a missing Body", () => {
      const result = DarajaCallbackSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});