import { type Job } from "bullmq";
import { config } from "@wannys-nails/packages";
import { logger } from "@wannys-nails/packages";
import { prisma } from "@wannys-nails/packages";
import axios from "axios";

const log = logger.child({ module: "job:payment-callback" });

const GRAPH_API_VERSION = "v23.0";

// ─── Job Data Types ──────────────────────────────────────────

export interface PaymentCallbackJobData {
  resultCode: number;
  checkoutRequestId: string;
  rawCallback: Record<string, unknown>;
}

// ─── WhatsApp helpers ─────────────────────────────────────────

async function sendWhatsAppText(to: string, text: string): Promise<void> {
  try {
    await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
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
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
    log.error(
      { event: "payment_callback.whatsapp.send_failed", to, error: axiosError.message },
      "Failed to send WhatsApp text message",
    );
    throw axiosError;
  }
}

async function sendWhatsAppInteractiveButtons(
  to: string,
  text: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<void> {
  try {
    await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text },
          action: {
            buttons: buttons.map((btn) => ({
              type: "reply",
              reply: { id: btn.id, title: btn.title },
            })),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
    log.error(
      { event: "payment_callback.whatsapp.send_button_failed", to, error: axiosError.message },
      "Failed to send WhatsApp interactive button message",
    );
    throw axiosError;
  }
}

// ─── Date/time helpers ────────────────────────────────────────

function formatDateEAT(isoString: string): string {
  const date = new Date(isoString);
  // Convert to East Africa Time (UTC+3)
  const eatDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[eatDate.getUTCDay()]}, ${eatDate.getUTCDate()} ${months[eatDate.getUTCMonth()]} ${eatDate.getUTCFullYear()}`;
}

function formatTime12h(isoString: string): string {
  const date = new Date(isoString);
  const eatDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const period = eatDate.getUTCHours() >= 12 ? "PM" : "AM";
  const hours12 = eatDate.getUTCHours() % 12 || 12;
  return `${hours12}:${String(eatDate.getUTCMinutes()).padStart(2, "0")} ${period}`;
}

// ─── Session helpers (raw Redis) ──────────────────────────────

import Redis from "ioredis";

interface WhatsAppSession {
  state: string;
  [key: string]: unknown;
}

function createRedisClient(): Redis {
  return new Redis(config.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

async function loadSession(phone: string): Promise<WhatsAppSession | null> {
  const client = createRedisClient();
  try {
    const data = await client.get(`whatsapp:session:${phone}`);
    return data ? (JSON.parse(data) as WhatsAppSession) : null;
  } finally {
    await client.quit();
  }
}

async function saveSession(phone: string, session: WhatsAppSession): Promise<void> {
  const client = createRedisClient();
  try {
    await client.set(`whatsapp:session:${phone}`, JSON.stringify(session));
  } finally {
    await client.quit();
  }
}

async function deleteSession(phone: string): Promise<void> {
  const client = createRedisClient();
  try {
    await client.del(`whatsapp:session:${phone}`);
  } finally {
    await client.quit();
  }
}

// ─── Processor ─────────────────────────────────────────────────

export async function paymentCallbackProcessor(job: Job<PaymentCallbackJobData>): Promise<void> {
  const { resultCode, checkoutRequestId } = job.data;

  log.info(
    { event: "payment_callback.job.start", jobId: job.id, checkoutRequestId, resultCode },
    "Processing payment callback job",
  );

  // Look up the payment with booking and customer details
  const payment = await prisma.payment.findUnique({
    where: { checkoutRequestId },
    include: {
      booking: {
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          service: { select: { name: true, durationMinutes: true, priceKes: true } },
        },
      },
    },
  });

  if (!payment || !payment.booking?.customer) {
    log.warn(
      { event: "payment_callback.job.no_customer", checkoutRequestId, paymentFound: !!payment },
      "Payment or booking customer not found — skipping WhatsApp notification",
    );
    return;
  }

  const customerPhone = payment.booking.customer.phone;
  const customerName = payment.booking.customer.name;
  const booking = payment.booking;
  const serviceName = booking.service.name;

  if (resultCode === 0) {
    // ─── Payment succeeded ─────────────────────────────────
    log.info(
      { event: "payment_callback.success", checkoutRequestId, phone: customerPhone },
      "Payment succeeded, sending WhatsApp confirmation",
    );

    const dateDisplay = formatDateEAT(booking.appointmentAt.toISOString());
    const timeDisplay = formatTime12h(booking.appointmentAt.toISOString());

    const confirmationText = [
      "Payment received! ✅",
      "",
      `📋 Booking: ${booking.reference}`,
      `✂️ Service: ${serviceName}`,
      `📅 ${dateDisplay}`,
      `⏰ ${timeDisplay}`,
      "📍 Wanny's Nails, Nairobi",
      "",
      "We'll send you a reminder 24 hours before. See you then! 💅",
    ].join("\n");

    await sendWhatsAppText(customerPhone, confirmationText);

    // Clear the customer's WhatsApp session
    await deleteSession(customerPhone);

    log.info(
      { event: "payment_callback.success.notified", checkoutRequestId, phone: customerPhone },
      "Customer notified of successful payment",
    );
  } else {
    // ─── Payment failed ───────────────────────────────────
    log.info(
      { event: "payment_callback.failed", checkoutRequestId, resultCode, phone: customerPhone },
      "Payment failed, notifying customer",
    );

    await sendWhatsAppText(customerPhone, "The payment wasn't completed.");

    await sendWhatsAppInteractiveButtons(
      customerPhone,
      "What would you like to do?",
      [
        { id: "1", title: "Try Again" },
        { id: "2", title: "Cancel Booking" },
      ],
    );

    // Update session to stay in AWAITING_PAYMENT
    const session = await loadSession(customerPhone);
    if (session) {
      session.state = "AWAITING_PAYMENT";
      await saveSession(customerPhone, session);
    }

    log.info(
      { event: "payment_callback.failed.notified", checkoutRequestId, phone: customerPhone },
      "Customer notified of payment failure",
    );
  }
}