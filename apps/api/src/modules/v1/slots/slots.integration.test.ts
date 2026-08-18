import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  authHeader,
  clearAll,
  createBusinessHours,
  createService,
  createTestApp,
  createUser,
} from "../../../../test/helpers.js";

describe("slots routes — integration (TESTING.md §4.3)", () => {
  beforeEach(async () => {
    await clearAll();
    await createUser();
    await createBusinessHours();
  });

  const app = createTestApp();

  describe("GET /api/v1/slots/availability", () => {
    it("returns available slots for a service on a future date with 200", async () => {
      const service = await createService();
      // Use a date 7 days from now to avoid minimum-notice filtering
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const dateStr = future.toISOString().slice(0, 10);

      const res = await request(app)
        .get(`/api/v1/slots/availability?serviceIds=${service.id}&date=${dateStr}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.date).toBe(dateStr);
      expect(res.body.data.durationMinutes).toBe(60);
      expect(res.body.data.totalSlots).toBeGreaterThan(0);
      expect(res.body.data.slots.length).toBeGreaterThan(0);
      // Slots are 15-min granularity
      expect(res.body.data.slots[0].time).toMatch(/^\d{2}:\d{2}$/);
    });

    it("returns recommended slots when timePeriod is provided", async () => {
      const service = await createService();
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const dateStr = future.toISOString().slice(0, 10);

      const res = await request(app)
        .get(
          `/api/v1/slots/availability?serviceIds=${service.id}&date=${dateStr}&timePeriod=morning`,
        )
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.recommendedSlots).toBeDefined();
      expect(res.body.data.timePeriod).toBe("morning");
      expect(res.body.data.totalInPeriod).toBeGreaterThanOrEqual(0);
    });

    it("returns 422 when the salon is closed on the requested date", async () => {
      const service = await createService();
      // Use a Sunday (day 0) — business hours helper sets Sunday inactive
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      // Find the next Sunday
      const day = future.getDay();
      const daysUntilSunday = (7 - day) % 7;
      const sunday = new Date(future);
      sunday.setDate(future.getDate() + daysUntilSunday);
      const dateStr = sunday.toISOString().slice(0, 10);

      const res = await request(app)
        .get(`/api/v1/slots/availability?serviceIds=${service.id}&date=${dateStr}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("BUSINESS_CLOSED");
    });

    it("rejects an invalid date format with 400", async () => {
      const service = await createService();

      const res = await request(app)
        .get(`/api/v1/slots/availability?serviceIds=${service.id}&date=not-a-date`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a missing serviceIds with 400", async () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const dateStr = future.toISOString().slice(0, 10);

      const res = await request(app)
        .get(`/api/v1/slots/availability?date=${dateStr}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an invalid timePeriod with 400", async () => {
      const service = await createService();
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const dateStr = future.toISOString().slice(0, 10);

      const res = await request(app)
        .get(
          `/api/v1/slots/availability?serviceIds=${service.id}&date=${dateStr}&timePeriod=midnight`,
        )
        .set(authHeader("OWNER"));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const service = await createService();
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const dateStr = future.toISOString().slice(0, 10);

      const res = await request(app)
        .get(`/api/v1/slots/availability?serviceIds=${service.id}&date=${dateStr}`);

      expect(res.status).toBe(401);
    });
  });
});