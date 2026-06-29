import { createPrismaClient} from "@wannys-nails/packages";
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
    },
    "Connected to the database",
  );
} catch (err: any) {
  log.info(
    {
      event: "Postgres.connection.success",
      error: err,
    },
    "Failed to connect",
    err.message,
  );
}

export {type Booking} from "@wannys-nails/packages"