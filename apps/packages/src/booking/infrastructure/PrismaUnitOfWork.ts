// Accept any PrismaClient-like object to be compatible with extended clients
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = any;
import type { UnitOfWork } from "../ports/UnitOfWork.js";

/**
 * Prisma-based Unit of Work that wraps operations in a transaction.
 * Uses Serializable isolation to prevent concurrent booking conflicts.
 */
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClientLike) {}

  async execute<T>(fn: (ctx: unknown) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.prisma.$transaction(
      async (tx: any) => {
        return fn(tx);
      },
      { isolationLevel: "Serializable" },
    );
  }
}
