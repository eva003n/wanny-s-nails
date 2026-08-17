import { createPrismaClient } from "@wannys-nails/core";
import { _config } from "./config.js";
import { log } from "./logger.js";

export const prisma = createPrismaClient(
  _config.DATABASE_URL,
  _config.NODE_ENV,
);

try {
  await prisma.$connect();
  log.info(
    {
      event: "Postgres.connection.success",
      process: "payment-worker",
    },
    "Connected to the database",
  );
} catch (err: any) {
  log.info(
    {
      event: "Postgres.connection.success",
      process: "payment-worker",
      error: err,
    },
    "Failed to connect",
    err.message,
  );
}

export type {Prisma} from "@wannys-nails/core"