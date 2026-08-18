import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { bookingsService } from "./bookings.service.js";
import { logger } from "../../../shared/lib/logger.js";
import { prisma } from "../../../shared/lib/prisma.js";
import { dispatch } from "../notifications/notifications.service.js";
import type { NotificationContext } from "../notifications/notification-triggers.js";
import {
  success,
  created,
  noContent,
  paginated,
} from "../../../shared/utils/response.js";
import { parsePagination } from "../../../shared/utils/pagination.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import { relative } from "path/posix";
import { ForbiddenError, UnprocessableError } from "../../../shared/types/errors.js";

const log = logger.child({ module: "bookings.controller" });

// --- Validation schemas (exported for use in routes) ---

export const createBookingSchema = z.object({
  customerId: z.uuid(),
  serviceIds: z.array(z.string().uuid()).min(1), // multi-service
  appointmentAt: z.iso.datetime(),
  notes: z.string().max(500).optional(),
  stylist: z.string().optional(),
});



export const rescheduleSchema = z.object({
  appointmentAt: z.string().datetime(),
});

export const markPaidSchema = z.object({
  method: z.enum(["CASH"]),
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

export const updateBookingSchema = z.object({
  status: z.enum(["APPROVED", "RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW", "PAID"]),
  appointmentAt: z.string().datetime().optional(),
  method: z.enum(["CASH"]).optional(),
});


// --- Helpers ---

/**
 * Build a NotificationContext from a loaded booking with customer and services included.
 */
function buildNotificationContext(booking: {
  id: string;
  customerId: string;
  customer: { name: string; phone: string; email?: string | null };
  services?: Array<{ service: { name: string } }>;
  service?: { name: string }; // fallback for backward compat
  appointmentAt: Date;
  priceKes?: number;
  reference?: string;
}): NotificationContext {
  // Extract service name from the first booking service, or fallback
  const firstService = booking.services?.[0]?.service;
  const serviceName =
    firstService?.name ?? booking.service?.name ?? "Nail Service";
  return {
    bookingId: booking.id,
    customerId: booking.customerId,
    customerName: booking.customer.name,
    customerPhone: booking.customer.phone,
    ...(booking.customer.email
      ? { customerEmail: booking.customer.email }
      : {}),
    serviceName,
    appointmentAt: booking.appointmentAt.toISOString(),
    ...(booking.priceKes != null ? { amountKes: booking.priceKes } : {}),
    adminUserIds: [], // Resolved by the endpoint resolution in dispatch
  } satisfies NotificationContext;
}

// --- Handlers ---

export const listBookings = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const query = req.validated?.query as
      | z.infer<typeof listBookingsQuerySchema>
      | undefined;
    const { page, limit, sort } = parsePagination(
      req.query as Record<string, unknown>,
      { sort: "appointmentAt:asc" },
    );

    const result = await bookingsService.list({
      page,
      limit,
      status: query?.status ?? (req.query.status as string | undefined),
      paymentStatus:
        query?.paymentStatus ?? (req.query.paymentStatus as string | undefined),
      customerId:
        query?.customerId ?? (req.query.customerId as string | undefined),
      serviceId:
        query?.serviceId ?? (req.query.serviceId as string | undefined),
      date: query?.date ?? (req.query.date as string | undefined),
      from: query?.from ?? (req.query.from as string | undefined),
      to: query?.to ?? (req.query.to as string | undefined),
      sort,
    });

    paginated(res, result.bookings, result.total, result.page, result.limit);
  },
);

export const getBookingById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const booking = await bookingsService.getById(params.id);
    success(res, booking);
  },
);

export const createBooking = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const input = req.validated!.body as z.infer<typeof createBookingSchema>;

    const timestamp = Date.parse(input.appointmentAt)

    if( timestamp < Date.now()) {
      throw new UnprocessableError("INVALID_APPOINTMENT_AT", "appointmentAt value must be in the future")
    }
    // Support both single serviceId and serviceIds array
    const serviceIds = input.serviceIds;
    const createInput = {
      customerId: input.customerId,
      serviceIds,
      appointmentAt: input.appointmentAt,
      notes: input.notes,
      stylist: input.stylist,
    };
    const booking = await bookingsService.create(createInput);
    created(res, booking);
  },
);

export const updateBooking = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const body = req.validated?.body as z.infer<typeof updateBookingSchema>;
    const role = req.user.role

    let booking
    if(body.status === "APPROVED") {
      if(role !== "OWNER") {
        throw new ForbiddenError("Only the owner can approve a booking")
      }

      booking =  await approveBooking(req)
    }else if(body.status === "CANCELLED") {
      booking = await cancelBooking(req)

    }else if(body.status === "RESCHEDULED") {
      booking = await rescheduleBooking(req)
    }else if(body.status === "COMPLETED") {
      booking = await markBookingCompleted(req)
    }else if(body.status === "PAID") {
      booking = await markBookingPaid(req)
    }
    
    else {
      booking = await markBookingAsMissed(req)
    }

    success(res, booking);



  }
);

 const approveBooking =  async (req: Request) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const booking = await bookingsService.approve(params.id, req.user?.userId);

    // Dispatch BOOKING_CONFIRMED notification
    try {
      const ctx = buildNotificationContext(booking);
      ctx.adminUserIds = req.user?.userId ? [req.user.userId] : [];
      await dispatch("BOOKING_CONFIRMED", ctx).catch((err) => {
        log.error(
          {
            event: "booking.approve.dispatch_failed",
            bookingId: booking.id,
            error: err instanceof Error ? err.message : String(err),
          },
          "Failed to dispatch booking confirmed notification",
        );
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.error(
        {
          event: "booking.approve.notify_failed",
          bookingId: booking.id,
          error: err.message,
        },
        "Failed to dispatch notification for approved booking",
      );
    }

    return booking
  }


 const cancelBooking = async (req: Request) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const booking = await bookingsService.cancel(
      params.id,
      "OWNER",
    );

    // Dispatch BOOKING_CANCELLED notification
    try {
      const ctx = buildNotificationContext(booking as any);
      ctx.adminUserIds = req.user?.userId ? [req.user.userId] : [];
      await dispatch("BOOKING_CANCELLED", ctx);
    } catch (error) {
      log.error(
        {
          event: "booking.cancel.notify_failed",
          bookingId: booking.id,
          error: String(error),
        },
        "Failed to dispatch cancellation notification",
      );
    }

    return booking
  }


 const rescheduleBooking = 
  async (req: Request) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const input = req.validated!.body as z.infer<typeof updateBookingSchema>;
    const booking = await bookingsService.reschedule(
      params.id,
      input.appointmentAt as string,
      req.user.userId,
    );
    return booking
  }

 const markBookingCompleted = 
  async (req: Request) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const userId = req.user.userId;
    const booking = await bookingsService.markCompleted(params.id, userId);
    return booking;
  }

const markBookingAsMissed = 
  async (req: Request) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const userId = req.user.userId;
    const booking = await bookingsService.markMissed({
      id: params.id,
      userId,
    });
    return booking;
  }



 const markBookingPaid = async (req: Request) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const userId = req.user.userId;

  // const input = req.validated!.body as z.infer<typeof markPaidSchema>;
  const booking = await bookingsService.markPaid(params.id);

  // Dispatch PAYMENT_RECEIVED notification
  try {
    const ctx = buildNotificationContext(booking);
    ctx.adminUserIds = req.user?.userId ? [req.user.userId] : [];
    await dispatch("PAYMENT_RECEIVED", ctx);
  } catch (error) {
    log.error(
      {
        event: "booking.mark_paid.notify_failed",
        bookingId: booking?.id,
        error: String(error),
      },
      "Failed to dispatch payment received notification",
    );
  }

  return booking;
};

export const getTodayBookings = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction) => {
    const bookings = await bookingsService.getTodayBookings();
    success(res, bookings);
  },
);

export const softDeleteBooking = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    await bookingsService.softDelete(params.id);
    noContent(res);
  },
);
