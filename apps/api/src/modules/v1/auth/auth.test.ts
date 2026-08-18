import { describe, expect, it } from "vitest";
import {
  loginSchema,
  changePasswordSchema,
} from "./auth.controller.js";

// unit under test
describe("auth controllers", () => {
  describe("loginSchema", () => {
    // scenario + expectation
    it("accepts a valid email and password", () => {
      const result = loginSchema.safeParse({
        email: "wanny@gmail.com",
        password: "Admin123!",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a non-email value", () => {
      const result = loginSchema.safeParse({
        email: "not-an-email",
        password: "Admin123!",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("email");
      }
    });

    it("rejects password shorter than 8 chars", () => {
      const result = loginSchema.safeParse({
        email: "wanny@gmail.com",
        password: "short",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("password");
      }
    });

    it("rejects password longer than 72 chars", () => {
      const result = loginSchema.safeParse({
        email: "wanny@gmail.com",
        password: "a".repeat(73),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("password");
      }
    });

    it("rejects missing password", () => {
      const result = loginSchema.safeParse({ email: "wanny@gmail.com" });
      expect(result.success).toBe(false);
    });

    it("rejects empty email", () => {
      const result = loginSchema.safeParse({
        email: "",
        password: "Admin123!",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("changePasswordSchema", () => {
    it("accepts a valid password pair", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "OldPass123!",
        newPassword: "NewPass123!",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a short current password", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "short",
        newPassword: "NewPass123!",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a short new password", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "OldPass123!",
        newPassword: "short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing newPassword", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "OldPass123!",
      });
      expect(result.success).toBe(false);
    });
  });
});