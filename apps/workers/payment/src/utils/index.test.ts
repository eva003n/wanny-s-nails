import { describe, expect, it } from "vitest";
import { getFailureReason, getTerminalStatus } from "./index.js";

describe("payment worker utils (TESTING.md §4.2 — pure functions)", () => {
  describe("getFailureReason", () => {
    it("returns a known reason for success (0)", () => {
      expect(getFailureReason(0)).toContain("successful");
    });

    it("returns a known reason for insufficient balance (1)", () => {
      expect(getFailureReason(1)).toContain("Insufficient");
    });

    it("returns a known reason for cancelled (1032)", () => {
      expect(getFailureReason(1032)).toContain("cancelled");
    });

    it("returns a known reason for expired (1019)", () => {
      expect(getFailureReason(1019)).toContain("expired");
    });

    it("returns a known reason for wrong PIN (2001)", () => {
      expect(getFailureReason(2001)).toContain("PIN");
    });

    it("returns a fallback for an unknown code", () => {
      expect(getFailureReason(9999)).toBe("Daraja error code: 9999");
    });
  });

  describe("getTerminalStatus", () => {
    it("maps 1032 (customer cancelled) to CANCELLED", () => {
      expect(getTerminalStatus(1032)).toBe("CANCELLED");
    });

    it("maps 1037 (timeout) to EXPIRED", () => {
      expect(getTerminalStatus(1037)).toBe("EXPIRED");
    });

    it("maps 1019 (transaction expired) to EXPIRED", () => {
      expect(getTerminalStatus(1019)).toBe("EXPIRED");
    });

    it("maps 1001 (another transaction in progress) to PENDING", () => {
      expect(getTerminalStatus(1001)).toBe("PENDING");
    });

    it("maps 4999 (still processing) to PENDING", () => {
      expect(getTerminalStatus(4999)).toBe("PENDING");
    });

    it("maps any other code to FAILED", () => {
      expect(getTerminalStatus(1)).toBe("FAILED");
      expect(getTerminalStatus(17)).toBe("FAILED");
      expect(getTerminalStatus(2001)).toBe("FAILED");
    });

    it("accepts string codes as well as numbers", () => {
      expect(getTerminalStatus("1032")).toBe("CANCELLED");
      expect(getTerminalStatus("1037")).toBe("EXPIRED");
      expect(getTerminalStatus("0")).toBe("FAILED");
    });
  });
});