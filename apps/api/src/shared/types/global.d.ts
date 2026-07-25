import type { PrismaClient } from "@wannys-nails/packages";

declare global {
    var prisma: PrismaClient | undefined
}