import type { PrismaClient } from "@wannys-nails/core";

declare global {
    var prisma: PrismaClient | undefined
}