import { createPrismaClient } from "@wannys-nails/packages";
import { _config } from "./config.js";

export const prisma = createPrismaClient(_config.DATABASE_URL, _config.NODE_ENV)