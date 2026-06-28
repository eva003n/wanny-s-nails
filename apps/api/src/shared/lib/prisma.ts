import { _config } from "./config.js";
import { createPrismaClient, type Prisma } from "@wannys-nails/packages";

export const prisma = createPrismaClient(_config.DATABASE_URL, _config.NODE_ENV);
export type {Prisma}