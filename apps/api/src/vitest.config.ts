import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Load `.env.test` and inject into every test worker via `test.env`.
// This guarantees DATABASE_URL/REDIS_URL/etc. are present in process.env
// before any module (config.ts → prisma.ts) is imported.
const testEnv = dotenv.config({ path: ".env.test" }).parsed ?? {};

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{js,ts}"],
    clearMocks: true,
    restoreMocks: true,
    env: testEnv,
    // Integration tests hit a real Postgres/Redis — cap parallelism to
    // avoid overwhelming the shared test DB connection limit (TESTING.md §8).
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/modules/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.ts", "src/**/*.integration.test.ts"],
    },
  },
});