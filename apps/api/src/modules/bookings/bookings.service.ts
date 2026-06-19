import { prisma } from "../../shared/lib/prisma.js";
import { reminderQueue } from "../../shared/lib/queue.js";
import { logger } from "../../shared/lib/logger.js";
import {
  BookingConflictError,
  BookingNotFoundError,
  InvalidStatusTransitionError,
  OutsideBusinessHoursError,
  ServiceInactiveError,
} from "../../shared/types/errors.js";

const log = logger.child({ module: "bookings.service" });

interface CreateBookingInput {
  customerId: string;
  serviceId: string;
  appointmentAt: string;
  notes?: string | undefined;
}

function generateReference(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 99999).toString().padStart(5, "0");
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
    const { page, limit, status, paymentStatus, customerId, serviceId, date, from, to, sort } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
      where.status = { in: statuses };
    }

    if (paymentStatus) {
      const pStatuses = paymentStatus.split(",").map((s) => s.trim()).filter(Boolean);
      where.paymentStatus = { in: pStatuses };
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (serviceId) {
      where.serviceId = serviceId;
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

    const sortParts = (sort || "appointmentAt:asc").split(":");
    const sortField = (sortParts[0] || "appointmentAt") as string;
    const sortDirection = (sortParts[1] || "asc") as string;
    const orderBy: Record<string, "asc" | "desc"> = {};
    orderBy[sortField] = sortDirection === "desc" ? "desc" : "asc";

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          service: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
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
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
        approvedBy: { select: { id: true, name: true } },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
        reminders: {
          orderBy: { scheduledAt: "asc" },
        },
      },
    });
    if (!booking) {
      throw new BookingNotFoundError();
    }
    return booking;
  },

  async getByReference(reference: string) {
    const booking = await prisma.booking.findUnique({
      where: { reference },
      include: {
        customer: true,
        service: true,
        payment: true,
      },
    });
    if (!booking) {
      throw new BookingNotFoundError(reference);
    }
    return booking;
  },

  async create(input: CreateBookingInput) {
    const service = await prisma.nailService.findUnique({
      where: { id: input.serviceId },
    });
    if (!service || service.deletedAt) {
      throw new ServiceInactiveError();
    }
    if (!service.isActive) {
      throw new ServiceInactiveError();
    }

    // Check customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      throw new BookingNotFoundError(`Customer ${input.customerId}`);
    }

    const appointmentAt = new Date(input.appointmentAt);

    // Validate future date
    if (appointmentAt <= new Date()) {
      throw new BookingConflictError();
    }

    // Check business hours
    const dayOfWeek = appointmentAt.getDay();
    const businessHours = await prisma.businessHours.findUnique({ where: { dayOfWeek } });
    if (!businessHours || !businessHours.isActive) {
      throw new OutsideBusinessHoursError(input.appointmentAt);
    }

    // Validate business hours
    const openParts = businessHours.openTime.split(":");
    const closeParts = businessHours.closeTime.split(":");
    const openHour = Number(openParts[0]);
    const closeHour = Number(closeParts[0]);
    const appointmentHour = appointmentAt.getHours();
    if (appointmentHour < openHour || appointmentHour >= closeHour) {
      throw new OutsideBusinessHoursError(input.appointmentAt);
    }

    // Check slot alignment (30-min boundaries)
    const minute = appointmentAt.getMinutes();
    if (minute !== 0 && minute !== 30) {
      throw new BookingConflictError();
    }

    // Check for slot conflict
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        appointmentAt: {
          gte: new Date(appointmentAt.getTime() - 30 * 60 * 1000),
          lt: new Date(appointmentAt.getTime() + service.durationMinutes * 60 * 1000),
        },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
    });

    if (conflictingBooking) {
      throw new BookingConflictError();
    }

    return prisma.booking.create({
      data: {
        reference: generateReference(),
        customerId: input.customerId,
        serviceId: input.serviceId,
        appointmentAt,
        durationMinutes: service.durationMinutes,
        priceKes: service.priceKes,
        notes: input.notes ?? null,
        payment: {
          create: {
            amountKes: service.priceKes,
          },
        },
        statusHistory: {
          create: {
            toStatus: "PENDING",
            actorType: "CUSTOMER",
          },
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        payment: true,
      },
    });
  },

  async approve(id: string, approvedById: string) {
    const booking = await this.getById(id);
    if (booking.status !== "PENDING") {
      throw new InvalidStatusTransitionError(booking.status, "approve");
    }

    const updated = await prisma.booking.update({
      where: { id },
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
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    // ── Schedule reminder jobs ──────────────────────────────────
    try {
      const appointmentMs = booking.appointmentAt.getTime();
      const nowMs = Date.now();
      const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

      // 24h reminder: schedule for 24 hours before appointment (in EAT)
      const reminder24hAt = new Date(appointmentMs - 24 * 60 * 60 * 1000);
      const delay24h = reminder24hAt.getTime() - nowMs;

      if (delay24h > 0) {
        const reminder24h = await prisma.reminder.create({
          data: {
            bookingId: id,
            type: "REMINDER_24H",
            channel: "WHATSAPP",
            status: "SCHEDULED",
            scheduledAt: reminder24hAt,
          },
        });

        const job24h = await reminderQueue.add(
          "reminder-24h",
          {
            reminderId: reminder24h.id,
            bookingId: id,
            customerPhone: updated.customer.phone,
            customerName: updated.customer.name,
            serviceName: updated.service.name,
            appointmentAt: booking.appointmentAt.toISOString(),
          },
          {
            delay: delay24h,
            attempts: 3,
            backoff: { type: "exponential", delay: 60000 },
          },
        );

        if (job24h.id) {
          await prisma.reminder.update({
            where: { id: reminder24h.id },
            data: { jobId: job24h.id },
          });
        }

        log.info(
          { event: "reminder.24h.scheduled", bookingId: id, delay: delay24h },
          "24h reminder scheduled",
        );
      }

      // 1h reminder: schedule for 1 hour before appointment (in EAT)
      const reminder1hAt = new Date(appointmentMs - 1 * 60 * 60 * 1000);
      const delay1h = reminder1hAt.getTime() - nowMs;

      if (delay1h > 0) {
        const reminder1h = await prisma.reminder.create({
          data: {
            bookingId: id,
            type: "REMINDER_1H",
            channel: "WHATSAPP",
            status: "SCHEDULED",
            scheduledAt: reminder1hAt,
          },
        });

        const job1h = await reminderQueue.add(
          "reminder-1h",
          {
            reminderId: reminder1h.id,
            bookingId: id,
            customerPhone: updated.customer.phone,
            customerName: updated.customer.name,
            serviceName: updated.service.name,
            appointmentAt: booking.appointmentAt.toISOString(),
          },
          {
            delay: delay1h,
            attempts: 3,
            backoff: { type: "exponential", delay: 60000 },
          },
        );

        if (job1h.id) {
          await prisma.reminder.update({
            where: { id: reminder1h.id },
            data: { jobId: job1h.id },
          });
        }

        log.info(
          { event: "reminder.1h.scheduled", bookingId: id, delay: delay1h },
          "1h reminder scheduled",
        );
      }
    } catch (error: unknown) {
      // Don't fail the approval if reminder scheduling fails
      const err = error as { message?: string };
      log.error(
        { event: "reminder.schedule_failed", bookingId: id, error: err.message },
        "Failed to schedule reminders — booking was still approved",
      );
    }

    return updated;
  },

  async cancel(id: string, actorType: string, reason?: string) {
    const booking = await this.getById(id);
    if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
      throw new InvalidStatusTransitionError(booking.status, "cancel");
    }

    return prisma.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        statusHistory: {
          create: {
            fromStatus: booking.status,
            toStatus: "CANCELLED",
            actorType,
            ...(reason ? { reason } : {}),
          },
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
  },

  async reschedule(id: string, newAppointmentAt: string, reason?: string) {
    const booking = await this.getById(id);
    if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
      throw new InvalidStatusTransitionError(booking.status, "reschedule");
    }

    const newDate = new Date(newAppointmentAt);

    // Check business hours
    const dayOfWeek = newDate.getDay();
    const businessHours = await prisma.businessHours.findUnique({ where: { dayOfWeek } });
    if (!businessHours || !businessHours.isActive) {
      throw new OutsideBusinessHoursError(newAppointmentAt);
    }

    // Check slot availability
    const service = await prisma.nailService.findUnique({ where: { id: booking.serviceId } });
    const conflicting = await prisma.booking.findFirst({
      where: {
        id: { not: id },
        appointmentAt: {
          gte: new Date(newDate.getTime() - 30 * 60 * 1000),
          lt: new Date(newDate.getTime() + (service?.durationMinutes || 60) * 60 * 1000),
        },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
    });

    if (conflicting) {
      throw new BookingConflictError();
    }

    return prisma.booking.update({
      where: { id },
      data: {
        appointmentAt: newDate,
        status: "RESCHEDULED",
        statusHistory: {
          create: {
            fromStatus: booking.status,
            toStatus: "RESCHEDULED",
            actorType: "USER",
            ...(reason ? { reason } : {}),
          },
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
      },
    });
  },

  async markPaid(id: string, method: string, notes?: string) {
    const booking = await this.getById(id);
    if (booking.status !== "APPROVED") {
      throw new InvalidStatusTransitionError(booking.status, "mark as paid");
    }

    // Create payment record if doesn't exist
    await prisma.payment.upsert({
      where: { bookingId: id },
      update: {
        status: "PAID",
        amountKes: booking.priceKes,
      },
      create: {
        bookingId: id,
        amountKes: booking.priceKes,
        status: "PAID",
      },
    });

    // Update booking payment status
    return prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: "PAID",
        ...(notes ? { notes } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        payment: true,
      },
    });
  },

  async markCompleted(id: string) {
    return prisma.booking.update({
      where: { id },
      data: {
        status: "COMPLETED",
        statusHistory: {
          create: {
            fromStatus: "APPROVED",
            toStatus: "COMPLETED",
            actorType: "SYSTEM",
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
        appointmentAt: { gte: today, lt: tomorrow },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        payment: true,
      },
      orderBy: { appointmentAt: "asc" },
    });
  },

  async updateNotes(id: string, notes: string | null) {
    await this.getById(id);
    return prisma.booking.update({
      where: { id },
      data: { notes },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
      },
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
    if (bookingFull.payment?.status === "PAID") {
      throw new InvalidStatusTransitionError(bookingFull.status, "delete");
    }
    return prisma.booking.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};