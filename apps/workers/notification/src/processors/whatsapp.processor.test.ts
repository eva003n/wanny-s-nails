import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { HttpClientError, type OutboundMessage } from "@wannys-nails/core";

const { childLogger, postMock } = vi.hoisted(() => ({
  childLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  postMock: vi.fn(),
}));

vi.mock("../lib/index.js", () => ({
  log: { child: () => childLogger },
  whatsappHttpClient: { post: postMock },
}));

import { whatsappProcessor } from "./whatsapp.processor.js";

function makeJob(data: OutboundMessage): Job<OutboundMessage> {
  return { id: "job-1", data } as Job<OutboundMessage>;
}

function makeRows(n: number, prefix: string) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${i}`,
    title: `${prefix} row ${i}`,
  }));
}

describe("whatsappProcessor (TESTING.md §4.2/4.3 — mocks WhatsApp Cloud API, asserts outcome)", () => {
  beforeEach(() => {
    postMock.mockReset();
    postMock.mockResolvedValue({ status: 200 });
  });

  it("sends a text message with the correct body", async () => {
    const job = makeJob({ wamId: "w1", to: "254712345678", type: "text", text: "Hello" });

    await whatsappProcessor(job);

    expect(postMock).toHaveBeenCalledTimes(1);
    const [, body] = postMock.mock.calls[0];
    expect(body).toMatchObject({
      messaging_product: "whatsapp",
      to: "254712345678",
      type: "text",
      text: { body: "Hello" },
    });
  });

  it("sends an interactive list message unmodified when rows are within the 10-row limit", async () => {
    const job = makeJob({
      wamId: "w1",
      to: "254712345678",
      type: "interactive_list",
      text: "Pick one",
      listTitle: "Services",
      listButtonText: "Choose",
      listSections: [{ title: "A", rows: makeRows(6, "a") }],
    });

    await whatsappProcessor(job);

    const [, body] = postMock.mock.calls[0];
    expect(body.interactive.action.sections).toEqual([
      { title: "A", rows: makeRows(6, "a") },
    ]);
  });

  it("truncates interactive list rows to 10 total across sections when the limit is exceeded", async () => {
    const job = makeJob({
      wamId: "w1",
      to: "254712345678",
      type: "interactive_list",
      text: "Pick one",
      listTitle: "Services",
      listButtonText: "Choose",
      listSections: [
        { title: "A", rows: makeRows(6, "a") },
        { title: "B", rows: makeRows(5, "b") },
      ],
    });

    await whatsappProcessor(job);

    const [, body] = postMock.mock.calls[0];
    const sections = body.interactive.action.sections;
    const totalRows = sections.reduce(
      (sum: number, s: { rows: unknown[] }) => sum + s.rows.length,
      0,
    );
    expect(totalRows).toBe(10);
    expect(sections[0].rows).toHaveLength(6);
    expect(sections[1].rows).toHaveLength(4);
  });

  it("sends an interactive button message with reply buttons mapped correctly", async () => {
    const job = makeJob({
      wamId: "w1",
      to: "254712345678",
      type: "interactive_button",
      text: "Confirm?",
      buttons: [
        { id: "yes", title: "Yes" },
        { id: "no", title: "No" },
      ],
    });

    await whatsappProcessor(job);

    const [, body] = postMock.mock.calls[0];
    expect(body.interactive.action.buttons).toEqual([
      { type: "reply", reply: { id: "yes", title: "Yes" } },
      { type: "reply", reply: { id: "no", title: "No" } },
    ]);
  });

  it("sends a template message with body parameters when params are present", async () => {
    const job = makeJob({
      wamId: "w1",
      to: "254712345678",
      type: "template",
      // WhatsAppTemplatePayload fields, passed through job.data as `any` by the processor
      templateName: "booking_reminder",
      languageCode: "en",
      params: ["Jane", "3pm"],
    } as unknown as OutboundMessage);

    await whatsappProcessor(job);

    const [, body] = postMock.mock.calls[0];
    expect(body.template).toMatchObject({
      name: "booking_reminder",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Jane" },
            { type: "text", text: "3pm" },
          ],
        },
      ],
    });
  });

  it("omits the components array for a template message with no params", async () => {
    const job = makeJob({
      wamId: "w1",
      to: "254712345678",
      type: "template",
      templateName: "opt_in",
      languageCode: "en",
      params: [],
    } as unknown as OutboundMessage);

    await whatsappProcessor(job);

    const [, body] = postMock.mock.calls[0];
    expect(body.template.components).toEqual([]);
  });

  it("resolves without calling the API for an unknown message type", async () => {
    const job = makeJob({
      wamId: "w1",
      to: "254712345678",
      type: "unknown_type" as OutboundMessage["type"],
    });

    await expect(whatsappProcessor(job)).resolves.toBeUndefined();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("rejects when the WhatsApp Cloud API call fails, so BullMQ retries", async () => {
    postMock.mockReset();
    postMock.mockRejectedValueOnce(
      new HttpClientError("whatsapp", 500, "Internal error", { error: "boom" }),
    );
    const job = makeJob({ wamId: "w1", to: "254712345678", type: "text", text: "Hi" });

    await expect(whatsappProcessor(job)).rejects.toThrow(HttpClientError);
  });
});
