import { describe, expect, it, vi, afterEach } from "vitest";
import {
  formatDateEAT,
  formatDateShortEAT,
  truncateTitle,
  formatTime12h,
  parsePhoneToE164,
  isValidKenyanPhone,
  nowInEAT,
} from "./helpers.js";

describe("conversation workflow helpers (TESTING.md §4.2 — pure functions)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatTime12h", () => {
    it("formats 00:00 as 12:00 AM", () => {
      expect(formatTime12h("00:00")).toBe("12:00 AM");
    });

    it("formats 09:30 as 9:30 AM", () => {
      expect(formatTime12h("09:30")).toBe("9:30 AM");
    });

    it("formats 12:00 as 12:00 PM", () => {
      expect(formatTime12h("12:00")).toBe("12:00 PM");
    });

    it("formats 14:00 as 2:00 PM", () => {
      expect(formatTime12h("14:00")).toBe("2:00 PM");
    });

    it("formats 19:45 as 7:45 PM", () => {
      expect(formatTime12h("19:45")).toBe("7:45 PM");
    });
  });

  describe("truncateTitle", () => {
    it("returns the text unchanged when within the limit", () => {
      expect(truncateTitle("Short title")).toBe("Short title");
    });

    it("truncates text longer than 24 chars with an ellipsis", () => {
      const result = truncateTitle("This is a very long title that exceeds 24 chars");
      expect(result.length).toBe(24);
      expect(result.endsWith("…")).toBe(true);
    });

    it("respects a custom max length", () => {
      const result = truncateTitle("This is a long title", 10);
      expect(result.length).toBe(10);
      expect(result.endsWith("…")).toBe(true);
    });
  });

  describe("parsePhoneToE164", () => {
    it("parses a 07XXXXXXXX number", () => {
      expect(parsePhoneToE164("0712345678")).toBe("254712345678");
    });

    it("parses a +254XXXXXXXXX number", () => {
      expect(parsePhoneToE164("+254712345678")).toBe("254712345678");
    });

    it("parses a 254XXXXXXXXX number", () => {
      expect(parsePhoneToE164("254712345678")).toBe("254712345678");
    });

    it("parses a number with dashes", () => {
      expect(parsePhoneToE164("0712-345-678")).toBe("254712345678");
    });

    it("returns null for an invalid number", () => {
      expect(parsePhoneToE164("12345")).toBeNull();
    });

    it("returns null for a non-Kenyan number", () => {
      expect(parsePhoneToE164("+15551234567")).toBeNull();
    });
  });

  describe("isValidKenyanPhone", () => {
    it("returns true for a valid Kenyan phone", () => {
      expect(isValidKenyanPhone("0712345678")).toBe(true);
      expect(isValidKenyanPhone("+254712345678")).toBe(true);
      expect(isValidKenyanPhone("254712345678")).toBe(true);
    });

    it("returns false for an invalid phone", () => {
      expect(isValidKenyanPhone("12345")).toBe(false);
      expect(isValidKenyanPhone("+15551234567")).toBe(false);
    });
  });

  describe("formatDateEAT", () => {
    it("formats a UTC ISO date in EAT", () => {
      const result = formatDateEAT("2026-08-10T10:00:00.000Z");
      expect(result).toContain("2026");
      expect(result).toContain("August");
    });
  });

  describe("formatDateShortEAT", () => {
    it("prefixes with 'Today' when isToday is true", () => {
      const date = new Date("2026-08-10T10:00:00.000Z");
      const result = formatDateShortEAT(date, true);
      expect(result.startsWith("Today")).toBe(true);
    });

    it("does not prefix when isToday is false", () => {
      const date = new Date("2026-08-10T10:00:00.000Z");
      const result = formatDateShortEAT(date, false);
      expect(result.startsWith("Today")).toBe(false);
    });
  });

  describe("nowInEAT", () => {
    it("returns a date 3 hours ahead of UTC", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T10:00:00.000Z"));
      const eat = nowInEAT();
      expect(eat.getTime()).toBe(new Date("2026-08-10T13:00:00.000Z").getTime());
    });
  });
});