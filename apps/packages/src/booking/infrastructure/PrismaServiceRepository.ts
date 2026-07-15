// Accept any PrismaClient-like object to be compatible with extended clients
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = any;
import type { ServiceRepository } from "../ports/ServiceRepository.js";
import type { ServiceData } from "../types.js";

export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findById(id: string): Promise<ServiceData | null> {
    const service = await this.prisma.nailService.findUnique({
      where: { id },
    });
    if (!service) return null;
    return {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      priceKes: service.priceKes,
      isActive: service.isActive,
      deletedAt: service.deletedAt,
    };
  }
}