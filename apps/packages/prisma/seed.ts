import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDevelopment = process.env.NODE_ENV || "development"

if(isDevelopment) {
  const dotenv = await import("dotenv")
  dotenv.config({ path: path.resolve(__dirname, "../.env") });

}


const SALT_ROUNDS = 12;

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

// ============================================
// Seed data
// ============================================

const users = [
  {
    email: "wanny@wannysnails.com",
    name: "Wanny",
    password: "Admin123!",
    role: "OWNER" as const,
  },
  {
    email: "wanny@gmail.com",
    name: "Wanny",
    password: "Admin123!",
    role: "STAFF" as const,
  },
];

const services = [
  // --- MANICURE ---
  {
    name: "Plain Full Manicure",
    description: "Basic manicure service ",
    durationMinutes: 120,
    priceKes: 1000,
    category: "MANICURE" as const,
    sortOrder: 1,
  },
  {
    name: "Gel Polish Application",
    description: "Application of gel polish on natural nails.",
    durationMinutes: 120,
    priceKes: 2000,
    category: "MANICURE" as const,
    sortOrder: 2,
  },
  {
    name: "Gel + Full Manicure",
    description: "Full manicure finished with gel polish.",
    durationMinutes: 120,
    priceKes: 2500,
    category: "MANICURE" as const,
    sortOrder: 3,
  },

  // --- ENHANCEMENTS ---
  {
    name: "Overlay + Gel",
    description: "Overlay enhancement finished with gel polish.",
    durationMinutes: 120,
    priceKes: 3500,
    category: "ENHANCEMENTS" as const,
    sortOrder: 4,
  },
  {
    name: "Overlay Refill",
    description: "Refill and maintenance for existing overlays.",
    durationMinutes: 120,
    priceKes: 3000,
    category: "ENHANCEMENTS" as const,
    sortOrder: 5,
  },
  {
    name: "Overlay Ombre",
    description: "Overlay enhancement with an ombre finish.",
    durationMinutes: 120,
    priceKes: 4000,
    category: "ENHANCEMENTS" as const,
    sortOrder: 6,
  },
  {
    name: "Overlay Ombre Refill",
    description: "Refill for existing ombre overlays.",
    durationMinutes: 120,
    priceKes: 3500,
    category: "ENHANCEMENTS" as const,
    sortOrder: 7,
  },

  // --- PEDICURE ---
  {
    name: "Plain Pedicure",
    description: "Basic pedicure service.",
    durationMinutes: 120,
    priceKes: 1000,
    category: "PEDICURE" as const,
    sortOrder: 8,
  },
  {
    name: "Pedicure + Polish",
    description: "Pedicure finished with regular nail polish.",
    durationMinutes: 120,
    priceKes: 1500,
    category: "PEDICURE" as const,
    sortOrder: 9,
  },
  {
    name: "Pedicure + Gel",
    description: "Pedicure finished with gel polish.",
    durationMinutes: 120,
    priceKes: 2500,
    category: "PEDICURE" as const,
    sortOrder: 10,
  },

  // --- REMOVAL ---
  {
    name: "Acrylic Soak Off",
    description: "Safe removal of acrylic nail enhancements.",
    durationMinutes: 120,
    priceKes: 500,
    category: "REMOVAL" as const,
    sortOrder: 11,
  },
];

const businessHours = [
  { dayOfWeek: 0, openTime: "07:00", closeTime: "19:00", isActive: false }, // Sunday - closed
  { dayOfWeek: 1, openTime: "07:00", closeTime: "19:00", isActive: true },  // Monday
  { dayOfWeek: 2, openTime: "07:00", closeTime: "19:00", isActive: true },  // Tuesday
  { dayOfWeek: 3, openTime: "07:00", closeTime: "19:00", isActive: true },  // Wednesday
  { dayOfWeek: 4, openTime: "07:00", closeTime: "19:00", isActive: true },  // Thursday
  { dayOfWeek: 5, openTime: "07:00", closeTime: "19:00", isActive: true },  // Friday
  { dayOfWeek: 6, openTime: "07:00", closeTime: "19:00", isActive: true },  // Saturday
];

const defaultNotificationSubscriptions = [
  {
    channel: "WHATSAPP" as const,
    endpoint: "+254712345678", // Wanny's test WhatsApp number
    isActive: true,
  },
  {
    channel: "EMAIL" as const,
    endpoint: "wanny@wannysnails.com",
    isActive: true,
  },
];

// ============================================
// Seed functions
// ============================================

async function seedUsers() {
  console.log("\n--- Users ---");
  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });
    if (existing) {
      console.log(`  ⏭  User ${user.email} already exists, skipping.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role,
      },
    });
    console.log(`  ✅ Created ${user.role}: ${user.name} (${user.email})`);
  }
}

async function seedServices() {
  console.log("\n--- Services ---");
  for (const svc of services) {
    const existing = await prisma.nailService.findFirst({
      where: { name: svc.name, deletedAt: null },
    });
    if (existing) {
      console.log(`  ⏭  Service "${svc.name}" already exists, skipping.`);
      continue;
    }

    await prisma.nailService.create({
      data: {
        name: svc.name,
        description: svc.description,
        durationMinutes: svc.durationMinutes,
        priceKes: svc.priceKes,
        category: svc.category,
        sortOrder: svc.sortOrder,
      },
    });
    console.log(`  ✅ Created service: ${svc.name}`);
  }
}

async function seedBusinessHours() {
  console.log("\n--- Business Hours ---");
  for (const bh of businessHours) {
    const existing = await prisma.businessHours.findUnique({
      where: { dayOfWeek: bh.dayOfWeek },
    });
    if (existing) {
      if (
        existing.openTime !== bh.openTime ||
        existing.closeTime !== bh.closeTime ||
        existing.isActive !== bh.isActive
      ) {
        await prisma.businessHours.update({
          where: { dayOfWeek: bh.dayOfWeek },
          data: {
            openTime: bh.openTime,
            closeTime: bh.closeTime,
            isActive: bh.isActive,
          },
        });
        console.log(`  🔄 Updated day ${bh.dayOfWeek} business hours.`);
      } else {
        console.log(`  ⏭  Day ${bh.dayOfWeek} business hours unchanged, skipping.`);
      }
      continue;
    }

    await prisma.businessHours.create({
      data: {
        dayOfWeek: bh.dayOfWeek,
        openTime: bh.openTime,
        closeTime: bh.closeTime,
        isActive: bh.isActive,
      },
    });
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][bh.dayOfWeek];
    console.log(`  ✅ Created business hours: ${dayName} (${bh.openTime} - ${bh.closeTime})`);
  }
}

async function seedNotificationSubscriptions() {
  console.log("\n--- Notification Subscriptions ---");

  // Get the owner user
  const owner = await prisma.user.findUnique({
    where: { email: "wanny@wannysnails.com" },
  });
  if (!owner) {
    console.log("  ⏭  Owner user not found, skipping notification subscriptions.");
    return;
  }

  for (const sub of defaultNotificationSubscriptions) {
    const existing = await prisma.notificationSubscription.findUnique({
      where: {
        recipientId_channel_endpoint: {
          recipientId: owner.id,
          channel: sub.channel,
          endpoint: sub.endpoint,
        },
      },
    });
    if (existing) {
      console.log(`  ⏭  ${sub.channel} subscription for ${sub.endpoint} already exists, skipping.`);
      continue;
    }

    await prisma.notificationSubscription.create({
      data: {
        recipientId: owner.id,
        recipientType: "OWNER",
        channel: sub.channel,
        endpoint: sub.endpoint,
        isActive: sub.isActive,
      },
    });
    console.log(`  ✅ Created ${sub.channel} subscription for ${sub.endpoint}`);
  }
}

// ============================================
// Main orchestrator
// ============================================

async function main() {
  console.log("🌱 Seeding database...\n");

  try {
    await seedUsers();
  } catch (err) {
    console.error("❌ Users seeding failed:", err);
  }

  try {
    await seedServices();
  } catch (err) {
    console.error("❌ Services seeding failed:", err);
  }

  try {
    await seedBusinessHours();
  } catch (err) {
    console.error("❌ Business hours seeding failed:", err);
  }

  // try {
  //   await seedNotificationSubscriptions();
  // } catch (err) {
  //   console.error("❌ Notification subscriptions seeding failed:", err);
  // }

  console.log("\n🎉 Database seeded successfully!");
}

main()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());