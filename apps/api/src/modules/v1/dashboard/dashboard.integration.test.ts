import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  authHeader,
  clearAll,
  createBooking,
  createBusinessHours,
  createCustomer,
  createService,
  createTestApp,
  createUser,
} from "../../../../test/helpers.js";

describe("dashboard routes — integration (TESTING.md §4.3)", () => {
  beforeEach(async () => {
    await clearAll();
    await createUser();
    await createBusinessHours();
  });

  const app = createTestApp();

  describe("GET /api/v1/dashboard/stats", () => {
    it("returns zeroed stats with no data", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/stats")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.todayBookingsCount).toBe(0);
      expect(res.body.data.pendingCount).toBe(0);
      expect(res.body.data.todayRevenueKes).toBe(0);
      expect(res.body.data.unpaidKes).toBe(0);
      expect(res.body.data.weekRevenueKes).toBe(0);
      expect(res.body.data.monthRevenueKes).toBe(0);
    });

    it("returns stats reflecting seeded bookings and payments", async () => {
      const customer = await createCustomer();
      const service = await createService();
      // A PENDING booking today
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        appointmentAt: today,
        status: "PENDING",
        paymentStatus: "PENDING",
      });

      const res = await request(app)
        .get("/api/v1/dashboard/stats")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.todayBookingsCount).toBe(1);
      expect(res.body.data.pendingCount).toBe(1);
      expect(res.body.data.unpaidKes).toBe(1500);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/v1/dashboard/stats");
      expect(res.status).toBe(401);
    });
  });
});