import { describe, expect, it, vi, beforeEach, type MockInstance } from "vitest";
import type { Job } from "bullmq";
import type { NotificationJobData } from "@wannys-nails/core";
// Real module — see the `vi.spyOn` note below for why this isn't `vi.mock`-ed.
import webpushDefault from "web-push";
import type * as WebPushNS from "web-push";

// @types/web-push declares `sendNotification`/`setVapidDetails` as top-level
// named function exports, not as members of a typed default-export object,
// so the synthetic default import's inferred type doesn't satisfy
// `vi.spyOn`'s function-property constraint. This re-types the same runtime
// object (the CJS `module.exports`, which the default import *is*) against
// the real named-export signatures, without changing what it points to.
const webpush = webpushDefault as unknown as Pick<
  typeof WebPushNS,
  "sendNotification" | "setVapidDetails"
>;

const { childLogger, findManyMock, notificationUpdateMock, subscriptionUpdateMock } = vi.hoisted(
  () => ({
    childLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    findManyMock: vi.fn(),
    notificationUpdateMock: vi.fn(),
    subscriptionUpdateMock: vi.fn(),
  }),
);

vi.mock("../lib/index.js", () => ({
  log: { child: () => childLogger },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    pushSubscription: { findMany: findManyMock, update: subscriptionUpdateMock },
    notification: { update: notificationUpdateMock },
  },
}));

import {
  pushSender,
  getPushPriority,
  getTTLForPriority,
  mapPriorityToUrgency,
  truncateEndpoint,
  summarizeFailures,
  getPushBody,
} from "./push-sender.js";

describe("push-sender pure helpers (TESTING.md §4.2)", () => {
  describe("getPushPriority", () => {
    it("maps known high-priority templates to high", () => {
      expect(getPushPriority("new_booking_alert")).toBe("high");
      expect(getPushPriority("payment_received_alert")).toBe("high");
    });

    it("maps known low-priority templates to low", () => {
      expect(getPushPriority("slot_released_alert")).toBe("low");
      expect(getPushPriority("booking_no_show_alert")).toBe("low");
    });

    it("falls back to normal for an unlisted template", () => {
      expect(getPushPriority("some_unknown_template")).toBe("normal");
    });
  });

  describe("getTTLForPriority / mapPriorityToUrgency", () => {
    it("returns the expected TTL for each priority", () => {
      expect(getTTLForPriority("high")).toBe(4 * 60 * 60);
      expect(getTTLForPriority("normal")).toBe(60 * 60);
      expect(getTTLForPriority("low")).toBe(15 * 60);
    });

    it("maps each priority to its urgency header 1:1", () => {
      expect(mapPriorityToUrgency("high")).toBe("high");
      expect(mapPriorityToUrgency("normal")).toBe("normal");
      expect(mapPriorityToUrgency("low")).toBe("low");
    });
  });

  describe("truncateEndpoint", () => {
    it("shortens a valid push endpoint to origin + short suffix", () => {
      const result = truncateEndpoint(
        "https://fcm.googleapis.com/fcm/send/abcdefghijklmnopqrstuvwxyz123456",
      );
      expect(result).toBe("https://fcm.googleapis.com/…yz123456");
    });

    it("falls back to a placeholder for a malformed endpoint", () => {
      expect(truncateEndpoint("not-a-url")).toBe("unknown-endpoint");
    });
  });

  describe("summarizeFailures", () => {
    it("joins multiple failures with subscription id and status code", () => {
      const summary = summarizeFailures([
        { subscriptionId: "sub-1", endpoint: "e1", statusCode: 410, message: "gone" },
        { subscriptionId: "sub-2", endpoint: "e2", message: "network error" },
      ]);
      expect(summary).toContain("sub-1(410): gone");
      expect(summary).toContain("sub-2: network error");
    });

    it("truncates the joined summary to 1000 characters", () => {
      const longMessage = "x".repeat(2000);
      const summary = summarizeFailures([
        { subscriptionId: "sub-1", endpoint: "e1", message: longMessage },
      ]);
      expect(summary.length).toBe(1000);
    });
  });

  describe("getPushBody", () => {
    it("renders a known template with interpolated context", () => {
      const body = getPushBody("payment_received_alert", {
        customerName: "Jane",
        serviceName: "Manicure",
        amountKes: 1500,
      });
      expect(body).toContain(`KES ${(1500).toLocaleString()}`);
      expect(body).toContain("Jane");
    });

    it("falls back to a generic message for an unknown template", () => {
      const body = getPushBody("some_unknown_template", {
        customerName: "Jane",
        serviceName: "Manicure",
      });
      expect(body).toBe("Notification update for Jane.");
    });
  });
});

function makeJob(overrides: Partial<NotificationJobData> = {}): Job<NotificationJobData> {
  const data: NotificationJobData = {
    notificationId: "notif-1",
    recipientId: "user-1",
    recipientType: "ADMIN",
    channel: "PUSH",
    template: "new_booking_alert",
    payload: {
      customerName: "Jane",
      serviceName: "Manicure",
      appointmentAt: "2026-08-20T10:00:00.000Z",
    },
    endpoint: { address: "user-1", type: "push_subscription" },
    eventType: "BOOKING_CREATED",
    bookingId: "booking-1",
    ...overrides,
  };
  return { id: "job-1", data } as Job<NotificationJobData>;
}

const sub1 = { id: "sub-1", endpoint: "https://push.example.com/1", p256dh: "p1", auth: "a1" };
const sub2 = { id: "sub-2", endpoint: "https://push.example.com/2", p256dh: "p2", auth: "a2" };

const fakeSendResult: WebPushNS.SendResult = { statusCode: 201, body: "", headers: {} };

describe("pushSender (TESTING.md §3.5, §7 — notification retry/dead-letter behavior)", () => {
  let sendNotificationSpy: MockInstance<typeof webpush.sendNotification>;

  beforeEach(() => {
    findManyMock.mockReset();
    notificationUpdateMock.mockReset().mockResolvedValue(undefined);
    subscriptionUpdateMock.mockReset().mockResolvedValue(undefined);
    // Spy on the real, already-installed `web-push` module rather than
    // `vi.mock`-ing it. push-sender.ts fans out to subscriptions concurrently
    // via `Promise.allSettled`, and each branch calls `await import("web-push")`
    // internally — under genuine same-tick concurrency, Vitest's per-call
    // dynamic-import mock resolution can race and hand one of the concurrent
    // calls the real module instead of the `vi.mock` factory (reproduced in
    // isolation before landing this approach). Spying on the real module's
    // methods sidesteps module-resolution races entirely: every concurrent
    // `import()` returns the same real object reference, and the spy just
    // replaces its methods on that shared object. Re-spied every test since
    // `restoreMocks: true` (vitest.config.ts) restores spies before each test.
    vi.spyOn(webpush, "setVapidDetails").mockImplementation(() => {});
    sendNotificationSpy = vi.spyOn(webpush, "sendNotification");
  });

  it("marks the notification FAILED and never calls web-push when there are no active subscriptions", async () => {
    findManyMock.mockResolvedValueOnce([]);
    const job = makeJob();

    await pushSender(job);

    expect(sendNotificationSpy).not.toHaveBeenCalled();
    expect(notificationUpdateMock).toHaveBeenCalledWith({
      where: { id: "notif-1" },
      data: { status: "FAILED", lastError: "no_active_subscriptions" },
    });
  });

  it("marks the notification SENT with a null lastError when all subscriptions succeed", async () => {
    findManyMock.mockResolvedValueOnce([sub1, sub2]);
    sendNotificationSpy.mockResolvedValue(fakeSendResult);
    const job = makeJob();

    await pushSender(job);

    expect(notificationUpdateMock).toHaveBeenCalledTimes(1);
    const call = notificationUpdateMock.mock.calls[0][0];
    expect(call.where).toEqual({ id: "notif-1" });
    expect(call.data.status).toBe("SENT");
    expect(call.data.lastError).toBeNull();
    expect(call.data.sentAt).toBeInstanceOf(Date);
  });

  it("marks a stale subscription inactive and reports a partial failure when one of two sends returns 410", async () => {
    findManyMock.mockResolvedValueOnce([sub1, sub2]);
    sendNotificationSpy.mockImplementation(async (subscription) => {
      if (subscription.endpoint === sub2.endpoint) {
        const err = Object.assign(new Error("gone"), { statusCode: 410 });
        throw err;
      }
      return fakeSendResult;
    });
    const job = makeJob();

    await pushSender(job);

    expect(subscriptionUpdateMock).toHaveBeenCalledWith({
      where: { id: "sub-2" },
      data: { isActive: false },
    });
    const call = notificationUpdateMock.mock.calls[0][0];
    expect(call.data.status).toBe("SENT");
    expect(call.data.lastError).toContain("sub-2");
  });

  it("marks the notification FAILED and rejects when every subscription fails", async () => {
    findManyMock.mockResolvedValueOnce([sub1]);
    sendNotificationSpy.mockRejectedValue(new Error("network down"));
    const job = makeJob();

    await expect(pushSender(job)).rejects.toThrow(/All push subscriptions failed/);

    const call = notificationUpdateMock.mock.calls[0][0];
    expect(call.data.status).toBe("FAILED");
  });

  it("sends with the TTL and urgency matching the template's priority", async () => {
    findManyMock.mockResolvedValueOnce([sub1]);
    sendNotificationSpy.mockResolvedValue(fakeSendResult);
    const job = makeJob({ template: "new_booking_alert" }); // high priority

    await pushSender(job);

    expect(sendNotificationSpy).toHaveBeenCalledTimes(1);
    const [subscriptionArg, payloadArg, optionsArg] = sendNotificationSpy.mock.calls[0];
    expect(subscriptionArg).toEqual({
      endpoint: sub1.endpoint,
      keys: { p256dh: sub1.p256dh, auth: sub1.auth },
    });
    expect(optionsArg).toEqual({ TTL: 4 * 60 * 60, urgency: "high" });
    const parsedPayload = JSON.parse(payloadArg as string);
    expect(parsedPayload.tag).toBe("notif-1");
  });
});
