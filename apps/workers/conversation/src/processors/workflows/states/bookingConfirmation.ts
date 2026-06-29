import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount } from "../session.js";
import { formatDateEAT, formatTime12h } from "../helpers.js";
import { log as logger, paymentQueue,  } from "../../../lib/index.js";

import { prisma } from "../../../lib/prisma.js";

const log = logger.child({ module: "fsm-booking-confirm" });

/**
 * Build the booking confirmation summary and interactive button prompt.
 */
function buildConfirmationMessage(
  serviceName: string,
  price: number,
  dateDisplay: string,
  timeDisplay: string,
): StateTransitionResult["messages"] {
  const summaryText = [
    "Please confirm your booking:",
    "",
    `✂️ Service: ${serviceName}`,
    `📅 Date: ${dateDisplay}`,
    `⏰ Time: ${timeDisplay}`,
    `💰 Price: KES ${price.toLocaleString()}`,
  ].join("\n");

  return [
    { type: "text" as const, text: summaryText },
    {
      type: "interactive_button" as const,
      text: "Does everything look good?",
      buttonTitle: "Confirm booking",
      buttons: [
        { id: "yes", title: "Yes, Confirm" },
        { id: "no", title: "No, Start Over" },
      ],
    },
  ];
}

/**
 * BOOKING_CONFIRMATION
 *
 * Shows a summary of the booking and asks for YES/NO confirmation
 * via interactive buttons.
 *
 * Transitions:
 *  "yes" / "YES" / "y" / "1" → Create PENDING booking → AWAITING_PAYMENT_PHONE
 *  "no"  / "NO"  / "n" / "2" → Clear session, restart → GREETING
 */
export async function handleBookingConfirmation(
  ctx: StateHandlerContext,
): Promise<StateTransitionResult> {
  const input = ctx.message.trim().toLowerCase();

  // --- Confirm booking ---
  if (input === "yes" || input === "y" || input === "1") {
    const customerId = ctx.session.customerId;
    const serviceId = ctx.session.selectedService?.id;
    const appointmentAt = ctx.session.appointmentAt;

    if (!customerId || !serviceId || !appointmentAt) {
      log.error(
        { event: "fsm.booking.missing_data", phone: ctx.phone },
        "Missing session data for booking confirmation",
      );
      return {
        messages: [
          {
            type: "text",
            text: "Sorry, something went wrong. Let's start over.",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }

    try {
      // Recreate bookingsService.create logic inline
      const service = await prisma.nailService.findUnique({
        where: { id: serviceId },
      });
      if (!service || service.deletedAt || !service.isActive) {
        throw new Error("ServiceInactive");
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer) {
        throw new Error("CustomerNotFound");
      }

      const start = new Date(appointmentAt);
      const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

      // Slot alignment check
      const SLOT_GRANULARITY_MINUTES = 15;
      const totalMinutes = start.getHours() * 60 + start.getMinutes();
      if (totalMinutes % SLOT_GRANULARITY_MINUTES !== 0) {
        throw new Error("SlotAlignment");
      }

      // Check business hours
      const dayOfWeek = start.getDay();
      const businessHours = await prisma.businessHours.findUnique({
        where: { dayOfWeek },
      });
      if (!businessHours || !businessHours.isActive) {
        throw new Error("OutsideBusinessHours");
      }

      const [openHour, openMinute = 0] = businessHours.openTime.split(":").map(Number);
      const [closeHour, closeMinute = 0] = businessHours.closeTime.split(":").map(Number);

      const dayOpen = new Date(start);
      dayOpen.setHours(openHour as number, openMinute, 0, 0);
      const dayClose = new Date(start);
      dayClose.setHours(closeHour as number, closeMinute, 0, 0);

      if (start < dayOpen || end > dayClose) {
        throw new Error("OutsideBusinessHours");
      }

      const booking = await prisma.$transaction(
        async (tx) => {
          const MAX_SERVICE_MINUTES = 240;
          const lowerBound = new Date(start.getTime() - MAX_SERVICE_MINUTES * 60 * 1000);

          const candidates = await tx.booking.findMany({
            where: {
              status: { notIn: ["CANCELLED", "NO_SHOW"] },
              appointmentAt: { lt: end, gte: lowerBound },
            },
            select: { appointmentAt: true, durationMinutes: true },
          });

          const hasConflict = candidates.some((b) => {
            const bStart = b.appointmentAt;
            const bEnd = new Date(bStart.getTime() + b.durationMinutes * 60 * 1000);
            return bStart < end && bEnd > start;
          });

          if (hasConflict) {
            throw new Error("BookingConflict");
          }

          function generateReference(): string {
            const year = new Date().getFullYear();
            const seq = Math.floor(Math.random() * 99999).toString().padStart(5, "0");
            return `WN-${year}-${seq}`;
          }

          return tx.booking.create({
            data: {
              reference: generateReference(),
              customerId,
              serviceId,
              appointmentAt: start,
              durationMinutes: service.durationMinutes,
              priceKes: service.priceKes,
              notes: null,
              payment: {
                create: { amountKes: service.priceKes },
              },
              statusHistory: {
                create: { toStatus: "PENDING", actorType: "CUSTOMER" },
              },
            },
            include: {
              customer: { select: { id: true, name: true, phone: true } },
              service: { select: { id: true, name: true } },
              payment: true,
            },
          });
        },
        { isolationLevel: "Serializable" },
      );

      const serviceName = ctx.session.selectedService?.name || "Nail service";
      const price = ctx.session.selectedService?.priceKes || 0;
      const dateDisplay = formatDateEAT(appointmentAt);
      const timeDisplay = ctx.session.selectedTime
        ? formatTime12h(ctx.session.selectedTime)
        : "";

      const confirmationText = [
        "Your booking has been received! 🎉",
        "",
        `📋 Reference: ${booking.reference}`,
        `✂️ Service: ${serviceName}`,
        `📅 ${dateDisplay}`,
        `⏰ ${timeDisplay}`,
        `💰 KES ${price.toLocaleString()}`,
        "",
        `To secure your slot, please pay KES ${price.toLocaleString()} via M-Pesa.`,
        "What M-Pesa number should we send the payment request to?",
        "(e.g., 0712 345 678)",
      ].join("\n");

      return {
        messages: [{ type: "text", text: confirmationText }],
        sessionUpdates: {
          ...resetInvalidCount(ctx.session),
          bookingId: booking.id,
          bookingRef: booking.reference,
        },
        nextState: "AWAITING_PAYMENT_PHONE",
      };
    } catch (error) {
      log.error(
        { event: "fsm.booking.create_failed", error, phone: ctx.phone },
        "Failed to create booking",
      );

      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      let userMessage =
        "Sorry, we couldn't create your booking. The time slot may have been taken.";

      if (errorMsg.includes("Slot") || errorMsg.includes("Conflict")) {
        userMessage =
          "Sorry, that time slot was just taken. Please select a different time.";
      }

      return {
        messages: [{ type: "text", text: userMessage }],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "GREETING",
      };
    }
  }

  // --- Decline booking ---
  if (input === "no" || input === "n" || input === "2") {
    return {
      messages: [{ type: "text", text: "OK, let's start over. 😊" }],
      sessionUpdates: {
        ...resetInvalidCount(ctx.session),
        selectedService: undefined,
        selectedDate: undefined,
        selectedTime: undefined,
        appointmentAt: undefined,
      },
      nextState: "GREETING",
    };
  }

  // --- Invalid input — resend the confirmation with buttons ---
  const serviceName = ctx.session.selectedService?.name || "Nail service";
  const price = ctx.session.selectedService?.priceKes || 0;
  const dateDisplay = ctx.session.appointmentAt
    ? formatDateEAT(ctx.session.appointmentAt)
    : "";
  const timeDisplay = ctx.session.selectedTime
    ? formatTime12h(ctx.session.selectedTime)
    : "";

  return {
    messages: buildConfirmationMessage(
      serviceName,
      price,
      dateDisplay,
      timeDisplay,
    ),
    sessionUpdates: ctx.session,
    nextState: "BOOKING_CONFIRMATION",
  };
}
