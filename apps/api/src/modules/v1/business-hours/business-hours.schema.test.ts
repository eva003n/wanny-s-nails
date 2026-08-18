import { describe, expect, it } from "vitest";
import { hoursEntrySchema, updateHoursSchema } from "./business-hours.controller.js";

describe("business-hours — schema validation (TESTING.md §4.2)", () => {
  describe("hoursEntrySchema", () => {
    it("accepts a valid entry", () => {
      const result = hoursEntrySchema.safeParse({
        dayOfWeek: 1,
        openTime: "08:00",
        closeTime: "19:00",
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts Sunday (0) and Saturday (6)", () => {
      const sunday = hoursEntrySchema.safeParse({
        dayOfWeek: 0,
        openTime: "09:00",
        closeTime: "17:00",
        isActive: false,
      });
      expect(sunday.success).toBe(true);

      const saturday = hoursEntrySchema.safeParse({
        dayOfWeek: 6,
        openTime: "08:00",
        closeTime: "19:00",
        isActive: true,
      });
      expect(saturday.success).toBe(true);
    });

    it("rejects a dayOfWeek below 0", () => {
      const result = hoursEntrySchema.safeParse({
        dayOfWeek: -1,
        openTime: "08:00",
        closeTime: "19:00",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a dayOfWeek above 6", () => {
      const result = hoursEntrySchema.safeParse({
        dayOfWeek: 7,
        openTime: "08:00",
        closeTime: "19:00",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a non-integer dayOfWeek", () => {
      const result = hoursEntrySchema.safeParse({
        dayOfWeek: 1.5,
        openTime: "08:00",
        closeTime: "19:00",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid openTime format", () => {
      const result = hoursEntrySchema.safeParse({
        dayOfWeek: 1,
        openTime: "8am",
        closeTime: "19:00",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid closeTime format", () => {
      const result = hoursEntrySchema.safeParse({
        dayOfWeek: 1,
        openTime: "08:00",
        closeTime: "7pm",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a missing isActive", () => {
      const result = hoursEntrySchema.safeParse({
        dayOfWeek: 1,
        openTime: "08:00",
        closeTime: "19:00",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateHoursSchema", () => {
    it("accepts 1 to 7 entries", () => {
      const one = updateHoursSchema.safeParse({
        hours: [
          { dayOfWeek: 1, openTime: "08:00", closeTime: "19:00", isActive: true },
        ],
      });
      expect(one.success).toBe(true);

      const seven = updateHoursSchema.safeParse({
        hours: Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          openTime: "08:00",
          closeTime: "19:00",
          isActive: true,
        })),
      });
      expect(seven.success).toBe(true);
    });

    it("rejects an empty hours array", () => {
      const result = updateHoursSchema.safeParse({ hours: [] });
      expect(result.success).toBe(false);
    });

    it("rejects more than 7 entries", () => {
      const result = updateHoursSchema.safeParse({
        hours: Array.from({ length: 8 }, (_, i) => ({
          dayOfWeek: i,
          openTime: "08:00",
          closeTime: "19:00",
          isActive: true,
        })),
      });
      expect(result.success).toBe(false);
    });

    it("rejects a missing hours key", () => {
      const result = updateHoursSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});