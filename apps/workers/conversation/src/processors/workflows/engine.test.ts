import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ConversationSession, StateTransitionResult } from "./types.js";

// ─── Session store ───
const mockLoadSession = vi.fn();
const mockSaveSession = vi.fn();
const mockDeleteSession = vi.fn();
const mockCreateNewSession = vi.fn();

vi.mock("./session.js", () => ({
  loadSession: mockLoadSession,
  saveSession: mockSaveSession,
  deleteSession: mockDeleteSession,
  createNewSession: mockCreateNewSession,
}));

// ─── Transport ───
const mockSendMessage = vi.fn();
vi.mock("./whatsapp.js", () => ({
  sendMessage: mockSendMessage,
}));

vi.mock("../../lib/index.js", () => ({
  log: {
    child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  },
}));

const mockGetByPhone = vi.fn();
vi.mock("./helpers.js", () => ({
  getByPhone: mockGetByPhone,
}));

const mockCustomerUpdate = vi.fn();
vi.mock("../../lib/prisma.js", () => ({
  prisma: { customer: { update: mockCustomerUpdate } },
}));

// ─── State handlers — every state module is mocked wholesale so the engine
// test is decoupled from each handler's real DB/queue dependencies. ───
const mockHandleIdle = vi.fn();
vi.mock("./states/idle.js", () => ({ handleIdle: mockHandleIdle }));

const mockHandleGreeting = vi.fn();
const mockBuildMainMenuMessage = vi.fn(() => ({
  type: "interactive_list" as const,
  text: "menu",
  listTitle: "Nail's by Wanny",
  listButtonText: "Choose",
  listSections: [],
}));
vi.mock("./states/greeting.js", () => ({
  handleGreeting: mockHandleGreeting,
  buildMainMenuMessage: mockBuildMainMenuMessage,
}));

const mockHandleDataCollection = vi.fn();
vi.mock("./states/dataCollection.js", () => ({ handleDataCollection: mockHandleDataCollection }));

const mockHandleCategorySelection = vi.fn();
vi.mock("./states/categorySelection.js", () => ({ handleCategorySelection: mockHandleCategorySelection }));

const mockHandleServiceSelection = vi.fn();
vi.mock("./states/serviceSelection.js", () => ({ handleServiceSelection: mockHandleServiceSelection }));

const mockHandleDateSelection = vi.fn();
vi.mock("./states/dateSelection.js", () => ({ handleDateSelection: mockHandleDateSelection }));

const mockHandleTimeSelection = vi.fn();
vi.mock("./states/timeSelection.js", () => ({ handleTimeSelection: mockHandleTimeSelection }));

const mockHandleTimePeriodSelection = vi.fn();
vi.mock("./states/timePeriodSelection.js", () => ({ handleTimePeriodSelection: mockHandleTimePeriodSelection }));

const mockHandleBookingConfirmation = vi.fn();
vi.mock("./states/bookingConfirmation.js", () => ({ handleBookingConfirmation: mockHandleBookingConfirmation }));

const mockHandleAwaitingPaymentPhone = vi.fn();
vi.mock("./states/awaitingPaymentPhone.js", () => ({ handleAwaitingPaymentPhone: mockHandleAwaitingPaymentPhone }));

const mockHandleAwaitingPayment = vi.fn();
vi.mock("./states/awaitingPayment.js", () => ({ handleAwaitingPayment: mockHandleAwaitingPayment }));

const mockHandleThankYou = vi.fn();
vi.mock("./states/thankYou.js", () => ({ handleThankYou: mockHandleThankYou }));

const mockHandleCancelConfirmation = vi.fn();
vi.mock("./states/cancelConfirmation.js", () => ({ handleCancelConfirmation: mockHandleCancelConfirmation }));

const mockHandleRescheduleDate = vi.fn();
const mockHandleRescheduleTime = vi.fn();
const mockHandleRescheduleConfirmation = vi.fn();
vi.mock("./states/reschedule.js", () => ({
  handleRescheduleDate: mockHandleRescheduleDate,
  handleRescheduleTime: mockHandleRescheduleTime,
  handleRescheduleConfirmation: mockHandleRescheduleConfirmation,
}));

const mockHandleHumanEscalation = vi.fn();
vi.mock("./states/humanEscalation.js", () => ({ handleHumanEscalation: mockHandleHumanEscalation }));

const { processMessage } = await import("./engine.js");

function baseSession(overrides?: Partial<ConversationSession>): ConversationSession {
  return {
    state: "GREETING",
    customerName: "Jane",
    invalidInputCount: 0,
    lastActivity: new Date().toISOString(),
    ...overrides,
  };
}

function okResult(overrides?: Partial<StateTransitionResult>): StateTransitionResult {
  return {
    messages: [],
    sessionUpdates: {},
    ...overrides,
  };
}

describe("FSM engine (processMessage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveSession.mockResolvedValue(undefined);
    mockDeleteSession.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue(undefined);
  });

  describe("global intents", () => {
    it("STOP deletes the session, sends the unsubscribe message, and logs consent withdrawal", async () => {
      mockLoadSession.mockResolvedValue(baseSession());
      mockGetByPhone.mockResolvedValue({ id: "customer-1" });
      mockCustomerUpdate.mockResolvedValue({});

      await processMessage({ phone: "254712345678", body: "STOP", customerName: "Jane" } as never);

      expect(mockDeleteSession).toHaveBeenCalledWith("254712345678");
      expect(mockSendMessage).toHaveBeenCalledWith(
        "254712345678",
        expect.objectContaining({ type: "text" }),
      );
      expect(mockCustomerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ consentGiven: false }) }),
      );
      expect(mockHandleGreeting).not.toHaveBeenCalled();
    });

    it("STOP still returns cleanly when the consent-withdrawal lookup throws", async () => {
      mockLoadSession.mockResolvedValue(baseSession());
      mockGetByPhone.mockRejectedValue(new Error("DB down"));

      await expect(
        processMessage({ phone: "254712345678", body: "stop", customerName: "Jane" } as never),
      ).resolves.toBeUndefined();

      expect(mockDeleteSession).toHaveBeenCalled();
    });

    it('HUMAN keyword forces HUMAN_ESCALATION and routes to its handler instead of the current state\'s', async () => {
      mockLoadSession.mockResolvedValue(baseSession({ state: "SERVICE_SELECTION" }));
      mockHandleHumanEscalation.mockResolvedValue(okResult({ nextState: "IDLE" }));

      await processMessage({ phone: "254712345678", body: "human", customerName: "Jane" } as never);

      expect(mockHandleHumanEscalation).toHaveBeenCalled();
      expect(mockHandleServiceSelection).not.toHaveBeenCalled();
    });

    it("MENU keyword resets flow data and routes to GREETING", async () => {
      mockLoadSession.mockResolvedValue(
        baseSession({ state: "SERVICE_SELECTION", selectedService: { id: "s", name: "n", durationMinutes: 1, priceKes: 1 }, invalidInputCount: 2 }),
      );
      mockHandleGreeting.mockResolvedValue(okResult());

      await processMessage({ phone: "254712345678", body: "menu", customerName: "Jane" } as never);

      expect(mockHandleGreeting).toHaveBeenCalled();
      const ctxArg = mockHandleGreeting.mock.calls[0]![0];
      expect(ctxArg.session.selectedService).toBeUndefined();
      expect(ctxArg.session.invalidInputCount).toBe(0);
    });
  });

  describe("IDLE branch", () => {
    it("sends outbound messages before saving the session (transactional-commit ordering)", async () => {
      mockLoadSession.mockResolvedValue(baseSession({ state: "IDLE" }));
      const callOrder: string[] = [];
      mockSendMessage.mockImplementation(async () => {
        callOrder.push("send");
      });
      mockSaveSession.mockImplementation(async () => {
        callOrder.push("save");
      });
      mockHandleIdle.mockResolvedValue(
        okResult({ nextState: "GREETING", messages: [{ type: "text", text: "hi" }] }),
      );

      await processMessage({ phone: "254712345678", body: "hi", customerName: "Jane" } as never);

      expect(callOrder.indexOf("send")).toBeLessThan(callOrder.indexOf("save"));
    });

    it("transitioning to DATA_COLLECTION sends the entry prompt", async () => {
      mockLoadSession
        .mockResolvedValueOnce(baseSession({ state: "IDLE" }))
        .mockResolvedValueOnce(baseSession({ state: "DATA_COLLECTION" }));
      mockHandleIdle.mockResolvedValue(okResult({ nextState: "DATA_COLLECTION" }));
      mockHandleDataCollection.mockResolvedValue(
        okResult({ messages: [{ type: "text", text: "What's your name?" }] }),
      );

      await processMessage({ phone: "254712345678", body: "hi", customerName: "Jane" } as never);

      expect(mockHandleDataCollection).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(
        "254712345678",
        expect.objectContaining({ text: "What's your name?" }),
      );
    });

    it("returning/new customer without DATA_COLLECTION sends the main menu", async () => {
      mockLoadSession
        .mockResolvedValueOnce(baseSession({ state: "IDLE" }))
        .mockResolvedValueOnce(baseSession({ state: "GREETING", customerName: "Jane" }));
      mockHandleIdle.mockResolvedValue(okResult({ nextState: "GREETING" }));

      await processMessage({ phone: "254712345678", body: "hi", customerName: "Jane" } as never);

      expect(mockBuildMainMenuMessage).toHaveBeenCalledWith("Jane");
      expect(mockSendMessage).toHaveBeenCalled();
    });
  });

  describe("main routing", () => {
    it("happy transition resets invalidInputCount and saves the session once at the end", async () => {
      mockLoadSession.mockResolvedValue(baseSession({ state: "GREETING", invalidInputCount: 2 }));
      mockHandleGreeting.mockResolvedValue(
        okResult({ nextState: "CATEGORY_SELECTION", messages: [{ type: "text", text: "ok" }] }),
      );
      mockHandleCategorySelection.mockResolvedValue(okResult());

      await processMessage({ phone: "254712345678", body: "1", customerName: "Jane" } as never);

      const savedSession = mockSaveSession.mock.calls.at(-1)![1] as ConversationSession;
      expect(savedSession.invalidInputCount).toBe(0);
      expect(savedSession.state).toBe("CATEGORY_SELECTION");
    });

    it("a throwing handler fails safe to HUMAN_ESCALATION without losing the message loop", async () => {
      mockLoadSession.mockResolvedValue(baseSession({ state: "SERVICE_SELECTION" }));
      mockHandleServiceSelection.mockRejectedValue(new Error("boom"));

      await processMessage({ phone: "254712345678", body: "1", customerName: "Jane" } as never);

      const savedSession = mockSaveSession.mock.calls.at(-1)![1] as ConversationSession;
      expect(savedSession.state).toBe("HUMAN_ESCALATION");
    });

    it("escalates to HUMAN_ESCALATION once invalidInputCount reaches 3, regardless of which state produced it", async () => {
      mockLoadSession.mockResolvedValue(baseSession({ state: "DATE_SELECTION", invalidInputCount: 2 }));
      mockHandleDateSelection.mockResolvedValue(
        okResult({ sessionUpdates: { invalidInputCount: 3 }, nextState: "DATE_SELECTION" }),
      );

      await processMessage({ phone: "254712345678", body: "??", customerName: "Jane" } as never);

      const savedSession = mockSaveSession.mock.calls.at(-1)![1] as ConversationSession;
      expect(savedSession.state).toBe("HUMAN_ESCALATION");
      expect(savedSession.invalidInputCount).toBe(0);
    });

    it("sends the new state's entry prompt when the handler transitions without returning any messages", async () => {
      mockLoadSession.mockResolvedValue(baseSession({ state: "GREETING" }));
      mockHandleGreeting.mockResolvedValue(okResult({ nextState: "CATEGORY_SELECTION", messages: [] }));
      mockHandleCategorySelection.mockResolvedValue(
        okResult({ messages: [{ type: "text", text: "Pick a category" }] }),
      );

      await processMessage({ phone: "254712345678", body: "1", customerName: "Jane" } as never);

      expect(mockHandleCategorySelection).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(
        "254712345678",
        expect.objectContaining({ text: "Pick a category" }),
      );
    });

    it("does not fire the entry-prompt lookup when the handler already returned messages", async () => {
      mockLoadSession.mockResolvedValue(baseSession({ state: "GREETING" }));
      mockHandleGreeting.mockResolvedValue(
        okResult({ nextState: "CATEGORY_SELECTION", messages: [{ type: "text", text: "already sent" }] }),
      );

      await processMessage({ phone: "254712345678", body: "1", customerName: "Jane" } as never);

      expect(mockHandleCategorySelection).not.toHaveBeenCalled();
    });
  });
});
