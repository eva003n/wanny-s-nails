import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{js,ts}"],
    clearMocks: true,
    restoreMocks: true,
    env: {
      // Fake values so ./src/lib/config.ts's zod validation passes without
      // touching the real .env (TESTING.md §9.6 — never real credentials in
      // test fixtures). NODE_ENV="staging" (not "development") so config.ts
      // skips its dotenv-load branch entirely, and (not "production") so
      // the logger doesn't try to stand up file/Logtail transports.
      NODE_ENV: "staging",
      REDIS_URL: "redis://test-fake-host:6379",
      DATABASE_URL: "postgresql://test:test@test-fake-host:5432/test",
      WHATSAPP_ACCESS_TOKEN: "test-fake-whatsapp-token",
      WHATSAPP_PHONE_NUMBER_ID: "000000000000000",
    },
  },
});
