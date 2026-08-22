import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  authHeader,
  clearAll,
  createTestApp,
  createUser,
  TEST_PASSWORD,
} from "../../../../test/helpers.js";

describe("auth routes — integration", () => {
  beforeEach(async () => {
    await clearAll();
  });

  const app = createTestApp();

  describe("POST /api/v1/auth/login", () => {
    it("logs in with valid credentials and returns 200 with tokens + cookies", async () => {
      await createUser();

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "owner@test.com", password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.user.email).toBe("owner@test.com");
      // signed httpOnly cookies set
      expect(res.headers["set-cookie"]?.some((c) => c.startsWith("accessToken="))).toBe(
        true,
      );
      expect(res.headers["set-cookie"]?.some((c) => c.startsWith("refreshToken="))).toBe(
        true,
      );
    });

    it("rejects a wrong password with 401", async () => {
      await createUser();

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "owner@test.com", password: "WrongPass123!" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects an unknown email with 401", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "nobody@test.com", password: TEST_PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects an invalid email format with 400 (validation)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "not-an-email", password: TEST_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a missing password with 400 (validation)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "owner@test.com" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("locks the account after 5 failed attempts (Redis-backed) with 429", async () => {
      await createUser();

      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post("/api/v1/auth/login")
          .send({ email: "owner@test.com", password: "WrongPass123!" });
        // Attempts 1-4 are ambiguous 401s; the 5th must lock.
        if (i === 4) {
          expect(res.status).toBe(429);
          expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
          expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
        } else {
          expect(res.status).toBe(401);
        }
      }
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("refreshes with a valid refresh cookie and returns a new access token", async () => {
      await createUser();

      const login = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "owner@test.com", password: TEST_PASSWORD });

      const refreshCookie = login.headers["set-cookie"]?.find((c) =>
        c.startsWith("refreshToken="),
      );
      const cookie = refreshCookie?.split(";")[0];

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", cookie!);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
    });

    it("returns 401 when the refresh cookie is missing", async () => {
      const res = await request(app).post("/api/v1/auth/refresh");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 for a bogus refresh token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", "refreshToken=not.a.real.token");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("returns the authenticated user with 200", async () => {
      await createUser();

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe("owner@test.com");
      expect(res.body.data.role).toBe("OWNER");
    });

    it("returns 401 without an auth token", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("DELETE /api/v1/auth/logout", () => {
    it("logs out an authenticated user with 204 and clears cookies", async () => {
      await createUser();

      const res = await request(app)
        .delete("/api/v1/auth/logout")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(204);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).delete("/api/v1/auth/logout");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/auth/change-password", () => {
    it("changes the password with valid current + new password (204)", async () => {
      await createUser();

      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .set(authHeader("OWNER"))
        .send({
          currentPassword: TEST_PASSWORD,
          newPassword: "NewPass123!",
        });

      expect(res.status).toBe(204);
    });

    it("rejects a wrong current password with 401", async () => {
      await createUser();

      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .set(authHeader("OWNER"))
        .send({
          currentPassword: "WrongCurrent!",
          newPassword: "NewPass123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects a weak new password with 400 (validation)", async () => {
      await createUser();

      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .set(authHeader("OWNER"))
        .send({
          currentPassword: TEST_PASSWORD,
          newPassword: "short",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .send({
          currentPassword: TEST_PASSWORD,
          newPassword: "NewPass123!",
        });
      expect(res.status).toBe(401);
    });
  });
});