import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";





// factory faction to generate prisma client
export const  createPrismaClient = (url: string | undefined, env: string = "development") => {
  if(!url) {
    throw new Error("DATABASE_URL is required")
  }

  const isProduction = env === "production";
  let options;


  if(!isProduction) {
    options = { connectionString: url}

  }else {
    options = { connectionString: url, ssl: { rejectUnauthorized: false } };

  }
  const adapter = new PrismaPg(options);

  const prisma = globalThis.prisma ?? new PrismaClient({
    adapter,
    log: env === "development" ? ["query", "error", "warn"] : ["error"], // determine what prisma logs based on env
  });



  if (!isProduction) {
    globalThis.prisma = prisma;
  }
  // Global soft-delete middleware
  const softDeleteModels = ["Booking", "Customer", "NailService", "User"];

  return prisma.$extends({
  query: {
    $allModels: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findMany({ model, args, query }: { model: string; args: any; query: any }) {
        if (model && softDeleteModels.includes(model)) {
          args.where = {
            ...args.where ?? {},
            deletedAt: null,
          };
        }

        return query(args);
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findFirst({ model, args, query }: { model: string; args: any; query: any }) {
        if (model && softDeleteModels.includes(model) && args.where) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
        }

        return query(args);
      },
    },
  },
}) 
}

export type { PrismaClient, Prisma
 } from "../generated/prisma/client.js";
export  {PrismaClientKnownRequestError} from "../generated/prisma/internal/prismaNamespace.js"
export type {
  Booking as BookingModel,
  Customer as CustomerModel,
  NailService as NailServiceModel,
  BookingService,
  Payment as PaymentModel,
  BusinessHours as BusinessHoursModel,
  User as UserModel,
} from "../generated/prisma/client.js";
