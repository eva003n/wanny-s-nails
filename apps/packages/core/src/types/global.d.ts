import type { PrismaClient } from "../generated/prisma/client.js";
import type {Redis} from "ioredis";

declare global {
    var prisma: PrismaClient | undefined
    var redis: Redis | undefined
}