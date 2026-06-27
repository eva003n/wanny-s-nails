import { createPrismaClient } from "@wannys-nails/packages";
import { config } from "./config.js";


export const prisma = createPrismaClient(config.DATABASE_URL, config.NODE_ENV)