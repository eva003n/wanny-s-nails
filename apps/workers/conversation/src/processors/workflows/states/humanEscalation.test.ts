import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StateHandlerContext } from "../types.js";

const mockPublish = vi.fn();
const mockCount = vi.fn();
const mockSendMessage = vi.fn();

vi.mock("../../../lib/index.js", () => ({
  log: {
    child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  },
  _config: {
    APP_NAME: "Wanny's Nails",
    OWNER_WHATSAPP_PHONE: "",
  },
  redis: { publish: mockPublish },
  prisma: { pushSubscription: { count: mockCount } },
}));

vi.mock("../whatsapp.js", () => ({
  sendMessage: mockSendMessage,
}));

const { handleHumanEscalation } = await import("./humanEscalation.js");
const { _config: config } = await import("../../../lib/index.js");

function makeContext(overrides?: Partial<StateHandlerContext>): StateHandlerContext {
  return {
    message: "",
    rawMessage: "",
    phone: "254712345678",
    session: {
      state: "HUMAN_ESCALATION",
      customerName: "Jane",
      customerId: "customer-1",
      bookingId: "booking-1",
      invalidInputCount: 3,
      lastActivity: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("HUMAN_ESCALATION state handler (TESTING.md §4.2 — FSM transitions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (config as { OWNER_WHATSAPP_PHONE: string }).OWNER_WHATSAPP_PHONE = "";
    mockPublish.mockResolvedValue(1);
    mockCount.mockResolvedValue(1);
  });

  it("publishes the escalation payload to the Redis events channel", async () => {
    await handleHumanEscalation(makeContext());

    expect(mockPublish).toHaveBeenCalledWith(
      "events",
      expect.stringContaining("Jane"),
    );
    const payload = JSON.parse(mockPublish.mock.calls[0]![1] as string);
    expect(payload.data.customerPhone).toBe("254712345678");
    expect(payload.data.url).toBe("/customers/customer-1");
  });

  it("clears the session and transitions to IDLE", async () => {
    const result = await handleHumanEscalation(makeContext());

    expect(result.nextState).toBe("IDLE");
    expect(result.sessionUpdates.bookingId).toBeUndefined();
    expect(result.sessionUpdates.invalidInputCount).toBe(0);
    expect(result.messages[0]?.text).toContain("connect you with our staff");
  });

  it("does not send a WhatsApp fallback when OWNER_WHATSAPP_PHONE isn't configured", async () => {
    mockCount.mockResolvedValue(0);

    await handleHumanEscalation(makeContext());

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("sends a WhatsApp fallback to the owner when there are no active push subscribers", async () => {
    (config as { OWNER_WHATSAPP_PHONE: string }).OWNER_WHATSAPP_PHONE = "254700000000";
    mockCount.mockResolvedValue(0);

    await handleHumanEscalation(makeContext());

    expect(mockCount).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(mockSendMessage).toHaveBeenCalledWith(
      "254700000000",
      expect.objectContaining({ type: "text" }),
    );
  });

  it("does not send a WhatsApp fallback when there are active push subscribers", async () => {
    (config as { OWNER_WHATSAPP_PHONE: string }).OWNER_WHATSAPP_PHONE = "254700000000";
    mockCount.mockResolvedValue(2);

    await handleHumanEscalation(makeContext());

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
