import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone, isValidE164, maskKenyanPhone } from "./phone.js";

describe("phone utils (TESTING.md §4.2 — pure functions)", () => {
  describe("normalizeKenyanPhone", () => {
    it("normalizes a 07XXXXXXXX number", () => {
      expect(normalizeKenyanPhone("0712345678")).toBe("254712345678");
    });

    it("normalizes a +254XXXXXXXXX number", () => {
      expect(normalizeKenyanPhone("+254712345678")).toBe("254712345678");
    });

    it("returns a 254XXXXXXXXX number unchanged", () => {
      expect(normalizeKenyanPhone("254712345678")).toBe("254712345678");
    });

    it("normalizes a 7XXXXXXXX number (9 digits)", () => {
      expect(normalizeKenyanPhone("712345678")).toBe("254712345678");
    });

    it("normalizes a number with spaces", () => {
      expect(normalizeKenyanPhone("07 123 45678")).toBe("254712345678");
    });

    it("throws for an invalid number", () => {
      expect(() => normalizeKenyanPhone("12345")).toThrow(
        "Invalid Kenyan phone number",
      );
    });

    it("throws for a non-Kenyan number", () => {
      expect(() => normalizeKenyanPhone("+15551234567")).toThrow(
        "Invalid Kenyan phone number",
      );
    });

    it("throws for an empty string", () => {
      expect(() => normalizeKenyanPhone("")).toThrow(
        "Invalid Kenyan phone number",
      );
    });
  });

  describe("isValidE164", () => {
    it("accepts a valid E.164 number", () => {
      expect(isValidE164("+254712345678")).toBe(true);
    });

    it("rejects a number without a plus sign", () => {
      expect(isValidE164("254712345678")).toBe(false);
    });

    it("rejects a number that is too short", () => {
      expect(isValidE164("+123")).toBe(false);
    });

    it("rejects a number that is too long", () => {
      expect(isValidE164("+12345678901234567890")).toBe(false);
    });

    it("rejects a number starting with 0 after the plus", () => {
      expect(isValidE164("+0123456789")).toBe(false);
    });
  });

  describe("maskKenyanPhone", () => {
    it("masks the middle digits of a 254 number", () => {
      expect(maskKenyanPhone("254712345678")).toBe("+254712***678");
    });

    it("masks the middle digits of a 07 number", () => {
      expect(maskKenyanPhone("0712345678")).toBe("0712***678");
    });

    it("returns the input for an invalid number", () => {
      expect(maskKenyanPhone("123")).toBe("123");
    });
  });
});