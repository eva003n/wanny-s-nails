import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { bookingsService } from "./bookings.service.js";
import { notificationQueue, logger } from "@wannys-nails/packages";
import {
  success,
  created,
  noContent,
  paginated,
} from "../../shared/utils/response.js";
import { parsePagination } from "../../shared/utils/pagination.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

const log = logger.child({ module: "bookings.controller" });

// --- Validation schemas (exported for use in routes) ---

export const createBookingSchema = z.object({
  customerId: z.uuid(),
  serviceId: z.uuid(),
  appointmentAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export const cancelSchema = z.object({
  reason: z.string().max(255).optional(),
});

export const rescheduleSchema = z.object({
  appointmentAt: z.string().datetime(),
  reason: z.string().max(255).optional(),
});

export const markPaidSchema = z.object({
  method: z.enum(["CASH"]),
  notes: z.string().max(500).optional(),
});

export const patchNotesSchema = z.object({
  notes: z.string().max(500).nullable().optional(),
});

// --- Handlers ---

export const listBookings = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { page, limit, sort } = parsePagination(
    req.query as Record<string, unknown>,
    { sort: "appointmentAt:asc" },
  );

  const result = await bookingsService.list({
    page,
    limit,
    status: req.query.status as string | undefined,
    paymentStatus: req.query.paymentStatus as string | undefined,
    customerId: req.query.customerId as string | undefined,
    serviceId: req.query.serviceId as string | undefined,
    date: req.query.date as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    sort,
  });

  paginated(res, result.bookings, result.total, result.page, result.limit);
});

export const getBookingById = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const booking = await bookingsService.getById(req.params.id as string);
  success(res, booking);
});

export const createBooking = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof createBookingSchema>;
  const booking = await bookingsService.create(input);
  created(res, booking);
});

export const approveBooking = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const booking = await bookingsService.approve(
    req.params.id as string,
    req.user!.userId,
  );

  // ── Enqueue WhatsApp confirmation to customer (async) ─────────
  try {
    const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const eatDate = new Date(booking.appointmentAt.getTime() + EAT_OFFSET_MS);
    const dateDisplay = eatDate.toLocaleDateString("en-KE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const hours = eatDate.getUTCHours();
    const minutes = eatDate.getUTCMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    const timeDisplay = `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;

    const confirmationText = [
      "Your booking has been approved! ✅",
      "",
      `📋 Booking: ${booking.reference}`,
      `✂️ Service: ${booking.service.name}`,
      `📅 ${dateDisplay}`,
      `⏰ ${timeDisplay}`,
      "📍 Wanny's Nails, Nairobi",
      "",
      "Please complete payment when prompted. Thank you! 💅",
    ].join("\n");

    await notificationQueue.add(
      "whatsapp-booking-approved",
      {
        type: "text",
        to: booking.customer.phone,
        text: confirmationText,
      },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    log.error(
      { event: "booking.approve.notify_failed", bookingId: booking.id, error: err.message },
      "Failed to enqueue WhatsApp notification for approved booking",
    );
    // Don't fail the response — the booking was approved successfully
  }

  success(res, booking);
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof cancelSchema>;
  const booking = await bookingsService.cancel(
    req.params.id as string,
    req.user ? "USER" : "CUSTOMER",
    input.reason,
  );
  success(res, booking);
});

export const rescheduleBooking = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof rescheduleSchema>;
  const booking = await bookingsService.reschedule(
    req.params.id as string,
    input.appointmentAt,
    input.reason,
  );
  success(res, booking);
});

export const updateBookingNotes = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof patchNotesSchema>;
  const booking = await bookingsService.updateNotes(
    req.params.id as string,
    input.notes ?? null,
  );
  success(res, booking);
});

export const markBookingPaid = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof markPaidSchema>;
  const booking = await bookingsService.markPaid(
    req.params.id as string,
    input.method,
    input.notes,
  );
  success(res, booking);
});

export const getTodayBookings = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const bookings = await bookingsService.getTodayBookings();
  success(res, bookings);
});

export const softDeleteBooking = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  await bookingsService.softDelete(req.params.id as string);
  noContent(res);
});