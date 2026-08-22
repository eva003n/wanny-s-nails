import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getRecommendedSlots,
  getTimePeriodLabel,
  TIME_PERIODS,
  type SlotLike,
} from "./recommendation.js";

function makeSlots(hours: number[]): SlotLike[] {
  return hours.map((h) => ({
    time: `${String(h).padStart(2, "0")}:00`,
    appointmentAt: `2026-08-10T${String(h).padStart(2, "0")}:00:00.000Z`,
  }));
}

describe("recommendation engine (TESTING.md §4.2 — pure functions)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getRecommendedSlots", () => {
    it("filters slots to the requested time period", () => {
      const slots = makeSlots([8, 9, 10, 13, 14, 18, 19]);
      const result = getRecommendedSlots({
        slots,
        timePeriod: "morning",
      });

      expect(result.timePeriod).toBe("morning");
      expect(result.totalInPeriod).toBe(3);
      // All returned slots are in the morning range (7-11)
      for (const slot of result.slots) {
        const hour = parseInt(slot.time.split(":")[0]!, 10);
        expect(hour).toBeGreaterThanOrEqual(7);
        expect(hour).toBeLessThan(12);
      }
    });

    it("returns afternoon slots in the 12-16 range", () => {
      const slots = makeSlots([8, 12, 13, 16, 17]);
      const result = getRecommendedSlots({
        slots,
        timePeriod: "afternoon",
      });

      expect(result.totalInPeriod).toBe(3);
      for (const slot of result.slots) {
        const hour = parseInt(slot.time.split(":")[0]!, 10);
        expect(hour).toBeGreaterThanOrEqual(12);
        expect(hour).toBeLessThan(17);
      }
    });

    it("returns evening slots in the 17-19 range", () => {
      const slots = makeSlots([16, 17, 18, 19, 20]);
      const result = getRecommendedSlots({
        slots,
        timePeriod: "evening",
      });

      expect(result.totalInPeriod).toBe(3);
      for (const slot of result.slots) {
        const hour = parseInt(slot.time.split(":")[0]!, 10);
        expect(hour).toBeGreaterThanOrEqual(17);
        expect(hour).toBeLessThan(20);
      }
    });

    it("returns an empty result when no slots match the period", () => {
      const slots = makeSlots([8, 9, 10]);
      const result = getRecommendedSlots({
        slots,
        timePeriod: "evening",
      });

      expect(result.slots).toHaveLength(0);
      expect(result.totalInPeriod).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it("limits results to maxResults and sets truncated=true", () => {
      const slots = makeSlots([8, 9, 10, 11, 12, 13, 14, 15]);
      const result = getRecommendedSlots({
        slots,
        timePeriod: "morning",
        maxResults: 2,
      });

      expect(result.slots).toHaveLength(2);
      expect(result.totalInPeriod).toBe(4);
      expect(result.truncated).toBe(true);
    });

    it("does not set truncated when results fit within maxResults", () => {
      const slots = makeSlots([8, 9]);
      const result = getRecommendedSlots({
        slots,
        timePeriod: "morning",
        maxResults: 5,
      });

      expect(result.slots).toHaveLength(2);
      expect(result.truncated).toBe(false);
    });

    it("throws for an unknown strategy", () => {
      const slots = makeSlots([8, 9]);
      expect(() =>
        getRecommendedSlots({
          slots,
          timePeriod: "morning",
          strategy: "unknown" as never,
        }),
      ).toThrow("Unknown recommendation strategy");
    });

    it("shuffles results randomly (non-deterministic order)", () => {
      const slots = makeSlots([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
      const result = getRecommendedSlots({
        slots,
        timePeriod: "morning",
        maxResults: 10,
      });

      // All 4 morning slots (7-11) should be present, just possibly in different order
      expect(result.slots).toHaveLength(4);
      const times = result.slots.map((s) => s.time).sort();
      expect(times).toEqual(["08:00", "09:00", "10:00", "11:00"]);
    });
  });

  describe("getTimePeriodLabel", () => {
    it("returns a formatted label for morning", () => {
      const label = getTimePeriodLabel("morning");
      expect(label).toContain("Morning");
      expect(label).toContain("7:00 AM");
      expect(label).toContain("11:00 AM");
    });

    it("returns a formatted label for afternoon", () => {
      const label = getTimePeriodLabel("afternoon");
      expect(label).toContain("Afternoon");
      expect(label).toContain("12:00 PM");
      expect(label).toContain("4:00 PM");
    });

    it("returns a formatted label for evening", () => {
      const label = getTimePeriodLabel("evening");
      expect(label).toContain("Evening");
      expect(label).toContain("5:00 PM");
      expect(label).toContain("7:00 PM");
    });
  });

  describe("TIME_PERIODS", () => {
    it("defines all three periods with correct ranges", () => {
      expect(TIME_PERIODS.morning.startHour).toBe(7);
      expect(TIME_PERIODS.morning.endHour).toBe(12);
      expect(TIME_PERIODS.afternoon.startHour).toBe(12);
      expect(TIME_PERIODS.afternoon.endHour).toBe(17);
      expect(TIME_PERIODS.evening.startHour).toBe(17);
      expect(TIME_PERIODS.evening.endHour).toBe(20);
    });
  });
});