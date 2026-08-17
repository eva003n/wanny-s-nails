import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  authHeader,
  clearAll,
  createTestApp,
  createUser,
} from "../../test/helpers.js";

describe("business-hours routes — integration (TESTING.md §4.3)", () => {
  beforeEach(async () => {
    await clearAll();
    await createUser();
  });

  const app = createTestApp();

  describe("GET /api/v1/business-hours", () => {
    it("seeds defaults and returns 7 days of hours with 200", async () => {
      const res = await request(app)
        .get("/api/v1/business-hours")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(7);
      // Sunday (day 0) is closed by default
      expect(res.body.data[0].isActive).toBe(false);
      // Monday (day 1) opens at 08:00
      expect(res.body.data[1].openTime).toBe("08:00");
      expect(res.body.data[1].closeTime).toBe("19:00");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/v1/business-hours");
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/v1/business-hours", () => {
    it("updates business hours (OWNER only) with 200", async () => {
      const res = await request(app)
        .patch("/api/v1/business-hours")
        .set(authHeader("OWNER"))
        .send({
          hours: [
            { dayOfWeek: 0, openTime: "10:00", closeTime: "16:00", isActive: true },
            { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00", isActive: true },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].dayOfWeek).toBe(0);
      expect(res.body.data[0].openTime).toBe("10:00");
      expect(res.body.data[0].isActive).toBe(true);
    });

    it("rejects an invalid dayOfWeek with 400", async () => {
      const res = await request(app)
        .patch("/api/v1/business-hours")
        .set(authHeader("OWNER"))
        .send({
          hours: [
            { dayOfWeek: 7, openTime: "10:00", closeTime: "16:00", isActive: true },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an invalid time format with 400", async () => {
      const res = await request(app)
        .patch("/api/v1/business-hours")
        .set(authHeader("OWNER"))
        .send({
          hours: [
            { dayOfWeek: 1, openTime: "9am", closeTime: "16:00", isActive: true },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an empty hours array with 400", async () => {
      const res = await request(app)
        .patch("/api/v1/business-hours")
        .set(authHeader("OWNER"))
        .send({ hours: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects STAFF role with 403 (RBAC chain)", async () => {
      const res = await request(app)
        .patch("/api/v1/business-hours")
        .set(authHeader("STAFF"))
        .send({
          hours: [
            { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00", isActive: true },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .patch("/api/v1/business-hours")
        .send({
          hours: [
            { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00", isActive: true },
          ],
        });

      expect(res.status).toBe(401);
    });
  });
});