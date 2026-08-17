import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "../../test/helpers.js";

describe("health routes — integration (TESTING.md §4.3)", () => {
  const app = createTestApp();

  describe("GET /api/v1/health", () => {
    it("returns 200 with ok status when DB and Redis are healthy", async () => {
      const res = await request(app).get("/api/v1/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.checks.database).toBe("ok");
      expect(res.body.checks.redis).toBe("ok");
      expect(res.body.checks.queue).toBe("ok");
      expect(res.body.version).toBeTruthy();
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(res.body.timestamp).toBeTruthy();
    });

    it("is public — no auth required", async () => {
      const res = await request(app).get("/api/v1/health");
      expect(res.status).toBe(200);
    });
  });
});