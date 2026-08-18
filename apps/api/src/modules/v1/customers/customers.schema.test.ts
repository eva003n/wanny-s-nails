import { describe, expect, it } from "vitest";
import {
  createCustomerSchema,
  updateCustomerSchema,
  uuidParamSchema,
  listCustomersQuerySchema,
  customerBookingsQuerySchema,
} from "./customers.controller.js";

const VALID_UUID = "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e";

describe("customers — schema validation (TESTING.md §4.2)", () => {
  describe("createCustomerSchema", () => {
    it("accepts a valid name + Safaricom phone", () => {
      const result = createCustomerSchema.safeParse({
        name: "Jane Wanjiku",
        phone: "254712345678",
      });
      expect(result.success).toBe(true);
    });

    it("accepts an optional email", () => {
      const result = createCustomerSchema.safeParse({
        name: "Jane Wanjiku",
        phone: "254712345678",
        email: "jane@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a name shorter than 2 chars", () => {
      const result = createCustomerSchema.safeParse({
        name: "J",
        phone: "254712345678",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid phone", () => {
      const result = createCustomerSchema.safeParse({
        name: "Jane Wanjiku",
        phone: "0712345678",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid email", () => {
      const result = createCustomerSchema.safeParse({
        name: "Jane Wanjiku",
        phone: "254712345678",
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateCustomerSchema", () => {
    it("accepts a partial update with name only", () => {
      const result = updateCustomerSchema.safeParse({ name: "Jane Achieng" });
      expect(result.success).toBe(true);
    });

    it("accepts a phone update", () => {
      const result = updateCustomerSchema.safeParse({
        phone: "254723456789",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid phone", () => {
      const result = updateCustomerSchema.safeParse({ phone: "12345" });
      expect(result.success).toBe(false);
    });
  });

  describe("uuidParamSchema", () => {
    it("accepts a valid UUID", () => {
      const result = uuidParamSchema.safeParse({ id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid UUID", () => {
      const result = uuidParamSchema.safeParse({ id: "nope" });
      expect(result.success).toBe(false);
    });
  });

  describe("listCustomersQuerySchema", () => {
    it("accepts valid pagination + search", () => {
      const result = listCustomersQuerySchema.safeParse({
        page: "1",
        limit: "20",
        search: "Jane",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a limit over 100", () => {
      const result = listCustomersQuerySchema.safeParse({ limit: "200" });
      expect(result.success).toBe(false);
    });
  });

  describe("customerBookingsQuerySchema", () => {
    it("accepts valid pagination", () => {
      const result = customerBookingsQuerySchema.safeParse({
        page: "1",
        limit: "20",
        status: "APPROVED",
      });
      expect(result.success).toBe(true);
    });

    it("accepts an empty query", () => {
      const result = customerBookingsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});