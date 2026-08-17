import {resolve, dirname, join} from "path";
import { defineConfig, env } from "prisma/config";
// import dotenv from "dotenv";
import { fileURLToPath } from "url";



const environment = process.env.NODE_ENV || "development"

const isDevelopment = environment === "development"
  const __fileName = fileURLToPath(import.meta.url)
const __dirName = dirname(__fileName)

if(isDevelopment) {
  const dotenv = await import("dotenv")

dotenv.config({ path: resolve(__dirName, `../.env`) });
}





export default defineConfig({
  schema: join(__dirName, "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "migrations",
    seed: `tsx prisma/seed.ts`,
  },
});
