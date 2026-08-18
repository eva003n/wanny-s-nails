import {prisma} from "../../../shared/lib/index.js"

import {
  ServiceNotFoundError,
  ServiceHasFutureBookingsError,
} from "../../../shared/types/errors.js";

interface CreateServiceInput {
  name: string;
  description?: string | undefined;
  category: "MANICURE" | "PEDICURE" | "ENHANCEMENTS" | "NAIL_ART" | "EXTENSIONS" | "REMOVAL" | "REPAIR" | "TREATMENT";
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
    return prisma.nailService.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });
  },

  async listByCategory(category: string, includeInactive = false) {
    const where: Record<string, unknown> = { category };
    if (!includeInactive) {
      where.isActive = true;
    }
    return prisma.nailService.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });
  },

  async listCategories() {
    const categories = await prisma.nailService.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return categories.map((c: any) => c.category);
  },

  async getById(id: string) {
    const service = await prisma.nailService.findUnique({
      where: { id },
    });
    if (!service) {
      throw new ServiceNotFoundError();
    }
    return service;
  },

  async create(data: CreateServiceInput) {
    return prisma.nailService.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        category: data.category as any,
        durationMinutes: data.durationMinutes,
        priceKes: data.priceKes,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  },

  async update(id: string, data: UpdateServiceInput) {
    await this.getById(id);
    return prisma.nailService.update({
      where: { id },
      data: data as Record<string, unknown>,
    });
  },

  async softDelete(id: string) {
    const service = await this.getById(id);

    // Check for future confirmed bookings
    const futureBookings = await prisma.booking.count({
      where: {
        services: {
          some: {
            serviceId: id,
          },
        },
        appointmentAt: { gte: new Date() },
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (futureBookings > 0) {
      throw new ServiceHasFutureBookingsError();
    }

    return prisma.nailService.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
