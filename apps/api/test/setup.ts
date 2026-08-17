// apps/api/src/test/setup.ts
import dotenv from "dotenv";
import { afterAll, afterEach, vi } from "vitest";

// Vitest forces NODE_ENV=test in the process — `override: true` ensures
// .env.test values win (dotenv does not overwrite existing vars by default).
dotenv.config({ path: ".env.test", override: true });

// Fail the test suite loudly on unhandled rejections
// instead of letting them fail silently
process.on("unhandledRejection", (reason) => {
  throw reason;
});

/**
 * Truncate all application tables before a test run.
 *
 * TESTING.md §4.5: never rely on test order to leave the DB in a needed
 * state. Call `resetDb()` in `beforeEach` of integration tests.
 *
 * NOTE: `prisma` is imported lazily via dynamic import so unit-only
 * test files (which never touch the DB) don't pay the connection cost.
 */
export async function resetDb(): Promise<void> {
  const { prisma } = await import("../src/shared/lib/prisma.js");

  // Order matters — child tables first, then parents (FK constraints).
  const tables = [
    "payment_transactions",
    "payments",
    "booking_services",
    "booking_status_history",
    "notifications",
    "notification_subscriptions",
    "push_subscriptions",
    "messages",
    "conversation_sessions",
    "conversations",
    "audit_logs",
    "bookings",
    "customers",
    "nail_services",
    "users",
    "business_hours",
  ];

  // Run each TRUNCATE independently — a single Prisma transaction with 16
  // raw queries exceeds the 5000ms timeout (especially when suites share the
  // same test DB). Each TRUNCATE ... CASCADE is atomic per table, so there's
  // no cross-table consistency requirement here.
  await Promise.all(
    tables.map((table) =>
      prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`),
    ),
  );
}

/**
 * Reset Redis between tests — wipes the dedicated test DB (index 1).
 * Call in `beforeEach` of integration tests that rely on Redis state
 * (auth lockout counters, queues, SSE subscriber).
 *
 * Best-effort: if Redis is down there is nothing to flush, so failures
 * are swallowed to avoid breaking suites that don't need Redis state.
 */
export async function resetRedis(): Promise<void> {
  try {
    const { redis } = await import("../src/shared/lib/redis.js");
    await redis.flushdb();
  } catch {
    // ignore — Redis not available in this environment
  }
}

// Global mock hygiene (TESTING.md §3.4)
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

afterAll(async () => {
  // Best-effort close of the Prisma connection pool so the test process can exit.
  try {
    const { prisma } = await import("../src/shared/lib/prisma.js");
    await prisma.$disconnect();
  } catch {
    // ignore — some files may never have imported prisma
  }

  try {
    const { redis } = await import("../src/shared/lib/redis.js");
    redis.disconnect();
  } catch {
    // ignore
  }
});
