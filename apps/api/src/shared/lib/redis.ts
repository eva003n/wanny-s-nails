/**
 * Adapter re-export — delegates to @wannys-nails/packages.
 * Export the shared "cache" Redis client so API code can call
 * `redis.get`, `redis.setex`, `redis.exists`, `redis.ping`, etc.
 */
import { redis as packagesRedis } from "@wannys-nails/packages";
export const redis = packagesRedis.cache;
