import { logger as log } from "./logger.js";
import { _config } from "./config.js";
import { createPrismaClient, } from "@wannys-nails/packages";

export const prisma = createPrismaClient(_config.DATABASE_URL, _config.NODE_ENV);

try {
  await prisma.$connect();
  log.info(
    {
      event: "Postgres.connection.success",
      process: "api",
    },
    "Connected to the database",
  );
} catch (err: any) {
  log.info(
    {
      event: "Postgres.connection.success",
      process: "api",
      error: err,
    },
    "Failed to connect",
    err.message,
  );
}

export type {Prisma} from "@wannys-nails/packages"
