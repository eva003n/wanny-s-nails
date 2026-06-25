import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

// read from process.env directly — Docker injects these at container start
const { DATABASE_URL, NODE_ENV } = process.env;

//  cache prisma client to avoid mutiple clients being created in development hot reload
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// factory faction to generate prisma client
const  createPrismaClient = (): PrismaClient => {
  const adapter = new PrismaPg(DATABASE_URL as string);
  return new PrismaClient({
    adapter,
    log: NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"], // determine what prisma logs based on env
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Global soft-delete middleware
const softDeleteModels = ["Booking", "Customer", "NailService", "User"];

prisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (model && softDeleteModels.includes(model) && args.where) {
          args.where = {
            ...args.where,
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
});

export type { Prisma } from "../generated/prisma/client.js";
