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

describe("services routes — integration (TESTING.md §4.3)", () => {
  beforeEach(async () => {
    await clearAll();
    await createUser();
    await createBusinessHours();
  });

  const app = createTestApp();

  describe("GET /api/v1/services", () => {
    it("returns a list of active services", async () => {
      await createService();

      const res = await request(app)
        .get("/api/v1/services")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Classic Manicure");
    });

    it("excludes inactive services by default", async () => {
      await createService();
      const { prisma } = await import("../../../shared/lib/prisma.js");
      await prisma.nailService.update({
        where: { id: "00000000-0000-4000-8000-000000000003" },
        data: { isActive: false },
      });

      const res = await request(app)
        .get("/api/v1/services")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/v1/services");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/services/:id", () => {
    it("returns a service by id", async () => {
      const service = await createService();

      const res = await request(app)
        .get(`/api/v1/services/${service.id}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(service.id);
    });

    it("returns 404 for an unknown service", async () => {
      const res = await request(app)
        .get("/api/v1/services/3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/v1/services", () => {
    it("creates a service (OWNER only) with 201", async () => {
      const res = await request(app)
        .post("/api/v1/services")
        .set(authHeader("OWNER"))
        .send({
          name: "Gel Overlay",
          category: "ENHANCEMENTS",
          durationMinutes: 120,
          priceKes: 3500,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Gel Overlay");
      expect(res.body.data.priceKes).toBe(3500);
    });

    it("rejects an invalid category with 400", async () => {
      const res = await request(app)
        .post("/api/v1/services")
        .set(authHeader("OWNER"))
        .send({
          name: "Weird Service",
          category: "NOT_A_CATEGORY",
          durationMinutes: 60,
          priceKes: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects STAFF role with 403", async () => {
      const res = await request(app)
        .post("/api/v1/services")
        .set(authHeader("STAFF"))
        .send({
          name: "Gel Overlay",
          category: "ENHANCEMENTS",
          durationMinutes: 120,
          priceKes: 3500,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("PATCH /api/v1/services/:id", () => {
    it("updates a service (OWNER only) with 200", async () => {
      const service = await createService();

      const res = await request(app)
        .patch(`/api/v1/services/${service.id}`)
        .set(authHeader("OWNER"))
        .send({ priceKes: 1800 });

      expect(res.status).toBe(200);
      expect(res.body.data.priceKes).toBe(1800);
    });

    it("rejects STAFF role with 403", async () => {
      const service = await createService();

      const res = await request(app)
        .patch(`/api/v1/services/${service.id}`)
        .set(authHeader("STAFF"))
        .send({ priceKes: 1800 });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/v1/services/:id", () => {
    it("soft-deletes a service with no future bookings (OWNER only) with 204", async () => {
      const service = await createService();

      const res = await request(app)
        .delete(`/api/v1/services/${service.id}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(204);
    });

    it("rejects soft-delete when the service has future bookings with 422", async () => {
      const customer = await createCustomer();
      const service = await createService();
      await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        status: "APPROVED",
      });

      const res = await request(app)
        .delete(`/api/v1/services/${service.id}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("SERVICE_HAS_FUTURE_BOOKINGS");
    });

    it("rejects STAFF role with 403", async () => {
      const service = await createService();

      const res = await request(app)
        .delete(`/api/v1/services/${service.id}`)
        .set(authHeader("STAFF"));

      expect(res.status).toBe(403);
    });
  });
});