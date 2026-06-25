import { type Job } from "bullmq";
import { config } from "../config.js";
import { logger } from "@wannys-nails/packages";
import { prisma } from "@wannys-nails/packages";

const log = logger.child({ module: "job:reminder-1h" });

// ─── Job Data Types ──────────────────────────────────────────

export interface Reminder1hJobData {
  reminderId: string;
  bookingId: string;
  customerPhone: string;
  customerName: string;
  serviceName: string;
  appointmentAt: string; // ISO datetime
}

// ─── Helpers ─────────────────────────────────────────────────

function formatTime12h(isoDate: string): string {
  const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
  const date = new Date(isoDate);
  const eatDate = new Date(date.getTime() + EAT_OFFSET_MS);
  const hours = eatDate.getUTCHours();
  const minutes = eatDate.getUTCMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  params: string[],
): Promise<void> {
  const { default: axios } = await import("axios");
  const GRAPH_API_VERSION = "v23.0";
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" },
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

async function sendWhatsAppText(to: string, text: string): Promise<void> {
  const { default: axios } = await import("axios");
  const GRAPH_API_VERSION = "v23.0";
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

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

// ─── Processor ─────────────────────────────────────────────────

export async function reminder1hProcessor(
  job: Job<Reminder1hJobData>,
): Promise<void> {
  const {
    reminderId,
    bookingId,
    customerPhone,
    customerName,
    serviceName,
    appointmentAt,
  } = job.data;

  log.info(
    { event: "reminder_1h.job.start", jobId: job.id, bookingId, customerPhone },
    "Processing 1h reminder job",
  );

  // Check reminder is still SCHEDULED (idempotency)
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
  });
  if (!reminder || reminder.status !== "SCHEDULED") {
    log.info(
      { event: "reminder_1h.job.skip", reminderId, status: reminder?.status },
      "Reminder already processed or not found, skipping",
    );
    return;
  }

  // Verify booking still exists and is active
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, deletedAt: true },
  });
  if (!booking || booking.deletedAt || booking.status === "CANCELLED") {
    log.info(
      { event: "reminder_1h.job.booking_inactive", bookingId },
      "Booking cancelled or deleted, cancelling reminder",
    );
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: "CANCELLED" },
    });
    return;
  }

  try {
    const timeDisplay = formatTime12h(appointmentAt);

    // Attempt to send via pre-approved template first
    try {
      await sendWhatsAppTemplate(customerPhone, "appointment_reminder_1h", [
        customerName,
        serviceName,
        timeDisplay,
      ]);
    } catch {
      // Template might not be approved yet, fall back to free-form text
      log.warn(
        { event: "reminder_1h.template_failed", reminderId },
        "Template delivery failed, falling back to free-form text",
      );
      const fallbackText = [
        `Hi ${customerName}! 👋`,
        "",
        "Your appointment is in 1 hour:",
        "",
        `✂️ Service: ${serviceName}`,
        `⏰ ${timeDisplay}`,
        `📍 Wanny's Nails, Nairobi`,
        "",
        "See you soon! 💅",
      ].join("\n");

      await sendWhatsAppText(customerPhone, fallbackText);
    }

    // Mark reminder as sent
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: "SENT", sentAt: new Date() },
    });

    log.info(
      { event: "reminder_1h.job.success", jobId: job.id, bookingId },
      "1h reminder sent successfully",
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    log.error(
      {
        event: "reminder_1h.job.failed",
        jobId: job.id,
        bookingId,
        error: err.message,
      },
      "1h reminder delivery failed",
    );

    // Mark reminder as FAILED
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: "FAILED" },
    });

    throw error; // BullMQ will retry
  }
}
