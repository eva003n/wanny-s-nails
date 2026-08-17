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
} from "../../test/helpers.js";

describe("bookings routes — integration (TESTING.md §4.3)", () => {
  beforeEach(async () => {
    await clearAll();
    await createUser();
    await createBusinessHours();
  });

  const app = createTestApp();

  describe("GET /api/v1/bookings", () => {
    it("returns a paginated empty list with 200", async () => {
      const res = await request(app)
        .get("/api/v1/bookings")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it("returns seeded bookings with pagination meta", async () => {
      await createCustomer();
      await createService();
      await createBooking();

      const res = await request(app)
        .get("/api/v1/bookings?page=1&limit=10")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0].customer.name).toBe("Jane Wanjiku");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/v1/bookings");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/bookings/today", () => {
    it("returns only today's bookings", async () => {
      await createCustomer();
      await createService();
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      await createBooking({ appointmentAt: today });
      // A booking tomorrow should not appear in today's list
      await createBooking({
        id: "00000000-0000-4000-8000-000000000005",
        appointmentAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .get("/api/v1/bookings/today")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("GET /api/v1/bookings/:id", () => {
    it("returns a booking by id", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking();

      const res = await request(app)
        .get(`/api/v1/bookings/${booking.id}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(booking.id);
    });

    it("returns 404 for an unknown booking", async () => {
      const res = await request(app)
        .get("/api/v1/bookings/3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 for a non-UUID id", async () => {
      const res = await request(app)
        .get("/api/v1/bookings/not-a-uuid")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/v1/bookings", () => {
    it("creates a booking with 201 and snapshots service data", async () => {
      const customer = await createCustomer();
      const service = await createService();
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      start.setUTCHours(10, 0, 0, 0);

      const res = await request(app)
        .post("/api/v1/bookings")
        .set(authHeader("OWNER"))
        .send({
          customerId: customer.id,
          serviceIds: [service.id],
          appointmentAt: start.toISOString(),
          notes: "Gel nails please",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.priceKes).toBe(1500);
      // §7 snapshotting: serviceName/price captured at booking time
      expect(res.body.data.services[0].serviceName).toBe("Classic Manicure");
      expect(Number(res.body.data.services[0].price)).toBe(1500);
    });

    it("rejects an invalid payload with 400", async () => {
      const res = await request(app)
        .post("/api/v1/bookings")
        .set(authHeader("OWNER"))
        .send({ customerId: "not-a-uuid", serviceIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a booking outside business hours with 422", async () => {
      const customer = await createCustomer();
      const service = await createService();
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      start.setUTCHours(23, 0, 0, 0); // after close 19:00

      const res = await request(app)
        .post("/api/v1/bookings")
        .set(authHeader("OWNER"))
        .send({
          customerId: customer.id,
          serviceIds: [service.id],
          appointmentAt: start.toISOString(),
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("OUTSIDE_BUSINESS_HOURS");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).post("/api/v1/bookings").send({});
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/bookings/:id/approve", () => {
    it("approves a PENDING booking (OWNER) with 200", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking({ status: "PENDING" });

      const res = await request(app)
        .post(`/api/v1/bookings/${booking.id}/approve`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("APPROVED");
    });

    it("rejects approving a non-PENDING booking with 409", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking({ status: "APPROVED" });

      const res = await request(app)
        .post(`/api/v1/bookings/${booking.id}/approve`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("rejects STAFF role with 403 (RBAC chain)", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking();

      const res = await request(app)
        .post(`/api/v1/bookings/${booking.id}/approve`)
        .set(authHeader("STAFF"));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST /api/v1/bookings/:id/cancel", () => {
    it("cancels an APPROVED booking with 200", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking({ status: "APPROVED" });

      const res = await request(app)
        .post(`/api/v1/bookings/${booking.id}/cancel`)
        .set(authHeader("OWNER"))
        .send({ reason: "Client busy" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CANCELLED");
    });
  });

  describe("POST /api/v1/bookings/:id/reschedule", () => {
    it("reschedules an APPROVED booking with 200", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking({ status: "APPROVED" });
      const newTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
      newTime.setUTCHours(11, 0, 0, 0);

      const res = await request(app)
        .post(`/api/v1/bookings/${booking.id}/reschedule`)
        .set(authHeader("OWNER"))
        .send({ appointmentAt: newTime.toISOString() });

      expect(res.status).toBe(200);
      expect(new Date(res.body.data.appointmentAt).toISOString()).toBe(
        newTime.toISOString(),
      );
    });
  });

  describe("POST /api/v1/bookings/:id/mark-paid", () => {
    it("marks an APPROVED booking as paid (OWNER only) with 200", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking({
        status: "APPROVED",
        paymentStatus: "PENDING",
      });

      const res = await request(app)
        .post(`/api/v1/bookings/${booking.id}/mark-paid`)
        .set(authHeader("OWNER"))
        .send({ method: "CASH" });

      expect(res.status).toBe(200);
      expect(res.body.data.paymentStatus).toBe("SUCCESS");
    });

    it("rejects STAFF role with 403", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking({ status: "APPROVED" });

      const res = await request(app)
        .post(`/api/v1/bookings/${booking.id}/mark-paid`)
        .set(authHeader("STAFF"))
        .send({ method: "CASH" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("DELETE /api/v1/bookings/:id", () => {
    it("soft-deletes a booking (OWNER only) with 204", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking();

      const res = await request(app)
        .delete(`/api/v1/bookings/${booking.id}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(204);
    });

    it("rejects soft-delete for a booking with a successful payment with 409", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking({
        status: "APPROVED",
        paymentStatus: "SUCCESS",
      });

      const res = await request(app)
        .delete(`/api/v1/bookings/${booking.id}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("rejects STAFF role with 403", async () => {
      await createCustomer();
      await createService();
      const booking = await createBooking();

      const res = await request(app)
        .delete(`/api/v1/bookings/${booking.id}`)
        .set(authHeader("STAFF"));

      expect(res.status).toBe(403);
    });
  });
});