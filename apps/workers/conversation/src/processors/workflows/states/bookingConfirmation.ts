import type { StateHandlerContext, StateTransitionResult } from "../types.js";
import { resetInvalidCount, incrementInvalidCount } from "../session.js";
import { formatDateEAT, formatTime12h } from "../helpers.js";
import { log as logger, paymentQueue,  } from "../../../lib/index.js";

import { prisma } from "../../../lib/prisma.js";
import {
  BookingApplicationService,
  PrismaBookingRepository,
  PrismaServiceRepository,
  PrismaCustomerRepository,
  PrismaBusinessHoursRepository,
  PrismaUnitOfWork,
  ServiceInactiveError,
  CustomerNotFoundError,
  SlotAlignmentError,
  OutsideBusinessHoursError,
  BusinessClosedError,
  BookingConflictError,
} from "@wannys-nails/core";

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
    const serviceId = ctx.session.selectedService?.id;
    const appointmentAt = ctx.session.appointmentAt;

    if (!serviceId || !appointmentAt) {
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

    if (!ctx.session.customerId) {
      // set collection phase
      ctx.session.collectionPhase = "NAME";
      return {
        messages: [
          {
            type: "text",
            text: "To complete your booking, I'll need a few details\nWhat's your full name?",
          },
        ],
        sessionUpdates: resetInvalidCount(ctx.session),
        nextState: "DATA_COLLECTION",
      };
    }

    try {
      const bookingAppService = new BookingApplicationService({
        unitOfWork: new PrismaUnitOfWork(prisma),
        bookingRepository: new PrismaBookingRepository(prisma),
        serviceRepository: new PrismaServiceRepository(prisma),
        customerRepository: new PrismaCustomerRepository(prisma),
        businessHoursRepository: new PrismaBusinessHoursRepository(prisma),
      });

      const booking = await bookingAppService.create({
        customerId: ctx.session.customerId,
        serviceIds: [serviceId],
        appointmentAt,
        actorType: "CUSTOMER",
        notes: null,
      });

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
        "To complete your booking, please tell me:",
        "",
        "If paying via 📱 M-Pesa — What number should we send the payment request to? (e.g., 07XX XXX XXX)",
        "",
        "If paying with 💵 cash — Just reply 'cash' and you can pay at the salon.",
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

      let userMessage =
        "Sorry, we couldn't create your booking. The time slot may have been taken.";

      if (
        error instanceof BookingConflictError ||
        error instanceof SlotAlignmentError
      ) {
        userMessage =
          "Sorry, that time slot was just taken. Please select a different time.";
      } else if (
        error instanceof OutsideBusinessHoursError ||
        error instanceof BusinessClosedError
      ) {
        userMessage =
          "Sorry, that time falls outside our business hours. Please choose another time.";
      } else if (error instanceof ServiceInactiveError) {
        userMessage =
          "Sorry, that service is no longer available. Please choose another service.";
      } else if (error instanceof CustomerNotFoundError) {
        userMessage =
          "Sorry, we couldn't find your customer record. Let's start over.";
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
    sessionUpdates: incrementInvalidCount(ctx.session),
    nextState: "BOOKING_CONFIRMATION",
  };
}