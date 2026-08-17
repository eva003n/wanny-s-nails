// Integration test helpers (TESTING.md §4.3 / §4.5)
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { resetDb, resetRedis } from "./setup.js";

/** Build a fresh Express app for Supertest — never binds a port. */
export function createTestApp() {
  return createApp();
}

/** Wipe DB + Redis. Call in `beforeEach` of every integration suite. */
export async function clearAll() {
  await resetDb();
  await resetRedis();
}

/** Sign a JWT for test requests (bypasses login flow). */
export function signToken(overrides?: { userId?: string; email?: string; role?: string }) {
  const payload = {
    userId: overrides?.userId ?? "00000000-0000-4000-8000-000000000001",
    email: overrides?.email ?? "owner@test.com",
    role: overrides?.role ?? "OWNER",
  };
  return jwt.sign(payload, process.env.JWT_SECRET ?? "test-jwt-secret-secret-secret", {
    expiresIn: "1h",
  });
}

/** Standard auth header for Supertest. */
export function authHeader(role: "OWNER" | "STAFF" = "OWNER") {
  return { Authorization: `Bearer ${signToken({ role })}` };
}

export const VALID_UUID = "3f0c5b2d-1a9e-4d8f-9c6e-2b7a1f3d5c8e";

/** Seed an OWNER user (developer account for auth integration). */
export async function createUser(overrides?: {
  id?: string;
  email?: string;
  passwordHash?: string;
  role?: "OWNER" | "STAFF";
}) {
  const { prisma } = await import("../src/shared/lib/prisma.js");
  return prisma.user.create({
    data: {
      id: overrides?.id ?? "00000000-0000-4000-8000-000000000001",
      email: overrides?.email ?? "owner@test.com",
      passwordHash: overrides?.passwordHash ?? (await bcrypt.hash("Admin123!", 4)), // cheap rounds for tests
      name: "Test Owner",
      role: overrides?.role ?? "OWNER",
      isActive: true,
    },
  });
}

/** The dev password every seeded test user uses for login tests. */
export const TEST_PASSWORD = "Admin123!";

/** Seed a customer. */
export async function createCustomer(overrides?: { id?: string; phone?: string; name?: string }) {
  const { prisma } = await import("../src/shared/lib/prisma.js");
  return prisma.customer.create({
    data: {
      id: overrides?.id ?? "00000000-0000-4000-8000-000000000002",
      phone: overrides?.phone ?? "254712345678",
      name: overrides?.name ?? "Jane Wanjiku",
    },
  });
}

/** Seed an active salon service. */
export async function createService(overrides?: {
  id?: string;
  name?: string;
  priceKes?: number;
  durationMinutes?: number;
}) {
  const { prisma } = await import("../src/shared/lib/prisma.js");
  return prisma.nailService.create({
    data: {
      id: overrides?.id ?? "00000000-0000-4000-8000-000000000003",
      name: overrides?.name ?? "Classic Manicure",
      priceKes: overrides?.priceKes ?? 1500,
      durationMinutes: overrides?.durationMinutes ?? 60,
      category: "MANICURE",
      isActive: true,
    },
  });
}

/** Seed business hours (open 08:00–19:00 every day) so booking creation passes. */
export async function createBusinessHours() {
  const { prisma } = await import("../src/shared/lib/prisma.js");
  for (let day = 0; day < 7; day++) {
    await prisma.businessHours.upsert({
      where: { dayOfWeek: day },
      update: {},
      create: { dayOfWeek: day, openTime: "08:00", closeTime: "19:00", isActive: true },
    });
  }
}

/** Seed a PENDING booking linked to a customer + service snapshot. */
export async function createBooking(overrides?: {
  id?: string;
  customerId?: string;
  serviceId?: string;
  appointmentAt?: Date;
  status?: "PENDING" | "APPROVED" | "COMPLETED" | "NO_SHOW" | "CANCELLED" | "RESCHEDULED";
  priceKes?: number;
  paymentStatus?: "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED";
}) {
  const { prisma } = await import("../src/shared/lib/prisma.js");
  const customerId = overrides?.customerId ?? "00000000-0000-4000-8000-000000000002";
  const serviceId = overrides?.serviceId ?? "00000000-0000-4000-8000-000000000003";
  const appointmentAt =
    overrides?.appointmentAt ??
    // Default: tomorrow 10:00 local-safe (stored as UTC)
    new Date(Date.now() + 24 * 60 * 60 * 1000);

  return prisma.booking.create({
    data: {
      id: overrides?.id ?? "00000000-0000-4000-8000-000000000004",
      reference: `WN-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
      customerId,
      appointmentAt,
      durationMinutes: 60,
      priceKes: overrides?.priceKes ?? 1500,
      status: overrides?.status ?? "PENDING",
      paymentStatus: overrides?.paymentStatus ?? "PENDING",
      services: {
        create: [
          {
            serviceId,
            serviceName: "Classic Manicure",
            price: 1500,
            durationMin: 60,
            position: 0,
          },
        ],
      },
      payment: {
        create: { amountKes: overrides?.priceKes ?? 1500, status: "PENDING" },
      },
    },
  });
}
