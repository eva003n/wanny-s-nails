import { describe, expect, it } from "vitest";
import {
  stkPushSchema,
  paymentQuerySchema,
  paymentParamSchema,
} from "./payments.controller.js";

const VALID_UUID = "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e";

describe("payments — schema validation (TESTING.md §4.2)", () => {
  describe("stkPushSchema", () => {
    it("accepts a valid bookingId + Kenyan Safaricom phone", () => {
      const result = stkPushSchema.safeParse({
        bookingId: VALID_UUID,
        phoneNumber: "254712345678",
      });
      expect(result.success).toBe(true);
    });

    it("accepts a 1-network number (2541xxxxxxxx)", () => {
      const result = stkPushSchema.safeParse({
        bookingId: VALID_UUID,
        phoneNumber: "254123456789",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a non-Safaricom Kenyan prefix (2542xxxx)", () => {
      const result = stkPushSchema.safeParse({
        bookingId: VALID_UUID,
        phoneNumber: "254212345678",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a number with leading + or spaces", () => {
      const result = stkPushSchema.safeParse({
        bookingId: VALID_UUID,
        phoneNumber: "+254712345678",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a non-UUID bookingId", () => {
      const result = stkPushSchema.safeParse({
        bookingId: "not-a-uuid",
        phoneNumber: "254712345678",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a missing phoneNumber", () => {
      const result = stkPushSchema.safeParse({ bookingId: VALID_UUID });
      expect(result.success).toBe(false);
    });
  });

  describe("paymentQuerySchema", () => {
    it("accepts an empty query", () => {
      const result = paymentQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts optional status / from / to / customerId", () => {
      const result = paymentQuerySchema.safeParse({
        status: "SUCCESS",
        from: "2026-07-01T00:00:00.000Z",
        to: "2026-07-31T23:59:59.000Z",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("paymentParamSchema", () => {
    it("accepts a valid UUID", () => {
      const result = paymentParamSchema.safeParse({ id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid UUID", () => {
      const result = paymentParamSchema.safeParse({ id: "123" });
      expect(result.success).toBe(false);
    });
  });
});