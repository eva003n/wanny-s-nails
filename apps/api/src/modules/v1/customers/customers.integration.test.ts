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

describe("customers routes — integration (TESTING.md §4.3)", () => {
  beforeEach(async () => {
    await clearAll();
    await createUser();
    await createBusinessHours();
  });

  const app = createTestApp();

  describe("GET /api/v1/customers", () => {
    it("returns a paginated empty list with 200", async () => {
      const res = await request(app)
        .get("/api/v1/customers")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it("returns seeded customers with pagination meta", async () => {
      await createCustomer();

      const res = await request(app)
        .get("/api/v1/customers?page=1&limit=10")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Jane Wanjiku");
      expect(res.body.data[0].phone).toBe("254712345678");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/v1/customers");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/customers", () => {
    it("creates a customer with 201", async () => {
      const res = await request(app)
        .post("/api/v1/customers")
        .set(authHeader("OWNER"))
        .send({ name: "Achieng Atieno", phone: "254723456789" });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Achieng Atieno");
      expect(res.body.data.phone).toBe("254723456789");
    });

    it("rejects an invalid phone with 400 (validation)", async () => {
      const res = await request(app)
        .post("/api/v1/customers")
        .set(authHeader("OWNER"))
        .send({ name: "Achieng Atieno", phone: "0712" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/v1/customers")
        .send({ name: "Jane", phone: "254712345678" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/customers/:id", () => {
    it("returns a customer with computed stats", async () => {
      const customer = await createCustomer();

      const res = await request(app)
        .get(`/api/v1/customers/${customer.id}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(customer.id);
      expect(res.body.data.stats.totalBookings).toBe(0);
      expect(res.body.data.stats.totalSpentKes).toBe(0);
    });

    it("returns 404 for an unknown customer", async () => {
      const res = await request(app)
        .get("/api/v1/customers/3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/v1/customers/:id", () => {
    it("updates the customer name with 200", async () => {
      const customer = await createCustomer();

      const res = await request(app)
        .patch(`/api/v1/customers/${customer.id}`)
        .set(authHeader("OWNER"))
        .send({ name: "Jane Achieng" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Jane Achieng");
    });

    it("returns 404 for an unknown customer", async () => {
      const res = await request(app)
        .patch("/api/v1/customers/3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e")
        .set(authHeader("OWNER"))
        .send({ name: "Nobody" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/customers/:id", () => {
    it("soft-deletes a customer with 204", async () => {
      const customer = await createCustomer();

      const res = await request(app)
        .delete(`/api/v1/customers/${customer.id}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(204);
    });

    it("is idempotent-ish: second soft-delete returns 404 (already gone)", async () => {
      const customer = await createCustomer();

      await request(app)
        .delete(`/api/v1/customers/${customer.id}`)
        .set(authHeader("OWNER"));

      const second = await request(app)
        .get(`/api/v1/customers/${customer.id}`)
        .set(authHeader("OWNER"));

      // soft-deleted rows are excluded by the global filter → 404
      expect(second.status).toBe(404);
    });
  });

  describe("GET /api/v1/customers/:id/bookings", () => {
    it("returns the customer's bookings", async () => {
      const customer = await createCustomer();
      const service = await createService();
      await createBooking({ customerId: customer.id, serviceId: service.id });

      const res = await request(app)
        .get(`/api/v1/customers/${customer.id}/bookings`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe("GET /api/v1/customers/:id/payments", () => {
    it("returns the customer's payments (amount hidden for STAFF)", async () => {
      const customer = await createCustomer();
      const service = await createService();
      await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        status: "APPROVED",
        paymentStatus: "SUCCESS",
      });

      const owner = await request(app)
        .get(`/api/v1/customers/${customer.id}/payments`)
        .set(authHeader("OWNER"));
      expect(owner.status).toBe(200);
      expect(owner.body.data).toHaveLength(1);
      expect(owner.body.data[0].amountKes).toBe(1500);

      const staff = await request(app)
        .get(`/api/v1/customers/${customer.id}/payments`)
        .set(authHeader("STAFF"));
      expect(staff.status).toBe(200);
      // §4.3 RBAC: non-OWNER sees amount nulled
      expect(staff.body.data[0].amountKes).toBeNull();
    });
  });
});