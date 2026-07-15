import type { BookingRepository, CreateBookingRecord } from "../ports/BookingRepository.js";
import type { BookingCandidate } from "../types.js";

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

  async save(
    data: CreateBookingRecord,
    ctx?: unknown,
  ): Promise<{
    id: string;
    reference: string;
    customerId: string;
    serviceId: string;
    appointmentAt: Date;
    durationMinutes: number;
    priceKes: number;
    status: string;
    paymentStatus: string;
    notes: string | null;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = (ctx as any) ?? this.prisma;

    const booking = await tx.booking.create({
      data: {
        reference: data.reference,
        customerId: data.customerId,
        serviceId: data.serviceId,
        appointmentAt: data.appointmentAt,
        durationMinutes: data.durationMinutes,
        priceKes: data.priceKes,
        notes: data.notes,
        payment: {
          create: { amountKes: data.priceKes },
        },
        statusHistory: {
          create: { toStatus: "PENDING", actorType: "CUSTOMER" },
        },
      },
    });

    return {
      id: booking.id,
      reference: booking.reference,
      customerId: booking.customerId,
      serviceId: booking.serviceId,
      appointmentAt: booking.appointmentAt,
      durationMinutes: booking.durationMinutes,
      priceKes: booking.priceKes,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      notes: booking.notes,
    };
  }
}
