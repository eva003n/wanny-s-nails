import { Worker, type Job } from "bullmq";
import { logger } from "../../shared/lib/logger.js";
import { config } from "../../shared/lib/config.js";

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

// ─── Worker ───────────────────────────────────────────────────

const connectionOptions = {
  host: new URL(config.REDIS_URL).hostname,
  port: Number(new URL(config.REDIS_URL).port || 6379),
  password: new URL(config.REDIS_URL).password || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const emailWorker = new Worker<EmailJobData>(
  "notifications",
  async (job: Job<EmailJobData>) => {
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
      const err = error as { response?: { status?: number; data?: unknown }; message?: string };
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
  },
  {
    connection: connectionOptions,
    concurrency: 5,
  },
);

emailWorker.on("failed", (job, err) => {
  log.error(
    { event: "email.job.failed_permanently", jobId: job?.id, error: err.message },
    "Email job exhausted all retries",
  );
});

emailWorker.on("completed", (job) => {
  log.debug({ event: "email.job.completed", jobId: job.id }, "Email job completed");
});

log.info({ event: "email.worker.started" }, "Email notification worker started");