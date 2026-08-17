import { describe, expect, it, vi, afterEach } from "vitest";
import {
  BookingPolicy,
  SlotAlignmentError,
  OutsideBusinessHoursError,
  BusinessClosedError,
  MinimumNoticeError,
} from "./BookingPolicy.js";

describe("BookingPolicy (TESTING.md §4.2 — pure domain logic)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("assertSlotAlignment", () => {
    it("accepts a time aligned to the 15-minute grid", () => {
      const start = new Date("2026-08-10T10:00:00.000Z");
      expect(() => BookingPolicy.assertSlotAlignment(start)).not.toThrow();
    });

    it("accepts a time at :15, :30, :45", () => {
      for (const minute of [15, 30, 45]) {
        const start = new Date(`2026-08-10T10:${minute}:00.000Z`);
        expect(() => BookingPolicy.assertSlotAlignment(start)).not.toThrow();
      }
    });

    it("rejects a time not aligned to the 15-minute grid", () => {
      const start = new Date("2026-08-10T10:07:00.000Z");
      expect(() => BookingPolicy.assertSlotAlignment(start)).toThrow(
        SlotAlignmentError,
      );
    });

    it("rejects a time at :59", () => {
      const start = new Date("2026-08-10T10:59:00.000Z");
      expect(() => BookingPolicy.assertSlotAlignment(start)).toThrow(
        SlotAlignmentError,
      );
    });
  });

  describe("assertWithinBusinessHours", () => {
    const businessHours = {
      id: "bh-1",
      dayOfWeek: 1,
      openTime: "08:00",
      closeTime: "19:00",
      isActive: true,
    };

    it("accepts a booking within business hours", () => {
      const start = new Date("2026-08-10T09:00:00.000Z");
      const end = new Date("2026-08-10T10:00:00.000Z");
      expect(() =>
        BookingPolicy.assertWithinBusinessHours(start, end, businessHours),
      ).not.toThrow();
    });

    it("accepts a booking exactly at opening time", () => {
      const start = new Date("2026-08-10T08:00:00.000Z");
      const end = new Date("2026-08-10T09:00:00.000Z");
      expect(() =>
        BookingPolicy.assertWithinBusinessHours(start, end, businessHours),
      ).not.toThrow();
    });

    it("accepts a booking ending exactly at closing time", () => {
      const start = new Date("2026-08-10T18:00:00.000Z");
      const end = new Date("2026-08-10T19:00:00.000Z");
      expect(() =>
        BookingPolicy.assertWithinBusinessHours(start, end, businessHours),
      ).not.toThrow();
    });

    it("rejects a booking starting before opening time", () => {
      const start = new Date("2026-08-10T07:30:00.000Z");
      const end = new Date("2026-08-10T08:30:00.000Z");
      expect(() =>
        BookingPolicy.assertWithinBusinessHours(start, end, businessHours),
      ).toThrow(OutsideBusinessHoursError);
    });

    it("rejects a booking ending after closing time", () => {
      const start = new Date("2026-08-10T18:30:00.000Z");
      const end = new Date("2026-08-10T19:30:00.000Z");
      expect(() =>
        BookingPolicy.assertWithinBusinessHours(start, end, businessHours),
      ).toThrow(OutsideBusinessHoursError);
    });

    it("rejects when the salon is closed (isActive=false)", () => {
      const closed = { ...businessHours, isActive: false };
      const start = new Date("2026-08-10T09:00:00.000Z");
      const end = new Date("2026-08-10T10:00:00.000Z");
      expect(() =>
        BookingPolicy.assertWithinBusinessHours(start, end, closed),
      ).toThrow(BusinessClosedError);
    });
  });

  describe("assertMinimumNotice", () => {
    it("accepts a start time more than 60 minutes in the future", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T08:00:00.000Z"));
      const start = new Date("2026-08-10T10:00:00.000Z");
      expect(() => BookingPolicy.assertMinimumNotice(start)).not.toThrow();
    });

    it("accepts a start time exactly 60 minutes in the future", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T08:00:00.000Z"));
      const start = new Date("2026-08-10T09:00:00.000Z");
      expect(() => BookingPolicy.assertMinimumNotice(start)).not.toThrow();
    });

    it("rejects a start time less than 60 minutes in the future", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T08:00:00.000Z"));
      const start = new Date("2026-08-10T08:30:00.000Z");
      expect(() => BookingPolicy.assertMinimumNotice(start)).toThrow(
        MinimumNoticeError,
      );
    });

    it("rejects a start time in the past", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T08:00:00.000Z"));
      const start = new Date("2026-08-10T07:00:00.000Z");
      expect(() => BookingPolicy.assertMinimumNotice(start)).toThrow(
        MinimumNoticeError,
      );
    });

    it("respects a custom minimum notice period", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T08:00:00.000Z"));
      const start = new Date("2026-08-10T09:30:00.000Z");
      // 90 minutes away, but custom minimum is 120
      expect(() => BookingPolicy.assertMinimumNotice(start, 120)).toThrow(
        MinimumNoticeError,
      );
    });
  });
});