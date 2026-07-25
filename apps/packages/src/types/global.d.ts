import type { PrismaClient } from "../generated/prisma/client.ts";
import type {Redis} from "ioredis";

declare global {
    var prisma: PrismaClient | undefined
    var redis: Redis | undefined
}