import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  authHeader,
  clearAll,
  createTestApp,
  createUser,
} from "../../test/helpers.js";

describe("push-subscriptions routes — integration (TESTING.md §4.3)", () => {
  beforeEach(async () => {
    await clearAll();
    await createUser();
  });

  const app = createTestApp();

  const SUB = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint-1",
    p256dh: "BASE64_P256DH_KEY",
    auth: "BASE64_AUTH_SECRET",
  };

  describe("POST /api/v1/push-subscriptions", () => {
    it("creates a push subscription with 200", async () => {
      const res = await request(app)
        .post("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"))
        .send(SUB);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBeTruthy();
    });

    it("upserts by endpoint (idempotent) — same endpoint returns the same id", async () => {
      const first = await request(app)
        .post("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"))
        .send(SUB);

      const second = await request(app)
        .post("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"))
        .send({ ...SUB, auth: "NEW_AUTH" });

      expect(first.body.data.id).toBe(second.body.data.id);
    });

    it("rejects an invalid payload with 400", async () => {
      const res = await request(app)
        .post("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"))
        .send({ endpoint: "not-a-url", p256dh: "", auth: "" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).post("/api/v1/push-subscriptions").send(SUB);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/push-subscriptions", () => {
    it("lists the authenticated user's active subscriptions", async () => {
      await request(app)
        .post("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"))
        .send(SUB);

      const res = await request(app)
        .get("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].endpoint).toBe(SUB.endpoint);
    });

    it("returns an empty list when nothing is subscribed", async () => {
      const res = await request(app)
        .get("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"));

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("DELETE /api/v1/push-subscriptions/unsubscribe", () => {
    it("deactivates a subscription with 204", async () => {
      await request(app)
        .post("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"))
        .send(SUB);

      const res = await request(app)
        .delete("/api/v1/push-subscriptions/unsubscribe")
        .set(authHeader("OWNER"))
        .send({ endpoint: SUB.endpoint });

      expect(res.status).toBe(204);

      // The subscription no longer appears in the list
      const list = await request(app)
        .get("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"));
      expect(list.body.data).toEqual([]);
    });

    it("returns 404 for an endpoint that doesn't belong to the user", async () => {
      const res = await request(app)
        .delete("/api/v1/push-subscriptions/unsubscribe")
        .set(authHeader("OWNER"))
        .send({ endpoint: "https://fcm.googleapis.com/fcm/send/unknown" });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/push-subscriptions/refresh", () => {
    it("deactivates the old endpoint and activates the new one", async () => {
      await request(app)
        .post("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"))
        .send(SUB);

      const newSub = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint-2",
        p256dh: "NEW_P256DH_KEY",
        auth: "NEW_AUTH_SECRET",
      };

      const res = await request(app)
        .post("/api/v1/push-subscriptions/refresh")
        .set(authHeader("OWNER"))
        .send({ oldEndpoint: SUB.endpoint, newSubscription: newSub });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBeTruthy();

      const list = await request(app)
        .get("/api/v1/push-subscriptions")
        .set(authHeader("OWNER"));
      // Old endpoint is deactivated → only the new one is active
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].endpoint).toBe(newSub.endpoint);
    });

    it("rejects a missing newSubscription with 400", async () => {
      const res = await request(app)
        .post("/api/v1/push-subscriptions/refresh")
        .set(authHeader("OWNER"))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});