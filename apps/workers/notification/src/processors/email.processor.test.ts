import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

const { childLogger, postMock } = vi.hoisted(() => ({
  childLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  postMock: vi.fn(),
}));

vi.mock("../lib/index.js", () => ({
  log: { child: () => childLogger },
}));

vi.mock("axios", () => ({
  default: { post: postMock },
}));

import { emailProcessor, type EmailJobData } from "./email.processor.js";

function makeJob(data: EmailJobData): Job<EmailJobData> {
  return { id: "job-1", data } as Job<EmailJobData>;
}

describe("emailProcessor (TESTING.md §4.2/4.3 — mocks Resend, asserts outcome)", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it("sends an email to Resend with the correct payload and bearer auth header", async () => {
    postMock.mockResolvedValueOnce({ status: 200 });
    const job = makeJob({
      to: "customer@example.com",
      subject: "Booking confirmed",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    await emailProcessor(job);

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body, options] = postMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(body.to).toEqual(["customer@example.com"]);
    expect(body.subject).toBe("Booking confirmed");
    expect(body.html).toBe("<p>Hi</p>");
    expect(body.text).toBe("Hi");
    expect(options.headers.Authorization).toMatch(/^Bearer .+/);
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("omits the text field entirely when no plain-text fallback is provided", async () => {
    postMock.mockResolvedValueOnce({ status: 200 });
    const job = makeJob({
      to: "customer@example.com",
      subject: "Subject only",
      html: "<p>Hi</p>",
    });

    await emailProcessor(job);

    const [, body] = postMock.mock.calls[0];
    expect(body).not.toHaveProperty("text");
  });

  it("skips the job without calling Resend when `to` is empty", async () => {
    const job = makeJob({ to: "", subject: "x", html: "x" });

    await emailProcessor(job);

    expect(postMock).not.toHaveBeenCalled();
  });

  it("rethrows the delivery error so BullMQ retries the job", async () => {
    postMock.mockRejectedValueOnce(new Error("Resend API unavailable"));
    const job = makeJob({ to: "customer@example.com", subject: "x", html: "x" });

    await expect(emailProcessor(job)).rejects.toThrow("Resend API unavailable");
  });
});
