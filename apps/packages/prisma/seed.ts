import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SALT_ROUNDS = 12;

  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

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



// nail services
const services = [
  // Manicure
  {
    name: "Plain Full Manicure",
    description:
      "Basic manicure service including nail shaping, cuticle care, and polish removal.",
    durationMinutes: 60,
    priceKes: 1000,
    category: "MANICURE",
    metadata: {},
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "Gel Polish Application",
    description: "Application of gel polish on natural nails.",
    durationMinutes: 60,
    priceKes: 2000,
    category: "MANICURE",
    metadata: {
      system: "GEL",
    },
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "Gel + Full Manicure",
    description: "Full manicure finished with gel polish.",
    durationMinutes: 90,
    priceKes: 2500,
    category: "MANICURE",
    metadata: {
      system: "GEL",
    },
    isActive: true,
    sortOrder: 3,
  },

  // Enhancements
  {
    name: "Overlay + Gel",
    description: "Overlay enhancement finished with gel polish.",
    durationMinutes: 120,
    priceKes: 3500,
    category: "ENHANCEMENTS",
    metadata: {
      system: "OVERLAY",
      finish: "GEL",
    },
    isActive: true,
    sortOrder: 4,
  },
  {
    name: "Overlay Refill",
    description: "Refill and maintenance for existing overlays.",
    durationMinutes: 90,
    priceKes: 3000,
    category: "ENHANCEMENTS",
    metadata: {
      system: "OVERLAY",
      service: "REFILL",
    },
    isActive: true,
    sortOrder: 5,
  },
  {
    name: "Overlay Ombre",
    description: "Overlay enhancement with an ombre finish.",
    durationMinutes: 120,
    priceKes: 4000,
    category: "ENHANCEMENTS",
    metadata: {
      system: "OVERLAY",
      style: "OMBRE",
    },
    isActive: true,
    sortOrder: 6,
  },
  {
    name: "Overlay Ombre Refill",
    description: "Refill for existing ombre overlays.",
    durationMinutes: 90,
    priceKes: 3500,
    category: "ENHANCEMENTS",
    metadata: {
      system: "OVERLAY",
      style: "OMBRE",
      service: "REFILL",
    },
    isActive: true,
    sortOrder: 7,
  },

  // Pedicure
  {
    name: "Plain Pedicure",
    description: "Basic pedicure service.",
    durationMinutes: 60,
    priceKes: 1000,
    category: "PEDICURE",
    metadata: {},
    isActive: true,
    sortOrder: 8,
  },
  {
    name: "Pedicure + Polish",
    description: "Pedicure finished with regular nail polish.",
    durationMinutes: 75,
    priceKes: 1500,
    category: "PEDICURE",
    metadata: {
      finish: "POLISH",
    },
    isActive: true,
    sortOrder: 9,
  },
  {
    name: "Pedicure + Gel",
    description: "Pedicure finished with gel polish.",
    durationMinutes: 90,
    priceKes: 2500,
    category: "PEDICURE",
    metadata: {
      finish: "GEL",
    },
    isActive: true,
    sortOrder: 10,
  },

  // Removal
  {
    name: "Acrylic Soak Off",
    description: "Safe removal of acrylic nail enhancements.",
    durationMinutes: 30,
    priceKes: 500,
    category: "REMOVAL",
    metadata: {
      removes: "ACRYLIC",
    },
    isActive: true,
    sortOrder: 11,
  },
];



// const nailServices = [
//   {
//     id: "8f76630c-d29c-4d56-b324-cb26add5272b",
//     name: "Plain full manicure",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 1000,
//     category: "MANICURE",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-16T23:52:44.334Z",
//     updatedAt: "2026-06-16T23:52:44.334Z",
//     deletedAt: null,
//   },
//   {
//     id: "6ac2a10a-22c1-422b-9d8a-ed862ab6da4c",
//     name: "Gel polish application",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 2000,
//     category: "MANICURE",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-16T23:54:16.519Z",
//     updatedAt: "2026-06-16T23:54:16.519Z",
//     deletedAt: null,
//   },
//   {
//     id: "252ea80c-fccd-404d-aad2-6bb32fbe67c5",
//     name: "Gel + full manicure",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 2500,
//     category: "MANICURE",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-16T23:55:23.796Z",
//     updatedAt: "2026-06-16T23:55:23.796Z",
//     deletedAt: null,
//   },
//   {
//     id: "7a6e4a17-7164-400c-845b-31c044bc0c60",
//     name: "Overlays refill",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 3000,
//     category: "OVERLAY",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-16T23:57:36.162Z",
//     updatedAt: "2026-06-16T23:57:36.162Z",
//     deletedAt: null,
//   },
//   {
//     id: "c2f6749b-05fc-4de8-882b-4d6576782435",
//     name: "Overlays Ombre",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 4000,
//     category: "OVERLAY",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-16T23:58:19.672Z",
//     updatedAt: "2026-06-16T23:58:19.672Z",
//     deletedAt: null,
//   },
//   {
//     id: "febe0888-1d3a-40e2-8cbc-596bfef26add",
//     name: "Overlays Ombre refill",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 3500,
//     category: "OVERLAY",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-16T23:59:18.752Z",
//     updatedAt: "2026-06-16T23:59:18.752Z",
//     deletedAt: null,
//   },
//   {
//     id: "2bb12ad3-2985-42ce-86de-0ab8b3bd73c7",
//     name: "Plain Pedicure",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 1000,
//     category: "PEDICURE",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-17T00:00:00.826Z",
//     updatedAt: "2026-06-17T00:00:00.826Z",
//     deletedAt: null,
//   },
//   {
//     id: "146dd505-8b77-4e9a-8193-d10f657854b3",
//     name: "Pedicure + polish",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 1500,
//     category: "PEDICURE",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-17T00:00:45.089Z",
//     updatedAt: "2026-06-17T00:00:45.089Z",
//     deletedAt: null,
//   },
//   {
//     id: "988f0499-d584-4248-b4c5-94753432ccb0",
//     name: "Pedicure + Gel",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 2500,
//     category: "PEDICURE",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-17T00:01:27.203Z",
//     updatedAt: "2026-06-17T00:01:27.203Z",
//     deletedAt: null,
//   },
//   {
//     id: "6a828353-0cd0-40d3-a31a-94521c3296d3",
//     name: "Acrylic soak off",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 500,
//     category: "ACRYLIC",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-17T00:02:40.063Z",
//     updatedAt: "2026-06-17T00:02:40.063Z",
//     deletedAt: null,
//   },
//   {
//     id: "0cab7bfb-f355-44ce-8347-9ed44ad55659",
//     name: "Overlays + gel ",
//     description: "",
//     durationMinutes: 90,
//     priceKes: 3500,
//     category: "OVERLAY",
//     isActive: true,
//     sortOrder: 0,
//     createdAt: "2026-06-16T23:56:39.333Z",
//     updatedAt: "2026-06-17T00:44:48.724Z",
//     deletedAt: null,
//   },
// ];
async function main() {


  try {
    for (const service of  services) {
      // const existing = await prisma.nailService.findUnique({
      //   where: { id:  },
      // });

      // if (existing) {
      //   console.log(
      //     `⏭  Booking ${booking.reference} already exists, skipping.`,
      //   );
      //   continue;
      // }

  
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
