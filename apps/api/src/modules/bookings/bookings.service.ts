import { prisma, notificationQueue } from "../../shared/lib/index.js";

import { logger } from "../../shared/lib/index.js";

import {
  BookingConflictError,
  BookingNotFoundError,
  InvalidStatusTransitionError,
  OutsideBusinessHoursError,
  ServiceInactiveError,
  UnprocessableError,
} from "../../shared/types/errors.js";
import {
  onBookingCancelled,
  onBookingRescheduled,
  schedule,
} from "../notifications/notifications.service.js";
import type { NotificationContext } from "../notifications/notification-triggers.js";
import {
  BookingApplicationService,
  PrismaBookingRepository,
  PrismaServiceRepository,
  PrismaCustomerRepository,
  PrismaBusinessHoursRepository,
  PrismaUnitOfWork,
  PrismaClientKnownRequestError,
} from "@wannys-nails/packages";

const log = logger.child({ module: "bookings.service" });

interface CreateBookingInput {
  customerId: string;
  phoneNumber?: string;
  serviceIds: string[];
  appointmentAt: string;
  notes?: string | undefined;
  stylist: string | undefined;
}

const BOOKING_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  approvedBy: { select: { id: true, name: true } },
  payment: { include: { transactions: true } },
  statusHistory: {
    orderBy: { createdAt: "asc" },
  },
  notifications: {
    orderBy: { scheduledAt: "asc" },
  },
  services: {
    include: {
      service: {
        select: { id: true, name: true, durationMinutes: true, priceKes: true },
      },
    },
    orderBy: { position: "asc" },
  },
} as const;

function generateReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, "0");
  return `WN-${year}-${seq}`;
}

export const bookingsService = {
  async list(filters: {
    page: number;
    limit: number;
    status: string | undefined;
    paymentStatus: string | undefined;
    customerId: string | undefined;
    serviceId: string | undefined;
    date: string | undefined;
    from: string | undefined;
    to: string | undefined;
    sort: string | undefined;
  }) {
    const {
      page,
      limit,
      status,
      paymentStatus,
      customerId,
      serviceId,
      date,
      from,
      to,
      sort,
    } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deletedAt: null };

    if (status) {
      const statuses = status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      where.status = { in: statuses };
    }

    if (paymentStatus) {
      const pStatuses = paymentStatus
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      where.paymentStatus = { in: pStatuses };
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (serviceId) {
      // Filter by serviceId through the booking_services join table
      where.services = {
        some: { serviceId },
      };
    }

    if (date) {
      const dayStart = new Date(date + "T00:00:00.000Z");
      const dayEnd = new Date(date + "T23:59:59.999Z");
      where.appointmentAt = { gte: dayStart, lte: dayEnd };
    }

    if (from || to) {
      const appointmentFilter: Record<string, Date> = {};
      if (from) appointmentFilter.gte = new Date(from);
      if (to) appointmentFilter.lte = new Date(to);
      where.appointmentAt = appointmentFilter;
    }

    const sortParts = (sort || "appointmentAt:desc").split(":");
    const sortField = (sortParts[0] || "appointmentAt") as string;
    const sortDirection = (sortParts[1] || "asc") as string;
    const orderBy: Record<string, "asc" | "desc"> = {};
    orderBy[sortField] = sortDirection === "desc" ? "desc" : "asc";

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total, page, limit };
  },

  async getById(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!booking || booking.deletedAt) {
      throw new BookingNotFoundError();
    }
    return booking;
  },

  async getByReference(reference: string) {
    const booking = await prisma.booking.findUnique({
      where: { reference },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new BookingNotFoundError(reference);
    }
    return booking;
  },

  /*  async create(input: CreateBookingInput) {
    // Validate all services exist and are active
    const services = await prisma.nailService.findMany({
      where: {
        id: { in: input.serviceIds },
        deletedAt: null,
        isActive: true,
      },
    });

    if (services.length !== input.serviceIds.length) {
      throw new ServiceInactiveError();
    }

    // Calculate total duration and price from all services
    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalPrice = services.reduce((sum, s) => sum + s.priceKes, 0);

    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      throw new BookingNotFoundError(`Customer ${input.customerId}`);
    }

    const start = new Date(input.appointmentAt);
    const end = new Date(start.getTime() + totalDuration * 60 * 1000);

    // Slot alignment check — align to the salon's fixed booking grid
    const SLOT_GRANULARITY_MINUTES = 15;
    const totalMinutes = start.getHours() * 60 + start.getMinutes();
    if (totalMinutes % SLOT_GRANULARITY_MINUTES !== 0) {
      throw new BookingConflictError();
    }

    // Check business hours
    const dayOfWeek = start.getDay();
    const businessHours = await prisma.businessHours.findUnique({
      where: { dayOfWeek },
    });
    if (!businessHours || !businessHours.isActive) {
      throw new OutsideBusinessHoursError(input.appointmentAt);
    }

    const [openHour, openMinute = 0] = businessHours.openTime
      .split(":")
      .map(Number);
    const [closeHour, closeMinute = 0] = businessHours.closeTime
      .split(":")
      .map(Number);

    const dayOpen = new Date(start);
    dayOpen.setHours(openHour as number, openMinute, 0, 0);
    const dayClose = new Date(start);
    dayClose.setHours(closeHour as number, closeMinute, 0, 0);

    if (start < dayOpen || end > dayClose) {
      throw new OutsideBusinessHoursError(input.appointmentAt);
    }

    return prisma.$transaction(
      async (tx) => {
        const MAX_SERVICE_MINUTES = 240;
        const lowerBound = new Date(
          start.getTime() - MAX_SERVICE_MINUTES * 60 * 1000,
        );

        const candidates = await tx.booking.findMany({
          where: {
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            appointmentAt: { lt: end, gte: lowerBound },
          },
          select: { appointmentAt: true, durationMinutes: true },
        });

        const hasConflict = candidates.some((b: { appointmentAt: Date; durationMinutes: number }) => {
          const bStart = b.appointmentAt;
          const bEnd = new Date(
            bStart.getTime() + b.durationMinutes * 60 * 1000,
          );
          return bStart < end && bEnd > start;
        });

        if (hasConflict) {
          throw new BookingConflictError();
        }

        return tx.booking.create({
          data: {
            reference: generateReference(),
            customerId: input.customerId,
            appointmentAt: start,
            durationMinutes: totalDuration,
            priceKes: totalPrice,
            notes: input.notes ?? null,
            services: {
              create: services.map((svc, idx) => ({
                serviceId: svc.id,
                serviceName: svc.name,
                price: svc.priceKes,
                durationMin: svc.durationMinutes,
                position: idx,
                stylist: input.stylist,
              })),
            },
            payment: {
              create: {
                amountKes: totalPrice,
              },
            },
            statusHistory: {
              create: {
                toStatus: "PENDING",
                actorType: "CUSTOMER",
              },
            },
          },
          include: BOOKING_INCLUDE,
        });
      },
      { isolationLevel: "Serializable" },
    );
  }, */

  async create(input: CreateBookingInput) {
    const bookingServiceApplication = new BookingApplicationService({
      unitOfWork: new PrismaUnitOfWork(prisma),
      bookingRepository: new PrismaBookingRepository(prisma),
      serviceRepository: new PrismaServiceRepository(prisma),
      customerRepository: new PrismaCustomerRepository(prisma),
      businessHoursRepository: new PrismaBusinessHoursRepository(prisma),
    });

    return bookingServiceApplication.create({
      customerId: input.customerId,
      serviceIds: input.serviceIds,
      appointmentAt: input.appointmentAt,
      actorType: "USER",
      notes: input.notes ?? null,
      stylist: input.stylist,
    });
  },

  async approve(id: string, approvedById: string) {
    const booking = await this.getById(id);
    if (booking.status !== "PENDING") {
      throw new InvalidStatusTransitionError(booking.status, "approve");
    }

    let updated;
    try {
      updated = await prisma.booking.update({
        where: { id, status: "PENDING" },
        data: {
          status: "APPROVED",
          approvedById,
          statusHistory: {
            create: {
              fromStatus: "PENDING",
              toStatus: "APPROVED",
              actorType: "USER",
              actorId: approvedById,
            },
          },
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true, email: true },
          },
          services: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  durationMinutes: true,
                  priceKes: true,
                },
              },
            },
            orderBy: { position: "asc" },
          },
          approvedBy: { select: { id: true, name: true } },
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        const current = await this.getById(id);
        throw new InvalidStatusTransitionError(current.status, "approve");
      }
      throw error;
    }

    // side effects (notifications)
    const eventType = "APPOINTMENT_REMINDER";
    const channel = "WHATSAPP";
    const recipientType = "CLIENT";
    const twentyFourHoursBefore = new Date(
      updated.appointmentAt.getTime() - 24 * 60 * 60 * 1000,
    );
    const templateName = "reminder_24h";

    const serviceName = updated.services[0]?.service?.name ?? "Nail Service";

    if (!updated.customer.phone) {
      log.error(
        {
          event: "reminder.schedule_skipped",
          bookingId: id,
          reason: "missing_phone",
        },
        "Skipped reminder scheduling — customer has no phone on file",
      );
    } else {
      try {
        const context: NotificationContext = {
          bookingId: updated.id,
          customerId: updated.customerId,
          customerName: updated.customer.name,
          customerPhone: updated.customer.phone,
          customerEmail: updated.customer.email ?? "",
          serviceName,
          appointmentAt: twentyFourHoursBefore.toISOString(),
          amountKes: updated.priceKes,
        };

        await schedule({
          bookingId: updated.id,
          eventType,
          recipientType,
          channel,
          scheduledAt: twentyFourHoursBefore,
          template: templateName,
          context,
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        log.error(
          {
            event: "reminder.schedule_failed",
            bookingId: id,
            error: err.message,
          },
          "Failed to schedule reminders — booking was still approved",
        );
      }
    }

    return updated;
  },

  async cancel(id: string, actorType: string = "USER", reason?: string) {
    const bookingAppService = new BookingApplicationService({
      unitOfWork: new PrismaUnitOfWork(prisma),
      bookingRepository: new PrismaBookingRepository(prisma),
      serviceRepository: new PrismaServiceRepository(prisma),
      customerRepository: new PrismaCustomerRepository(prisma),
      businessHoursRepository: new PrismaBusinessHoursRepository(prisma),
    });

    const result = await bookingAppService.cancel({
      id,
      actorType: actorType as "USER" | "CUSTOMER",
      reason,
    });

    // Notification side effects (stay at API layer)
    try {
      await onBookingCancelled(id);
    } catch (error) {
      log.error(
        {
          event: "booking.cancel.notify_failed",
          bookingId: id,
          error: String(error),
        },
        "Failed to dispatch cancellation notification",
      );
    }

    return this.getById(id);
  },

  async reschedule(
    id: string,
    newAppointmentAt: string,
    rescheduledById: string,
    reason?: string,
  ) {
    const bookingAppService = new BookingApplicationService({
      unitOfWork: new PrismaUnitOfWork(prisma),
      bookingRepository: new PrismaBookingRepository(prisma),
      serviceRepository: new PrismaServiceRepository(prisma),
      customerRepository: new PrismaCustomerRepository(prisma),
      businessHoursRepository: new PrismaBusinessHoursRepository(prisma),
    });

    const result = await bookingAppService.reschedule({
      id,
      newAppointmentAt,
      rescheduledById,
      actorType: "USER",
      ...(reason ? { reason } : {}),
    });

    // Notification side effects (stay at API layer)
    try {
      await onBookingRescheduled(id, new Date(newAppointmentAt));
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.error(
        {
          event: "reschedule.notification_update_failed",
          bookingId: id,
          error: err.message,
        },
        "Booking rescheduled but failed to update reminder notifications",
      );
    }

    return this.getById(id);
  },

  async markPaid(id: string, method: string, notes?: string) {
    const booking = await this.getById(id);
    if (booking.status !== "APPROVED") {
      throw new InvalidStatusTransitionError(booking.status, "mark as paid");
    }

    return await prisma.$transaction(async (tx) => {
      await tx.payment.upsert({
        where: { bookingId: id },
        update: {
          status: "SUCCESS",
          amountKes: booking.priceKes,
          metadata: {
            method: method ?? "CASH",
          },
        },
        create: {
          bookingId: id,
          amountKes: booking.priceKes,
          status: "SUCCESS",
        },
      });

      return tx.booking.update({
        where: { id },
        data: {
          paymentStatus: "SUCCESS",
          ...(notes ? { notes } : {}),
        },
        include: BOOKING_INCLUDE,
      });
    });
  },

  async markMissed(missedData: {
    id: string;
    userId: string;
    notes?: string | undefined;
  }) {
    const { id, userId, notes } = missedData;

    const booking = await this.getById(id);
    
    if (booking.status !== "APPROVED") {
      throw new InvalidStatusTransitionError(booking.status, "mark as NO_SHOW");
    }
    if(booking.appointmentAt > new Date()) {
      throw new UnprocessableError("INVALID_TRANSITION", "Appointment date has not passed yet");
    }

    return await prisma.booking.update({
      where: { id },
      data: {
        status: "NO_SHOW",
        paymentStatus: "EXPIRED",
        ...(notes ? { notes } : {}),
        statusHistory: {
          create: {
            fromStatus: "APPROVED",
            toStatus: "COMPLETED",
            actorType: "USER",
            actorId: userId,
          },
        },
      },
      include: BOOKING_INCLUDE,
    });
  },

  async markCompleted(id: string, userId: string) {
    const booking = await this.getById(id);
    if (booking.status !== "APPROVED") {
      throw new InvalidStatusTransitionError(booking.status, "mark as COMPLETED");
    }

    return prisma.booking.update({
      where: { id },
      data: {
        status: "COMPLETED",
        statusHistory: {
          create: {
            fromStatus: "APPROVED",
            toStatus: "COMPLETED",
            actorType: "USER",
            actorId: userId,
          },
        },
      },
    });
  },

  async getTodayBookings() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return prisma.booking.findMany({
      where: {
        deletedAt: null,
        appointmentAt: { gte: today, lt: tomorrow },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      include: BOOKING_INCLUDE,
      orderBy: { appointmentAt: "desc" },
    });
  },

  async updateNotes(id: string, notes: string | null) {
    await this.getById(id);
    return prisma.booking.update({
      where: { id },
      data: { notes },
      include: BOOKING_INCLUDE,
    });
  },

  async softDelete(id: string) {
    const bookingFull = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!bookingFull) {
      throw new BookingNotFoundError();
    }
    if (
      bookingFull.payment?.status === "SUCCESS" ||
      bookingFull.payment?.status === "REFUNDED"
    ) {
      throw new InvalidStatusTransitionError(bookingFull.status, "delete");
    }
    return prisma.booking.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
