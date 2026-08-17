import { describe, expect, it } from "vitest";
import { availabilitySchema } from "./slots.controller.js";

describe("slots — schema validation (TESTING.md §4.2)", () => {
  describe("availabilitySchema", () => {
    it("accepts a valid serviceIds + date", () => {
      const result = availabilitySchema.safeParse({
        serviceIds: "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e",
        date: "2026-08-10",
      });
      expect(result.success).toBe(true);
    });

    it("accepts an optional timePeriod", () => {
      const result = availabilitySchema.safeParse({
        serviceIds: "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e",
        date: "2026-08-10",
        timePeriod: "afternoon",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all three timePeriod values", () => {
      for (const period of ["morning", "afternoon", "evening"]) {
        const result = availabilitySchema.safeParse({
          serviceIds: "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e",
          date: "2026-08-10",
          timePeriod: period,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects a missing serviceIds", () => {
      const result = availabilitySchema.safeParse({
        date: "2026-08-10",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an empty serviceIds", () => {
      const result = availabilitySchema.safeParse({
        serviceIds: "",
        date: "2026-08-10",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a missing date", () => {
      const result = availabilitySchema.safeParse({
        serviceIds: "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a non-YYYY-MM-DD date", () => {
      const result = availabilitySchema.safeParse({
        serviceIds: "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e",
        date: "10-08-2026",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid timePeriod", () => {
      const result = availabilitySchema.safeParse({
        serviceIds: "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e",
        date: "2026-08-10",
        timePeriod: "midnight",
      });
      expect(result.success).toBe(false);
    });
  });
});