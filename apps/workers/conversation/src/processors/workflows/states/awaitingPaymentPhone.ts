import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { parsePhoneToE164 } from "../helpers.js";
import { log as logger } from "../../../lib/index.js";
import { prisma } from "../../../lib/prisma.js";
import { maskKenyanPhone } from "@wannys-nails/packages";

const log = logger.child({ module: "fsm-payment-phone" });

/** Keywords that indicate the customer wants to pay by cash at the salon */
const CASH_KEYWORDS = /^(cash|skip|no|pay at salon|pay later|mpesa|none|n\/a)$/i;

/**
 * AWAITING_PAYMENT_PHONE
 *
 * Collects an M-Pesa phone number from the customer — but makes it optional.
 * Customers who want to pay by cash can reply with "cash", "skip", etc.
 *
 * Transitions:
 *  Valid Kenyan phone → save paymentPhone → THANK_YOU
 *  Cash/skip keywords  → THANK_YOU (no phone saved, pay at salon)
 *  Invalid             → stay here with error prompt
 */
export async function handleAwaitingPaymentPhone(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim();

  // ── Cash / skip flow ──
  if (CASH_KEYWORDS.test(input)) {
    log.info(
      { event: "fsm.payment_phone.cash", phone: maskKenyanPhone(ctx.phone) },
      "Customer opted to pay by cash at salon",
    );

    // // Approve the booking if it's PENDING
    // await approveBookingIfPending(ctx);

    return {
      messages: [],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        paymentPhone: undefined,
      },
      nextState: "THANK_YOU",
    };
  }

  // ── M-Pesa phone number flow ──
  const phone = parsePhoneToE164(input);

  if (!phone) {
    const newSession = incrementInvalidCount(ctx.session);
    return {
      messages: [
        {
          type: "text",
          text: "That doesn't look like a valid number. Please try again (e.g., 0712 XXX XXX)\n\nOr type 'cash' to pay at the salon.",
        },
      ],
      sessionUpdates: newSession,
      nextState: "AWAITING_PAYMENT_PHONE",
    };
  }

  log.info(
    { event: "fsm.payment_phone.collected", phone: ctx.phone },
    "M-Pesa phone number collected",
  );

  // Approve the booking if it's PENDING
  // await approveBookingIfPending(ctx);

  return {
    messages: [],
    sessionUpdates: {
      ...resetInvalidCount(ctx.session),
      paymentPhone: phone,
    },
    nextState: "THANK_YOU",
  };
}

/**
 * If the booking is in PENDING status, approve it.
 * This runs before transitioning to THANK_YOU regardless of payment method.
 */
async function approveBookingIfPending(
  ctx: StateHandlerContext,
): Promise<void> {
  const bookingId = ctx.session.bookingId;
  if (!bookingId) {
    log.warn(
      { event: "fsm.payment_phone.no_booking_id", phone: ctx.phone },
      "No booking ID in session — skipping approval",
    );
    return;
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (booking && booking.status === "PENDING") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "APPROVED",
          statusHistory: {
            create: {
              fromStatus: "PENDING",
              toStatus: "APPROVED",
              actorType: "SYSTEM",
            },
          },
        },
      });
      log.info(
        { event: "fsm.payment_phone.booking_approved", bookingId, phone: ctx.phone },
        "Booking approved after payment phone collection",
      );
    }
  } catch (error) {
    log.error(
      { event: "fsm.payment_phone.approve_failed", error, bookingId, phone: ctx.phone },
      "Failed to approve booking",
    );
  }
}