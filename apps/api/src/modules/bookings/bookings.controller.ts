import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { bookingsService } from "./bookings.service.js";
import { logger, } from "@wannys-nails/packages";
import {prisma} from "../../shared/lib/prisma.js"
import { dispatch } from "../notifications/notifications.service.js";
import type { NotificationContext } from "../notifications/notification-triggers.js";
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

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  customerId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  date: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.string().optional(),
});

// --- Helpers ---

/**
 * Build a NotificationContext from a loaded booking with customer and service included.
 */
function buildNotificationContext(booking: {
  id: string;
  customerId: string;
  customer: { name: string; phone: string; email?: string | null };
  service: { name: string };
  appointmentAt: Date;
  priceKes?: number;
  reference?: string;
}): NotificationContext {
  return {
    bookingId: booking.id,
    customerId: booking.customerId,
    customerName: booking.customer.name,
    customerPhone: booking.customer.phone,
    ...(booking.customer.email ? { customerEmail: booking.customer.email } : {}),
    serviceName: booking.service.name,
    appointmentAt: booking.appointmentAt.toISOString(),
    ...(booking.priceKes != null ? { amountKes: booking.priceKes } : {}),
    adminUserIds: [], // Resolved by the endpoint resolution in dispatch
  } satisfies NotificationContext;
}

// --- Handlers ---

export const listBookings = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const query = req.validated?.query as z.infer<typeof listBookingsQuerySchema> | undefined;
  const { page, limit, sort } = parsePagination(
    req.query as Record<string, unknown>,
    { sort: "appointmentAt:asc" },
  );

  const result = await bookingsService.list({
    page,
    limit,
    status: query?.status ?? (req.query.status as string | undefined),
    paymentStatus: query?.paymentStatus ?? (req.query.paymentStatus as string | undefined),
    customerId: query?.customerId ?? (req.query.customerId as string | undefined),
    serviceId: query?.serviceId ?? (req.query.serviceId as string | undefined),
    date: query?.date ?? (req.query.date as string | undefined),
    from: query?.from ?? (req.query.from as string | undefined),
    to: query?.to ?? (req.query.to as string | undefined),
    sort,
  });

  paginated(res, result.bookings, result.total, result.page, result.limit);
});

export const getBookingById = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
  const booking = await bookingsService.getById(params.id);
  success(res, booking);
});

export const createBooking = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof createBookingSchema>;
  const booking = await bookingsService.create(input);
  created(res, booking);
});

export const approveBooking = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
  const booking = await bookingsService.approve(
    params.id,
    req.user!.userId,
  );

  // Dispatch BOOKING_CONFIRMED notification
  try {
    const ctx = buildNotificationContext(booking);
    ctx.adminUserIds = req.user?.userId ? [req.user.userId] : [];
    await dispatch("BOOKING_CONFIRMED", ctx).catch((err) => {
      log.error(
        { event: "booking.approve.dispatch_failed", bookingId: booking.id, error: err instanceof Error ? err.message : String(err) },
        "Failed to dispatch booking confirmed notification",
      );
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    log.error(
      { event: "booking.approve.notify_failed", bookingId: booking.id, error: err.message },
      "Failed to dispatch notification for approved booking",
    );
  }

  success(res, booking);
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
  const input = req.validated!.body as z.infer<typeof cancelSchema>;
  const booking = await bookingsService.cancel(
    params.id,
    req.user ? "USER" : "CUSTOMER",
    input.reason,
  );

  // Cancel reminder jobs
  try {
    const bookingFull = await bookingsService.getById(params.id);
    if (bookingFull.notifications?.length) {
      const { notificationQueue } = await import("@wannys-nails/packages");
      for (const reminder of bookingFull.notifications) {
        if (reminder.idempotencyKey) {
          await notificationQueue.remove(reminder.idempotencyKey).catch(() => {});
        }
        await prisma.notification.update({
          where: { id: reminder.id },
          data: { status: "CANCELLED" },
        }).catch(() => {});
      }
    }
  } catch (err) {
    log.error(
      { event: "booking.cancel.reminder_cleanup_failed", bookingId: params.id, error: String(err) },
      "Failed to cancel reminder jobs",
    );
  }

  // Dispatch BOOKING_CANCELLED notification
  try {
    const ctx = buildNotificationContext(booking);
    ctx.adminUserIds = req.user?.userId ? [req.user.userId] : [];
    await dispatch("BOOKING_CANCELLED", ctx);
  } catch (error) {
    log.error(
      { event: "booking.cancel.notify_failed", bookingId: booking.id, error: String(error) },
      "Failed to dispatch cancellation notification",
    );
  }

  success(res, booking);
});

export const rescheduleBooking = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
  const input = req.validated!.body as z.infer<typeof rescheduleSchema>;
  const booking = await bookingsService.reschedule(
    params.id,
    input.appointmentAt,
    input.reason,
  );

  // Cancel old reminder jobs
  try {
    const bookingFull = await bookingsService.getById(params.id);
    if (bookingFull.notifications?.length) {
      const { notificationQueue } = await import("@wannys-nails/packages");
      for (const reminder of bookingFull.notifications) {
        if (reminder.idempotencyKey) {
          await notificationQueue.remove(reminder.idempotencyKey).catch(() => {});
        }
        await prisma.notification.update({
          where: { id: reminder.id },
          data: { status: "CANCELLED" },
        }).catch(() => {});
      }
    }
  } catch (err) {
    log.error(
      { event: "booking.reschedule.reminder_cleanup_failed", bookingId: params.id, error: String(err) },
      "Failed to cancel old reminder jobs on reschedule",
    );
  }

  success(res, booking);
});

export const updateBookingNotes = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
  const input = req.validated!.body as z.infer<typeof patchNotesSchema>;
  const booking = await bookingsService.updateNotes(
    params.id,
    input.notes ?? null,
  );
  success(res, booking);
});

export const markBookingPaid = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
  const input = req.validated!.body as z.infer<typeof markPaidSchema>;
  const booking = await bookingsService.markPaid(
    params.id,
    input.method,
    input.notes,
  );

  // Dispatch PAYMENT_RECEIVED notification
  try {
    const ctx = buildNotificationContext(booking);
    ctx.adminUserIds = req.user?.userId ? [req.user.userId] : [];
    await dispatch("PAYMENT_RECEIVED", ctx);
  } catch (error) {
    log.error(
      { event: "booking.mark_paid.notify_failed", bookingId: booking.id, error: String(error) },
      "Failed to dispatch payment received notification",
    );
  }

  success(res, booking);
});

export const getTodayBookings = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const bookings = await bookingsService.getTodayBookings();
  success(res, bookings);
});

export const softDeleteBooking = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
  await bookingsService.softDelete(params.id);
  noContent(res);
});