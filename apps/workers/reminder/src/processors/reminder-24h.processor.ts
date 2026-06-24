import { type Job } from "bullmq";
import { config } from "@wannys-nails/packages";
import { logger } from "@wannys-nails/packages";
import { prisma } from "@wannys-nails/packages";

const log = logger.child({ module: "job:reminder-24h" });

// ─── Job Data Types ──────────────────────────────────────────

export interface Reminder24hJobData {
  reminderId: string;
  bookingId: string;
  customerPhone: string;
  customerName: string;
  serviceName: string;
  appointmentAt: string; // ISO datetime
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDateEAT(isoDate: string): string {
  const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
  const date = new Date(isoDate);
  const eatDate = new Date(date.getTime() + EAT_OFFSET_MS);
  return eatDate.toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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

export async function reminder24hProcessor(
  job: Job<Reminder24hJobData>,
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
    {
      event: "reminder_24h.job.start",
      jobId: job.id,
      bookingId,
      customerPhone,
    },
    "Processing 24h reminder job",
  );

  // Check reminder is still SCHEDULED (idempotency)
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
  });
  if (!reminder || reminder.status !== "SCHEDULED") {
    log.info(
      { event: "reminder_24h.job.skip", reminderId, status: reminder?.status },
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
      { event: "reminder_24h.job.booking_inactive", bookingId },
      "Booking cancelled or deleted, cancelling reminder",
    );
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: "CANCELLED" },
    });
    return;
  }

  try {
    // Attempt to send via pre-approved template first
    const dateDisplay = formatDateEAT(appointmentAt);
    const timeDisplay = formatTime12h(appointmentAt);

    try {
      await sendWhatsAppTemplate(customerPhone, "appointment_reminder_24h", [
        customerName,
        serviceName,
        dateDisplay,
        timeDisplay,
      ]);
    } catch {
      // Template might not be approved yet, fall back to free-form text
      log.warn(
        { event: "reminder_24h.template_failed", reminderId },
        "Template delivery failed, falling back to free-form text",
      );
      const fallbackText = [
        `Hi ${customerName}! 👋`,
        "",
        "This is a reminder that your appointment is tomorrow:",
        "",
        `✂️ Service: ${serviceName}`,
        `📅 ${dateDisplay}`,
        `⏰ ${timeDisplay}`,
        `📍 Wanny's Nails, Nairobi`,
        "",
        "See you then! 💅",
      ].join("\n");

      await sendWhatsAppText(customerPhone, fallbackText);
    }

    // Mark reminder as sent
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: "SENT", sentAt: new Date() },
    });

    log.info(
      { event: "reminder_24h.job.success", jobId: job.id, bookingId },
      "24h reminder sent successfully",
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    log.error(
      {
        event: "reminder_24h.job.failed",
        jobId: job.id,
        bookingId,
        error: err.message,
      },
      "24h reminder delivery failed",
    );

    // Mark reminder as FAILED
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: "FAILED" },
    });

    throw error; // BullMQ will retry
  }
}
