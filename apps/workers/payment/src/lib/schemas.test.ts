import { describe, expect, it } from "vitest";
import {
  parseStkCallbackBody,
  extractCallbackMetadata,
  isStkCallbackSuccess,
  StkCallbackBodySchema,
} from "./schemas.js";

const successCallback = {
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

const failureCallback = {
  Body: {
    stkCallback: {
      MerchantRequestID: "29115-34620561-1",
      CheckoutRequestID: "ws_CO_FAIL_12345",
      ResultCode: 1032,
      ResultDesc: "Request cancelled by user",
    },
  },
};

describe("payment worker schemas (TESTING.md §4.2)", () => {
  describe("StkCallbackBodySchema", () => {
    it("accepts a valid success callback", () => {
      const result = StkCallbackBodySchema.safeParse(successCallback);
      expect(result.success).toBe(true);
    });

    it("accepts a valid failure callback", () => {
      const result = StkCallbackBodySchema.safeParse(failureCallback);
      expect(result.success).toBe(true);
    });

    it("rejects a malformed payload", () => {
      const result = StkCallbackBodySchema.safeParse({ Body: {} });
      expect(result.success).toBe(false);
    });

    it("rejects a success callback with a non-zero ResultCode", () => {
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
      const result = StkCallbackBodySchema.safeParse(bad);
      expect(result.success).toBe(false);
    });

    it("rejects a failure callback with a zero ResultCode", () => {
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
      const result = StkCallbackBodySchema.safeParse(bad);
      expect(result.success).toBe(false);
    });

    it("rejects a callback with an unknown metadata item name", () => {
      const bad = {
        Body: {
          stkCallback: {
            MerchantRequestID: "29115-34620561-1",
            CheckoutRequestID: "ws_CO_1",
            ResultCode: 0,
            ResultDesc: "Success",
            CallbackMetadata: {
              Item: [{ Name: "UnknownField", Value: "x" }],
            },
          },
        },
      };
      const result = StkCallbackBodySchema.safeParse(bad);
      expect(result.success).toBe(false);
    });
  });

  describe("parseStkCallbackBody", () => {
    it("parses a valid success callback", () => {
      const parsed = parseStkCallbackBody(successCallback);
      expect(parsed.Body.stkCallback.ResultCode).toBe(0);
    });

    it("parses a valid failure callback", () => {
      const parsed = parseStkCallbackBody(failureCallback);
      expect(parsed.Body.stkCallback.ResultCode).toBe(1032);
    });

    it("throws on an invalid payload", () => {
      expect(() => parseStkCallbackBody({})).toThrow();
    });
  });

  describe("isStkCallbackSuccess", () => {
    it("returns true for ResultCode 0", () => {
      const parsed = parseStkCallbackBody(successCallback);
      const callback = parsed.Body.stkCallback;
      if (callback.ResultCode === 0) {
        expect(isStkCallbackSuccess(callback)).toBe(true);
      } else {
        throw new Error("Expected success callback");
      }
    });

    it("returns false for a non-zero ResultCode", () => {
      const parsed = parseStkCallbackBody(failureCallback);
      const callback = parsed.Body.stkCallback;
      if (callback.ResultCode !== 0) {
        expect(isStkCallbackSuccess(callback)).toBe(false);
      } else {
        throw new Error("Expected failure callback");
      }
    });
  });

  describe("extractCallbackMetadata", () => {
    it("extracts normalized metadata from a success callback", () => {
      const parsed = parseStkCallbackBody(successCallback);
      const callback = parsed.Body.stkCallback as Extract<
        typeof parsed.Body.stkCallback,
        { ResultCode: 0 }
      >;
      const metadata = extractCallbackMetadata(callback);

      expect(metadata.amount).toBe(1500);
      expect(metadata.mpesaReceiptNumber).toBe("NLJ7RT61SV");
      expect(metadata.transactionDate).toBe("20260802000000");
      expect(metadata.phoneNumber).toBe("254712345678");
    });

    it("handles a missing optional Value field", () => {
      const callback = {
        Body: {
          stkCallback: {
            MerchantRequestID: "29115-34620561-1",
            CheckoutRequestID: "ws_CO_2",
            ResultCode: 0,
            ResultDesc: "Success",
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 1500 },
                { Name: "MpesaReceiptNumber", Value: "ABC123" },
                { Name: "TransactionDate", Value: "20260802000000" },
                { Name: "PhoneNumber", Value: 254712345678 },
                { Name: "Balance" }, // optional, no Value
              ],
            },
          },
        },
      };
      const parsed = parseStkCallbackBody(callback);
      const stkCallback = parsed.Body.stkCallback as Extract<
        typeof parsed.Body.stkCallback,
        { ResultCode: 0 }
      >;
      const metadata = extractCallbackMetadata(stkCallback);
      expect(metadata.amount).toBe(1500);
    });
  });
});