import { prisma } from "../../shared/lib/prisma.js";
import { ServiceNotFoundError, ServiceHasFutureBookingsError } from "../../shared/types/errors.js";

interface CreateServiceInput {
  name: string;
  description?: string | undefined;
  durationMinutes: number;
  priceKes: number;
  sortOrder?: number | undefined;
}

interface UpdateServiceInput {
  name?: string | undefined;
  description?: string | undefined;
  durationMinutes?: number | undefined;
  priceKes?: number | undefined;
  isActive?: boolean | undefined;
  sortOrder?: number | undefined;
}

export const servicesService = {
  async list(includeInactive = false) {
    const where: Record<string, unknown> = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    return prisma.salonService.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });
  },

  async getById(id: string) {
    const service = await prisma.salonService.findUnique({
      where: { id },
    });
    if (!service) {
      throw new ServiceNotFoundError();
    }
    return service;
  },

  async create(data: CreateServiceInput) {
    return prisma.salonService.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        durationMinutes: data.durationMinutes,
        priceKes: data.priceKes,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  },

  async update(id: string, data: UpdateServiceInput) {
    await this.getById(id);
    return prisma.salonService.update({
      where: { id },
      data: data as Record<string, unknown>,
    });
  },

  async softDelete(id: string) {
    const service = await this.getById(id);

    // Check for future confirmed bookings
    const futureBookings = await prisma.booking.count({
      where: {
        serviceId: id,
        appointmentAt: { gte: new Date() },
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (futureBookings > 0) {
      throw new ServiceHasFutureBookingsError();
    }

    return prisma.salonService.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};