import { Worker, type Job } from "bullmq";
import { logger } from "../../shared/lib/logger.js";
import { config } from "../../shared/lib/config.js";

const log = logger.child({ module: "job:whatsapp" });

// ─── Job Data Types ──────────────────────────────────────────

export interface WhatsAppTextJobData {
  type: "text";
  to: string;
  text: string;
}

export interface WhatsAppTemplateJobData {
  type: "template";
  to: string;
  templateName: string;
  languageCode: string;
  params: string[];
}

export type WhatsAppJobData = WhatsAppTextJobData | WhatsAppTemplateJobData;

// ─── Graph API helpers ────────────────────────────────────────

const GRAPH_API_VERSION = "v23.0";

async function sendText(to: string, text: string): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const { default: axios } = await import("axios");
  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  );
}

async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  params: string[],
): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const { default: axios } = await import("axios");
  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components:
          params.length > 0
            ? [
                {
                  type: "body",
                  parameters: params.map((p) => ({ type: "text", text: p })),
                },
              ]
            : [],
      },
    },
    {
      headers: {
        Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
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

export const whatsappWorker = new Worker<WhatsAppJobData>(
  "notifications",
  async (job: Job<WhatsAppJobData>) => {
    const { type, to } = job.data;

    log.info(
      { event: "whatsapp.job.start", jobId: job.id, to, type },
      "Processing WhatsApp notification job",
    );

    try {
      if (type === "text") {
        await sendText(to, job.data.text);
      } else if (type === "template") {
        await sendTemplate(to, job.data.templateName, job.data.languageCode, job.data.params);
      }

      log.info(
        { event: "whatsapp.job.success", jobId: job.id, to },
        "WhatsApp message sent successfully",
      );
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown }; message?: string };
      log.error(
        {
          event: "whatsapp.job.failed",
          jobId: job.id,
          to,
          status: err.response?.status,
          response: err.response?.data,
          error: err.message,
        },
        "WhatsApp message delivery failed",
      );
      throw error; // BullMQ will retry
    }
  },
  {
    connection: connectionOptions,
    concurrency: 10,
  },
);

whatsappWorker.on("failed", (job, err) => {
  log.error(
    { event: "whatsapp.job.failed_permanently", jobId: job?.id, error: err.message },
    "WhatsApp job exhausted all retries",
  );
});

whatsappWorker.on("completed", (job) => {
  log.debug({ event: "whatsapp.job.completed", jobId: job.id }, "WhatsApp job completed");
});

log.info({ event: "whatsapp.worker.started" }, "WhatsApp notification worker started");