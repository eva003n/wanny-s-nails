import { prisma } from "../../shared/lib/index.js";

import {
  CustomerNotFoundError,
  PhoneAlreadyExistsError,
  EmailAlreadyExistsError,
} from "../../shared/types/errors.js";
import {
  parsePagination,
  parseSort,
  parseCsvFilter,
} from "../../shared/utils/pagination.js";

export const customersService = {
  async list(params: {
    page: number;
    limit: number;
    sort: string | undefined;
    search: string | undefined;
  }) {
    const { page, limit, sort, search } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const sortOptions = parseSort(
      sort,
      ["name", "createdAt", "lastBookingAt"],
      "createdAt:desc",
    );

    // Map "lastBookingAt" to orderBy through a raw query or relation sort
    let orderBy: Record<string, unknown>;
    if (sort?.startsWith("lastBookingAt")) {
      orderBy = { createdAt: sortOptions.orderBy.name || "desc" };
    } else {
      orderBy = sortOptions.orderBy;
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total, page, limit };
  },

  async getById(id: string) {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new CustomerNotFoundError(id);
    }

    // Compute stats
    const [
      totalBookings,
      completedBookings,
      cancelledBookings,
      noShowCount,
      totalSpent,
      lastBooking,
    ] = await Promise.all([
      prisma.booking.count({ where: { customerId: id } }),
      prisma.booking.count({ where: { customerId: id, status: "COMPLETED" } }),
      prisma.booking.count({ where: { customerId: id, status: "CANCELLED" } }),
      prisma.booking.count({ where: { customerId: id, status: "NO_SHOW" } }),
      prisma.payment.aggregate({
        where: { booking: { customerId: id }, status: "SUCCESS" },
        _sum: { amountKes: true },
      }),
      prisma.booking.findFirst({
        where: { customerId: id },
        orderBy: { appointmentAt: "desc" },
        select: { appointmentAt: true },
      }),
    ]);

    const totalSpentKes = totalSpent._sum.amountKes ?? 0;
    const averageBookingValueKes =
      totalBookings > 0 ? Math.round(totalSpentKes / totalBookings) : 0;

    return {
      ...customer,
      stats: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        noShowCount,
        totalSpentKes,
        averageBookingValueKes,
        lastBookingAt: lastBooking?.appointmentAt ?? null,
      },
    };
  },

  async getByPhone(phone: string) {
    return prisma.customer.findUnique({ where: { phone } });
  },

  async create(data: {
    name: string;
    phone: string;
    email: string | undefined;
  }) {
    // Check phone uniqueness
    const existingPhone = await prisma.customer.findUnique({
      where: { phone: data.phone },
    });
    const isDeleted = existingPhone?.deletedAt;

    if (isDeleted && existingPhone) {
      throw new PhoneAlreadyExistsError();
    }

    // Check email uniqueness if provided
    if (data.email) {
      const existingEmail = await prisma.customer.findFirst({
        where: { email: data.email },
      });
      if (!isDeleted && existingEmail) {
        throw new EmailAlreadyExistsError();
      }
    }
    // restore deleted customer
    if (isDeleted) {
      return prisma.customer.update({
        where: { phone: data.phone },
        data: {
          deletedAt: null,
        },
      });
    }

    return prisma.customer.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email ?? null,
        consentGiven: true,
        consentAt: new Date(),
      },
    });
  },

  async findOrCreate(phone: string, name: string) {
    const existing = await this.getByPhone(phone);
    if (existing) {
      return existing;
    }
    return prisma.customer.create({
      data: { phone, name, consentGiven: true, consentAt: new Date() },
    });
  },

  async update(
    id: string,
    data: { name?: string | undefined; email?: string | undefined },
  ) {
    await this.getById(id);
    return prisma.customer.update({
      where: { id },
      data: data as Record<string, unknown>,
    });
  },

  async softDelete(id: string) {
    await this.getById(id);
    return prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async getBookings(
    customerId: string,
    params: { page: number; limit: number; status: string | undefined },
  ) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { customerId };
    if (status) {
      const statuses = parseCsvFilter(status);
      if (statuses) {
        where.status = { in: statuses };
      }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { services: true, payment: true, customer: true },
        orderBy: { appointmentAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total, page, limit };
  },

  async getPayments(
    customerId: string,
    params: { page: number; limit: number; status: string | undefined },
  ) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const bookingWhere: Record<string, unknown> = { customerId };
    if (status) {
      const statuses = parseCsvFilter(status);
      if (statuses) {
        bookingWhere.status = { in: statuses };
      }
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { booking: bookingWhere },
        include: {
          booking: {
            include: {
              customer: { select: { name: true } },
              services: { select: { serviceName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: { booking: bookingWhere } }),
    ]);

    return { payments, total, page, limit };
  },
};
