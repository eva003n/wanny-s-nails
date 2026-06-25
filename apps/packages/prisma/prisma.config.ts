import path from "path";
import { defineConfig, env } from "prisma/config";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __fileName = fileURLToPath(import.meta.url)
const __dirName = path.dirname(__fileName)

dotenv.config({ path: path.resolve(__dirName, "../.env") });

console.log(env("DATABASE_URL"));

export default defineConfig({
  schema: path.join(__dirName, "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "migrations",
    seed: `tsx ${path.resolve(__dirName, "seed.ts")}`,
  },
});
