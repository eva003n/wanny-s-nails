import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client";
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
    role: "ADMIN" as const,
  },
];

async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  try {
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