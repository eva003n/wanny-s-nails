import { prisma } from "@wannys-nails/packages";
import { reminderQueue } from "@wannys-nails/packages";
import { logger } from "@wannys-nails/packages";
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

    const where: Record<string, unknown> = {};

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

    const sortParts = (sort || "appointmentAt:desc").split(":");
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
          payment: true,
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
        payment: { include: { transactions: true } },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
        notifications: {
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

  // async create(input: CreateBookingInput) {
  //   const service = await prisma.nailService.findUnique({
  //     where: { id: input.serviceId },
  //   });
  //   if (!service || service.deletedAt) {
  //     throw new ServiceInactiveError();
  //   }
  //   if (!service.isActive) {
  //     throw new ServiceInactiveError();
  //   }

  //   // Check customer exists
  //   const customer = await prisma.customer.findUnique({
  //     where: { id: input.customerId },
  //   });
  //   if (!customer) {
  //     throw new BookingNotFoundError(`Customer ${input.customerId}`);
  //   }

  //   const appointmentAt = new Date(input.appointmentAt);

  //   // Validate future date
  //   if (appointmentAt <= new Date()) {
  //     throw new BookingConflictError();
  //   }

  //   // Check business hours
  //   const dayOfWeek = appointmentAt.getDay();
  //   const businessHours = await prisma.businessHours.findUnique({ where: { dayOfWeek } });
  //   if (!businessHours || !businessHours.isActive) {
  //     throw new OutsideBusinessHoursError(input.appointmentAt);
  //   }

  //   // Validate business hours
  //   const openParts = businessHours.openTime.split(":");
  //   const closeParts = businessHours.closeTime.split(":");
  //   const openHour = Number(openParts[0]);
  //   const closeHour = Number(closeParts[0]);
  //   const appointmentHour = appointmentAt.getHours();
  //   if (appointmentHour < openHour || appointmentHour >= closeHour) {
  //     throw new OutsideBusinessHoursError(input.appointmentAt);
  //   }

  //   // Check slot alignment (service-duration boundaries)
  //   const minute = appointmentAt.getMinutes();
  //   const hour = appointmentAt.getHours();
  //   const totalMinutesSinceMidnight = hour * 60 + minute;
  //   if (totalMinutesSinceMidnight % service.durationMinutes !== 0) {
  //     throw new BookingConflictError();
  //   }

  //   // Check for slot conflict
  //   const conflictingBooking = await prisma.booking.findFirst({
  //     where: {
  //       appointmentAt: {
  //         gt: new Date(appointmentAt.getTime() - service.durationMinutes * 60 * 1000).toISOString(),
  //         lt: new Date(appointmentAt.getTime() + service.durationMinutes * 60 * 1000).toISOString(),
  //       },
  //       status: { notIn: ["CANCELLED", "NO_SHOW"] },
  //     },
  //   });

  //   if (conflictingBooking) {
  //     throw new BookingConflictError();
  //   }

  //   return prisma.booking.create({
  //     data: {
  //       reference: generateReference(),
  //       customerId: input.customerId,
  //       serviceId: input.serviceId,
  //       appointmentAt,
  //       durationMinutes: service.durationMinutes,
  //       priceKes: service.priceKes,
  //       notes: input.notes ?? null,
  //       payment: {
  //         create: {
  //           amountKes: service.priceKes,
  //         },
  //       },
  //       statusHistory: {
  //         create: {
  //           toStatus: "PENDING",
  //           actorType: "CUSTOMER",
  //         },
  //       },
  //     },
  //     include: {
  //       customer: { select: { id: true, name: true, phone: true } },
  //       service: { select: { id: true, name: true } },
  //       payment: true,
  //     },
  //   });
  // },

  async create(input: CreateBookingInput) {
    const service = await prisma.nailService.findUnique({
      where: { id: input.serviceId },
    });
    if (!service || service.deletedAt || !service.isActive) {
      throw new ServiceInactiveError();
    }

    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      throw new BookingNotFoundError(`Customer ${input.customerId}`);
    }

    const start = new Date(input.appointmentAt);
    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);
    // if (isNaN(start.getTime())) {
    //   throw new InvalidAppointmentTimeError(input.appointmentAt);
    // }
    // const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

    // // Validate future date
    // if (start <= new Date()) {
    //   throw new InvalidAppointmentTimeError(input.appointmentAt);
    // }

    // Slot alignment check — align to the salon's fixed booking grid
    // (e.g. every 15 minutes), NOT to the service duration. Aligning to
    // duration rejects valid times for any service whose length isn't a
    // divisor of 60 (45-min services could only start on the hour or :45).
    const SLOT_GRANULARITY_MINUTES = 15;
    const totalMinutes = start.getHours() * 60 + start.getMinutes();
    if (totalMinutes % SLOT_GRANULARITY_MINUTES !== 0) {
      throw new BookingConflictError();
    }

    // Check business hours — compare full start/end timestamps, not just
    // the hour, so e.g. an 18:50 start with a 19:00 close is correctly
    // rejected (the old code only checked appointmentHour < closeHour,
    // which would wrongly allow a service that runs past closing).
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
        // Narrow the conflict scan to a bounded window instead of fetching
        // every non-cancelled booking ever made. We can't filter the exact
        // overlap in SQL because `end` is computed (not stored), but we can
        // let the DB cut the candidate set down to "anything that could
        // possibly overlap this appointment" — i.e. bookings starting
        // before `end` and after some reasonable lower bound (start minus
        // the longest plausible service duration). Replace MAX_SERVICE_MINUTES
        // with the actual max durationMinutes across active services if you
        // want a tighter, schema-driven bound instead of a constant.
        const MAX_SERVICE_MINUTES = 240; // adjust to your longest service
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

        const hasConflict = candidates.some((b) => {
          const bStart = b.appointmentAt;
          const bEnd = new Date(
            bStart.getTime() + b.durationMinutes * 60 * 1000,
          );
          return bStart < end && bEnd > start;
        });

        if (hasConflict) {
          throw new BookingConflictError();
        }

        // NOTE: even inside $transaction, Prisma's default isolation level
        // is READ COMMITTED, which does NOT prevent two concurrent requests
        // from both passing this check and both inserting overlapping rows.
        // For correctness under concurrency you need one of:
        //   (a) run this transaction with isolation: 'Serializable', e.g.
        //       prisma.$transaction(fn, { isolationLevel: 'Serializable' })
        //       and be ready to retry on serialization failures, or
        //   (b) add a DB-level exclusion constraint (Postgres: EXCLUDE USING
        //       gist on a tsrange computed from appointmentAt/duration) so
        //       the database itself rejects overlapping inserts, with this
        //       JS check kept only as a fast, friendly pre-check for UX.
        // Pick (b) for production; (a) alone will retry-loop under load.

        return tx.booking.create({
          data: {
            reference: generateReference(),
            customerId: input.customerId,
            serviceId: input.serviceId,
            appointmentAt: start,
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
            customer: {
              select: { id: true, name: true, phone: true },
            },
            service: {
              select: { id: true, name: true },
            },
            payment: true,
          },
        });
      },
      { isolationLevel: "Serializable" }, // see NOTE above — pair with retry logic or a DB constraint
    );
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
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      // 24h reminder: schedule for 24 hours before appointment (in EAT)
      const reminder24hAt = new Date(appointmentMs - ONE_DAY_MS - Date.now());
      const delay24h = reminder24hAt.getTime() - nowMs;
      // 3. Generate idempotency key
      const eventType = "APPOINTMENT_REMINDER";
      const channel = "WHATAPP"
      const recipientType = "CLIENT"

      const idempotencyKey = `${booking.id}:${eventType}:${channel}:${recipientType}`;

      // 4. Render template
      if (delay24h > 0) {
        const reminder24h = await prisma.notification.create({
          data: {
            bookingId: id,
            recipientId: booking.customerId,
            recipientType: "CLIENT",
            type: "APPOINTMENT_REMINDER",
            channel: "WHATSAPP",
            status: "SCHEDULED",
            payload: {},
            scheduledAt: reminder24hAt,
            idempotencyKey: idempotencyKey
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
          await prisma.notification.update({
            where: { id: reminder24h.id },
            data: { idempotencyKey: job24h.id },
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
        const reminder1h = await prisma.notification.create({
          data: {
            bookingId: id,
            recipientId: booking.customerId,
            recipientType: "CLIENT",
            type: "APPOINTMENT_REMINDER",
            channel: "WHATSAPP",
            payload: {},
            status: "SCHEDULED",
            scheduledAt: reminder1hAt,
            idempotencyKey: idempotencyKey,
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
          await prisma.notification.update({
            where: { id: reminder1h.id },
            data: { idempotencyKey: job1h.id },
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
        {
          event: "reminder.schedule_failed",
          bookingId: id,
          error: err.message,
        },
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

    // Validate future date
    if (newDate <= new Date()) {
      throw new BookingConflictError();
    }

    // Check business hours
    const dayOfWeek = newDate.getDay();
    const businessHours = await prisma.businessHours.findUnique({
      where: { dayOfWeek },
    });
    if (!businessHours || !businessHours.isActive) {
      throw new OutsideBusinessHoursError(newAppointmentAt);
    }

    // Validate business hours
    const openParts = businessHours.openTime.split(":");
    const closeParts = businessHours.closeTime.split(":");
    const openHour = Number(openParts[0]);
    const closeHour = Number(closeParts[0]);
    const appointmentHour = newDate.getHours();
    if (appointmentHour < openHour || appointmentHour >= closeHour) {
      throw new OutsideBusinessHoursError(newAppointmentAt);
    }

    // Check slot availability
    const service = await prisma.nailService.findUnique({
      where: { id: booking.serviceId },
    });
    if (!service) {
      throw new Error("Service not found");
    }
    const serviceDuration = service.durationMinutes;

    // Validate slot alignment (service-duration boundaries)
    const minute = newDate.getMinutes();
    const hour = newDate.getHours();
    const totalMinutesSinceMidnight = hour * 60 + minute;
    if (totalMinutesSinceMidnight % serviceDuration !== 0) {
      throw new BookingConflictError();
    }
    const conflicting = await prisma.booking.findFirst({
      where: {
        id: { not: id },
        appointmentAt: {
          gt: new Date(newDate.getTime() - serviceDuration * 60 * 1000),
          lt: new Date(newDate.getTime() + serviceDuration * 60 * 1000),
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
      orderBy: { appointmentAt: "desc" },
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
