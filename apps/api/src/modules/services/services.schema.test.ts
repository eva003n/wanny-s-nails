import { describe, expect, it } from "vitest";
import {
  createServiceSchema,
  updateServiceSchema,
  uuidParamSchema,
  listServicesQuerySchema,
} from "./services.controller.js";

const VALID_UUID = "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e";

describe("services — schema validation (TESTING.md §4.2)", () => {
  describe("createServiceSchema", () => {
    it("accepts a valid service payload", () => {
      const result = createServiceSchema.safeParse({
        name: "Gel Overlay",
        category: "ENHANCEMENTS",
        durationMinutes: 120,
        priceKes: 3500,
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional description and sortOrder", () => {
      const result = createServiceSchema.safeParse({
        name: "Classic Manicure",
        description: "Basic nail care",
        category: "MANICURE",
        durationMinutes: 60,
        priceKes: 1500,
        sortOrder: 1,
      });
      expect(result.success).toBe(true);
    });

    it("rejects a name shorter than 2 chars", () => {
      const result = createServiceSchema.safeParse({
        name: "A",
        category: "MANICURE",
        durationMinutes: 60,
        priceKes: 1500,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a name longer than 100 chars", () => {
      const result = createServiceSchema.safeParse({
        name: "x".repeat(101),
        category: "MANICURE",
        durationMinutes: 60,
        priceKes: 1500,
      });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid category", () => {
      const result = createServiceSchema.safeParse({
        name: "Weird Service",
        category: "NOT_A_CATEGORY",
        durationMinutes: 60,
        priceKes: 1500,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a duration below 15 minutes", () => {
      const result = createServiceSchema.safeParse({
        name: "Quick Fix",
        category: "REPAIR",
        durationMinutes: 10,
        priceKes: 500,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a duration above 480 minutes", () => {
      const result = createServiceSchema.safeParse({
        name: "Marathon",
        category: "TREATMENT",
        durationMinutes: 481,
        priceKes: 10000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a non-integer duration", () => {
      const result = createServiceSchema.safeParse({
        name: "Test",
        category: "MANICURE",
        durationMinutes: 60.5,
        priceKes: 1500,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a price of 0 or negative", () => {
      const zero = createServiceSchema.safeParse({
        name: "Free",
        category: "MANICURE",
        durationMinutes: 60,
        priceKes: 0,
      });
      expect(zero.success).toBe(false);

      const negative = createServiceSchema.safeParse({
        name: "Negative",
        category: "MANICURE",
        durationMinutes: 60,
        priceKes: -100,
      });
      expect(negative.success).toBe(false);
    });

    it("rejects a non-integer price", () => {
      const result = createServiceSchema.safeParse({
        name: "Test",
        category: "MANICURE",
        durationMinutes: 60,
        priceKes: 1500.5,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a description longer than 72 chars", () => {
      const result = createServiceSchema.safeParse({
        name: "Test",
        description: "x".repeat(73),
        category: "MANICURE",
        durationMinutes: 60,
        priceKes: 1500,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateServiceSchema", () => {
    it("accepts a partial update with name only", () => {
      const result = updateServiceSchema.safeParse({ name: "New Name" });
      expect(result.success).toBe(true);
    });

    it("accepts a price update", () => {
      const result = updateServiceSchema.safeParse({ priceKes: 2000 });
      expect(result.success).toBe(true);
    });

    it("accepts isActive toggle", () => {
      const result = updateServiceSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid price", () => {
      const result = updateServiceSchema.safeParse({ priceKes: -5 });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid duration", () => {
      const result = updateServiceSchema.safeParse({ durationMinutes: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe("uuidParamSchema", () => {
    it("accepts a valid UUID", () => {
      const result = uuidParamSchema.safeParse({ id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid UUID", () => {
      const result = uuidParamSchema.safeParse({ id: "not-a-uuid" });
      expect(result.success).toBe(false);
    });

    it("rejects a missing id", () => {
      const result = uuidParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("listServicesQuerySchema", () => {
    it("accepts an empty query", () => {
      const result = listServicesQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts includeInactive", () => {
      const result = listServicesQuerySchema.safeParse({ includeInactive: "true" });
      expect(result.success).toBe(true);
    });
  });
});