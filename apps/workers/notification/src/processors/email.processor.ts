import { type Job } from "bullmq";
import { log as logger } from "../lib/index.js";
import { _config as config } from "../lib/config.js";

const log = logger.child({ module: "job:email" });

// ─── Job Data Types ──────────────────────────────────────────

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text fallback */
  text?: string;
}

// ─── Resend helper ────────────────────────────────────────────

async function sendEmail(data: EmailJobData): Promise<void> {
  const { default: axios } = await import("axios");

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: `${config.APP_NAME} <notifications@${config.APP_NAME.toLowerCase().replace(/[' ]/g, "")}.com>`,
      to: [data.to],
      subject: data.subject,
      html: data.html,
      ...(data.text ? { text: data.text } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
}

// ─── Processor ─────────────────────────────────────────────────

export async function emailProcessor(job: Job<EmailJobData>): Promise<void> {
  const { to, subject } = job.data;

  // Only process jobs with a `to` field (distinguishes from WhatsApp jobs)
  if (!to) {
    log.debug({ jobId: job.id }, "Skipping non-email notification job");
    return;
  }

  log.info(
    { event: "email.job.start", jobId: job.id, to, subject },
    "Processing email notification job",
  );

  try {
    await sendEmail(job.data);
    log.info(
      { event: "email.job.success", jobId: job.id, to },
      "Email sent successfully",
    );
  } catch (error: unknown) {
    const err = error as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    log.error(
      {
        event: "email.job.failed",
        jobId: job.id,
        to,
        status: err.response?.status,
        response: err.response?.data,
        error: err.message,
      },
      "Email delivery failed",
    );
    throw error; // BullMQ will retry
  }
}
