import { describe, expect, it } from "vitest";
import {
  createSubscriptionSchema,
  refreshSubscriptionSchema,
  unsubscribeSchema,
} from "./push-subscriptions.controller.js";

describe("push-subscriptions — schema validation (TESTING.md §4.2)", () => {
  describe("createSubscriptionSchema", () => {
    it("accepts a valid subscription payload", () => {
      const result = createSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        p256dh: "BASE64_P256DH_KEY",
        auth: "BASE64_AUTH_SECRET",
        userAgent: "Mozilla/5.0 Chrome/120",
      });
      expect(result.success).toBe(true);
    });

    it("accepts without an optional userAgent", () => {
      const result = createSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        p256dh: "BASE64_P256DH_KEY",
        auth: "BASE64_AUTH_SECRET",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a non-URL endpoint", () => {
      const result = createSubscriptionSchema.safeParse({
        endpoint: "not-a-url",
        p256dh: "BASE64_P256DH_KEY",
        auth: "BASE64_AUTH_SECRET",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an empty p256dh", () => {
      const result = createSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        p256dh: "",
        auth: "BASE64_AUTH_SECRET",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an empty auth", () => {
      const result = createSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        p256dh: "BASE64_P256DH_KEY",
        auth: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("refreshSubscriptionSchema", () => {
    it("accepts a valid new subscription with optional oldEndpoint", () => {
      const result = refreshSubscriptionSchema.safeParse({
        oldEndpoint: "https://fcm.googleapis.com/fcm/send/old123",
        newSubscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/new123",
          p256dh: "NEW_P256DH_KEY",
          auth: "NEW_AUTH_SECRET",
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts without an oldEndpoint", () => {
      const result = refreshSubscriptionSchema.safeParse({
        newSubscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/new123",
          p256dh: "NEW_P256DH_KEY",
          auth: "NEW_AUTH_SECRET",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects a missing newSubscription", () => {
      const result = refreshSubscriptionSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects an invalid newSubscription endpoint", () => {
      const result = refreshSubscriptionSchema.safeParse({
        newSubscription: {
          endpoint: "not-a-url",
          p256dh: "NEW_P256DH_KEY",
          auth: "NEW_AUTH_SECRET",
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("unsubscribeSchema", () => {
    it("accepts a valid endpoint", () => {
      const result = unsubscribeSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a non-URL endpoint", () => {
      const result = unsubscribeSchema.safeParse({ endpoint: "abc" });
      expect(result.success).toBe(false);
    });

    it("rejects a missing endpoint", () => {
      const result = unsubscribeSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});