import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";





// factory faction to generate prisma client
export const  createPrismaClient = (url: string | undefined, env: string = "development") => {
  if(!url) {
    throw new Error("DATABASE_URL is required")
  }
  const adapter = new PrismaPg(url);

  const prisma = globalThis.prisma ?? new PrismaClient({
    adapter,
    log: env === "development" ? ["query", "error", "warn"] : ["error"], // determine what prisma logs based on env
  });


  const isProduction = env === "production";

  if (!isProduction) {
    globalThis.prisma = prisma;
  }
  // Global soft-delete middleware
  const softDeleteModels = ["Booking", "Customer", "NailService", "User"];

  return prisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (model && softDeleteModels.includes(model)) {
          args.where = {
            ...args.where ?? {},
            deletedAt: null,
          };
        }

        return query(args);
      },

      async findFirst({ model, args, query }) {
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

export type * from "../generated/prisma/client.js";

