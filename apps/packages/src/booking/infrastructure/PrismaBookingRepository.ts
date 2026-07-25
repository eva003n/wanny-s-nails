import type { PrismaClient } from "../../generated/prisma/internal/class.js";
import type { BookingRepository, CreateBookingRecord } from "../ports/BookingRepository.js";
import type { BookingCandidate, ServiceData } from "../types.js";

/**
 * Flexible Prisma client type that works with both standard and extended clients.
 * This accepts any object with the required booking methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaClientLike = any;

export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findCandidates(
    lowerBound: Date,
    upperBound: Date,
    options?: { excludeId?: string },
  ): Promise<BookingCandidate[]> {
    const where: Record<string, unknown> = {
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      appointmentAt: { lt: upperBound, gte: lowerBound },
    };

    if (options?.excludeId) {
      where.id = { not: options.excludeId };
    }

    const rows = await this.prisma.booking.findMany({
      where,
      select: { appointmentAt: true, durationMinutes: true },
    });

    return rows.map((r: { appointmentAt: Date; durationMinutes: number }) => ({
      appointmentAt: r.appointmentAt,
      durationMinutes: r.durationMinutes,
    }));
  }

  async getById(id: string): Promise<{ id: string; reference: string; customerId: string; appointmentAt: Date; durationMinutes: number; priceKes: number; status: string; paymentStatus: string; notes: string | null; services: ServiceData[]; createdAt: Date; }> {
    return await this.prisma.findUnique({
      where: {id}
    })
  }
  
  async save(
    data: CreateBookingRecord,
    ctx?: unknown,
  ): Promise<{
    id: string;
    reference: string;
    customerId: string;
    appointmentAt: Date;
    durationMinutes: number;
    priceKes: number;
    status: string;
    paymentStatus: string;
    notes: string | null;
    services: ServiceData[];
    createdAt: Date;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = (ctx as any) ?? this.prisma;

     const services = data.services.filter((s): s is ServiceData => s !== null);

     const booking = await tx.booking.create({
      data: {
        reference: data.reference,
        customerId: data.customerId,
        appointmentAt: data.appointmentAt,
        durationMinutes: data.durationMinutes,
        priceKes: data.priceKes,
        notes: data.notes,
        services: {
          create: services.map((svc, idx) => ({
            service:  {
              connect: {
                id: svc.id
              }
            },
            serviceName: svc.name,
            price: svc.priceKes,
            durationMin: svc.durationMinutes,
            position: idx,
          })),
        },
        payment: {
          create: { amountKes: data.priceKes },
        },
        statusHistory: {
          create: { toStatus: "PENDING", actorType: data.actorType },
        },
      },
    });


    return {
      id: booking.id,
      reference: booking.reference,
      customerId: booking.customerId,
      appointmentAt: booking.appointmentAt,
      durationMinutes: booking.durationMinutes,
      priceKes: booking.priceKes,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      notes: booking.notes,
      services,
      createdAt: booking.createdAt,
    };
  }
}