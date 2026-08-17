import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  sessionKey,
  createNewSession,
  resetInvalidCount,
  incrementInvalidCount,
} from "./session.js";
import type { ConversationSession } from "./types.js";

describe("conversation session (TESTING.md §4.2 — pure functions)", () => {
  describe("sessionKey", () => {
    it("builds a key with the session prefix", () => {
      expect(sessionKey("254712345678")).toBe("session:254712345678");
    });
  });

  describe("createNewSession", () => {
    it("creates a session in IDLE state with the customer name", () => {
      const session = createNewSession("Jane");
      expect(session.state).toBe("IDLE");
      expect(session.customerName).toBe("Jane");
      expect(session.invalidInputCount).toBe(0);
      expect(session.lastActivity).toBeTruthy();
    });

    it("creates a session with no selected service or date", () => {
      const session = createNewSession("Jane");
      expect(session.selectedService).toBeUndefined();
      expect(session.selectedDate).toBeUndefined();
      expect(session.selectedTime).toBeUndefined();
      expect(session.flow).toBeUndefined();
    });
  });

  describe("resetInvalidCount", () => {
    it("resets invalidInputCount to 0", () => {
      const session: ConversationSession = {
        state: "GREETING",
        invalidInputCount: 3,
        lastActivity: new Date().toISOString(),
      };
      const result = resetInvalidCount(session);
      expect(result.invalidInputCount).toBe(0);
    });

    it("returns a new object without mutating the original", () => {
      const session: ConversationSession = {
        state: "GREETING",
        invalidInputCount: 2,
        lastActivity: new Date().toISOString(),
      };
      const result = resetInvalidCount(session);
      expect(result).not.toBe(session);
      expect(session.invalidInputCount).toBe(2);
    });
  });

  describe("incrementInvalidCount", () => {
    it("increments invalidInputCount by 1", () => {
      const session: ConversationSession = {
        state: "GREETING",
        invalidInputCount: 0,
        lastActivity: new Date().toISOString(),
      };
      const result = incrementInvalidCount(session);
      expect(result.invalidInputCount).toBe(1);
    });

    it("increments from an existing count", () => {
      const session: ConversationSession = {
        state: "GREETING",
        invalidInputCount: 2,
        lastActivity: new Date().toISOString(),
      };
      const result = incrementInvalidCount(session);
      expect(result.invalidInputCount).toBe(3);
    });

    it("returns a new object without mutating the original", () => {
      const session: ConversationSession = {
        state: "GREETING",
        invalidInputCount: 0,
        lastActivity: new Date().toISOString(),
      };
      const result = incrementInvalidCount(session);
      expect(result).not.toBe(session);
      expect(session.invalidInputCount).toBe(0);
    });
  });
});