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

describe("notifications routes — integration (TESTING.md §4.3)", () => {
  beforeEach(async () => {
    await clearAll();
    await createUser();
    await createBusinessHours();
  });

  const app = createTestApp();

  async function seedNotification(overrides?: {
    status?: string;
    readAt?: Date | null;
    recipientId?: string;
  }) {
    const customer = await createCustomer();
    const service = await createService();
    const booking = await createBooking({
      customerId: customer.id,
      serviceId: service.id,
      status: "APPROVED",
    });

    const { prisma } = await import("../../../shared/lib/prisma.js");
    return prisma.notification.create({
      data: {
        bookingId: booking.id,
        recipientId: overrides?.recipientId ?? "00000000-0000-4000-8000-000000000001",
        recipientType: "OWNER",
        type: "BOOKING_CREATED",
        channel: "PUSH",
        payload: { message: "New booking created" },
        status: (overrides?.status ?? "PENDING") as never,
        readAt: overrides?.readAt ?? null,
        idempotencyKey: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
  }

  describe("GET /api/v1/notifications", () => {
    it("returns a paginated list of unread notifications (OWNER only)", async () => {
      await seedNotification();

      const res = await request(app)
        .get("/api/v1/notifications?page=1&limit=10")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0].type).toBe("BOOKING_CREATED");
    });

    it("excludes read notifications by default", async () => {
      await seedNotification({ readAt: new Date() });

      const res = await request(app)
        .get("/api/v1/notifications")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("filters by status", async () => {
      await seedNotification({ status: "FAILED" });

      const res = await request(app)
        .get("/api/v1/notifications?status=FAILED")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/v1/notifications");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/notifications/dead-letters", () => {
    it("returns only FAILED notifications (OWNER only)", async () => {
      await seedNotification({ status: "FAILED" });
      await seedNotification({ status: "PENDING" });

      const res = await request(app)
        .get("/api/v1/notifications/dead-letters")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe("FAILED");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/v1/notifications/dead-letters");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/notifications/unread-count", () => {
    it("returns the unread count for the authenticated user", async () => {
      await seedNotification();
      await seedNotification();

      const res = await request(app)
        .get("/api/v1/notifications/unread-count")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });

    it("returns 0 when all notifications are read", async () => {
      await seedNotification({ readAt: new Date() });

      const res = await request(app)
        .get("/api/v1/notifications/unread-count")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
    });
  });

  describe("GET /api/v1/notifications/:id", () => {
    it("returns a notification by id", async () => {
      const notification = await seedNotification();

      const res = await request(app)
        .get(`/api/v1/notifications/${notification.id}`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(notification.id);
    });

    it("returns 404 for an unknown notification", async () => {
      const res = await request(app)
        .get("/api/v1/notifications/3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/notifications/:id/retry", () => {
    it("resets a FAILED notification to PENDING (OWNER only)", async () => {
      const notification = await seedNotification({ status: "FAILED" });

      const res = await request(app)
        .post(`/api/v1/notifications/${notification.id}/retry`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain("queued for retry");

      // Verify the notification was reset
      const { prisma } = await import("../../../shared/lib/prisma.js");
      const updated = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(updated?.status).toBe("PENDING");
      expect(updated?.lastError).toBeNull();
    });

    it("rejects retrying a non-FAILED notification with 400", async () => {
      const notification = await seedNotification({ status: "PENDING" });

      const res = await request(app)
        .post(`/api/v1/notifications/${notification.id}/retry`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(400);
    });

    it("returns 404 for an unknown notification", async () => {
      const res = await request(app)
        .post("/api/v1/notifications/3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e/retry")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/notifications/:id/read", () => {
    it("marks a notification as read with 204", async () => {
      const notification = await seedNotification();

      const res = await request(app)
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set(authHeader("OWNER"));

      expect(res.status).toBe(204);

      const { prisma } = await import("../../../shared/lib/prisma.js");
      const updated = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(updated?.readAt).not.toBeNull();
    });

    it("returns 404 for an unknown notification", async () => {
      const res = await request(app)
        .patch("/api/v1/notifications/3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e/read")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(404);
    });
  });
});