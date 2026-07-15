// Accept any PrismaClient-like object to be compatible with extended clients
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = any;
import type { BusinessHoursRepository } from "../ports/BusinessHoursRepository.js";
import type { BusinessHoursData } from "../types.js";

export class PrismaBusinessHoursRepository implements BusinessHoursRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findByDayOfWeek(dayOfWeek: number): Promise<BusinessHoursData | null> {
    const hours = await this.prisma.businessHours.findUnique({
      where: { dayOfWeek },
    });
    if (!hours) return null;
    return {
      id: hours.id,
      dayOfWeek: hours.dayOfWeek,
      openTime: hours.openTime,
      closeTime: hours.closeTime,
      isActive: hours.isActive,
    };
  }
}