import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../../api/src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.development") });

const SALT_ROUNDS = 12;

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

const customers = [
  {
    name: "Jefferey Grady",
    phone: "+254700123456",
    email: "jefferey.grady@ethereal.email",
  },
  {
    name: "Mary Kimani",
    phone: "+254710123456",
    email: "guiseppe84@ethereal.email",
  },
];

const bookings = [
  {
    customerId: "c8ffcb18-1c8c-4512-8249-b1fc298db87c",
    reference: "WN-2026-95773",
    serviceId: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    appointmentAt: "2026-06-18T09:00:00Z",
    durationMinutes: 90,
    priceKes: 3500,
  },
  {
    customerId: "c8ffcb18-1c8c-4512-8249-b1fc298db87c",
    reference: "WN-2026-95774",
    serviceId: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    appointmentAt: "2026-06-20T11:00:00Z",
    durationMinutes: 90,
    priceKes: 3500,
  },
  {
    customerId: "c8ffcb18-1c8c-4512-8249-b1fc298db87c",
    reference: "WN-2026-95775",
    serviceId: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    appointmentAt: "2026-06-23T14:00:00Z",
    durationMinutes: 90,
    priceKes: 3500,
  },
  {
    customerId: "c8ffcb18-1c8c-4512-8249-b1fc298db87c",
    reference: "WN-2026-95776",
    serviceId: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    appointmentAt: "2026-06-26T10:00:00Z",
    durationMinutes: 90,
    priceKes: 3500,
  },
  {
    customerId: "c8ffcb18-1c8c-4512-8249-b1fc298db87c",
    reference: "WN-2026-95777",
    serviceId: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    appointmentAt: "2026-06-29T13:00:00Z",
    durationMinutes: 90,
    priceKes: 3500,
  },
  {
    customerId: "c8ffcb18-1c8c-4512-8249-b1fc298db87c",
    reference: "WN-2026-95778",
    serviceId: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    appointmentAt: "2026-07-02T09:00:00Z",
    durationMinutes: 90,
    priceKes: 3500,
  },
  {
    customerId: "c8ffcb18-1c8c-4512-8249-b1fc298db87c",
    reference: "WN-2026-95779",
    serviceId: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    appointmentAt: "2026-07-05T12:00:00Z",
    durationMinutes: 90,
    priceKes: 3500,
  },
  {
    customerId: "c8ffcb18-1c8c-4512-8249-b1fc298db87c",
    reference: "WN-2026-95073",
    serviceId: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    appointmentAt: "2026-07-08T15:00:00Z",
    durationMinutes: 90,
    priceKes: 3500,
  },
  {
    customerId: "c8ffcb18-1c8c-4512-8249-b1fc298db87c",
    reference: "WN-2026-90773",
    serviceId: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    appointmentAt: "2026-07-11T10:30:00Z",
    durationMinutes: 90,
    priceKes: 3500,
  },
  {
    customerId: "c8ffcb18-1c8c-4512-8249-b1fc298db87c",
    reference: "WN-2026-92773",
    serviceId: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    appointmentAt: "2026-07-14T11:30:00Z",
    durationMinutes: 90,
    priceKes: 3500,
  },
];
const nailServices = [
  {
    id: "8f76630c-d29c-4d56-b324-cb26add5272b",
    name: "Plain full manicure",
    description: "",
    durationMinutes: 90,
    priceKes: 1000,
    category: "MANICURE",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-16T23:52:44.334Z",
    updatedAt: "2026-06-16T23:52:44.334Z",
    deletedAt: null,
  },
  {
    id: "6ac2a10a-22c1-422b-9d8a-ed862ab6da4c",
    name: "Gel polish application",
    description: "",
    durationMinutes: 90,
    priceKes: 2000,
    category: "MANICURE",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-16T23:54:16.519Z",
    updatedAt: "2026-06-16T23:54:16.519Z",
    deletedAt: null,
  },
  {
    id: "252ea80c-fccd-404d-aad2-6bb32fbe67c5",
    name: "Gel + full manicure",
    description: "",
    durationMinutes: 90,
    priceKes: 2500,
    category: "MANICURE",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-16T23:55:23.796Z",
    updatedAt: "2026-06-16T23:55:23.796Z",
    deletedAt: null,
  },
  {
    id: "7a6e4a17-7164-400c-845b-31c044bc0c60",
    name: "Overlays refill",
    description: "",
    durationMinutes: 90,
    priceKes: 3000,
    category: "OVERLAY",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-16T23:57:36.162Z",
    updatedAt: "2026-06-16T23:57:36.162Z",
    deletedAt: null,
  },
  {
    id: "c2f6749b-05fc-4de8-882b-4d6576782435",
    name: "Overlays Ombre",
    description: "",
    durationMinutes: 90,
    priceKes: 4000,
    category: "OVERLAY",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-16T23:58:19.672Z",
    updatedAt: "2026-06-16T23:58:19.672Z",
    deletedAt: null,
  },
  {
    id: "febe0888-1d3a-40e2-8cbc-596bfef26add",
    name: "Overlays Ombre refill",
    description: "",
    durationMinutes: 90,
    priceKes: 3500,
    category: "OVERLAY",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-16T23:59:18.752Z",
    updatedAt: "2026-06-16T23:59:18.752Z",
    deletedAt: null,
  },
  {
    id: "2bb12ad3-2985-42ce-86de-0ab8b3bd73c7",
    name: "Plain Pedicure",
    description: "",
    durationMinutes: 90,
    priceKes: 1000,
    category: "PEDICURE",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-17T00:00:00.826Z",
    updatedAt: "2026-06-17T00:00:00.826Z",
    deletedAt: null,
  },
  {
    id: "146dd505-8b77-4e9a-8193-d10f657854b3",
    name: "Pedicure + polish",
    description: "",
    durationMinutes: 90,
    priceKes: 1500,
    category: "PEDICURE",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-17T00:00:45.089Z",
    updatedAt: "2026-06-17T00:00:45.089Z",
    deletedAt: null,
  },
  {
    id: "988f0499-d584-4248-b4c5-94753432ccb0",
    name: "Pedicure + Gel",
    description: "",
    durationMinutes: 90,
    priceKes: 2500,
    category: "PEDICURE",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-17T00:01:27.203Z",
    updatedAt: "2026-06-17T00:01:27.203Z",
    deletedAt: null,
  },
  {
    id: "6a828353-0cd0-40d3-a31a-94521c3296d3",
    name: "Acrylic soak off",
    description: "",
    durationMinutes: 90,
    priceKes: 500,
    category: "ACRYLIC",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-17T00:02:40.063Z",
    updatedAt: "2026-06-17T00:02:40.063Z",
    deletedAt: null,
  },
  {
    id: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
    name: "Overlays + gel ",
    description: "",
    durationMinutes: 90,
    priceKes: 3500,
    category: "OVERLAY",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-16T23:56:39.333Z",
    updatedAt: "2026-06-17T00:44:48.724Z",
    deletedAt: null,
  },
];
async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  try {
    for (const booking of bookings) {
      const existing = await prisma.booking.findUnique({
        where: { reference: booking.reference },
      });

      if (existing) {
        console.log(
          `⏭  Booking ${booking.reference} already exists, skipping.`,
        );
        continue;
      }

      await prisma.booking.create({
        data: {
          customerId: booking.customerId,
          reference: booking.reference,
          serviceId: booking.serviceId,
          appointmentAt: booking.appointmentAt,
          durationMinutes: booking.durationMinutes,
          priceKes: booking.priceKes,
        },
      });

      console.log(`✅ Created ${booking.reference}`);
    }

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

      const existing = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (existing) {
        console.log(`⏭  User ${user.email} already exists, skipping.`);
        continue;
      }

      await prisma.user.create({
        data: {
          email: user.email,
          name: user.name,
          passwordHash,
          role: user.role,
        },
      });

      console.log(`✅ Created ${user.role}: ${user.name} (${user.email})`);
    }

    console.log("\n🎉 Database seeded successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
