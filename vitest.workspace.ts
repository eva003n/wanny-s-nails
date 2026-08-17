// vitest.workspace.ts (repo root)
export default [
  "apps/api",
  "apps/web",
  "apps/packages/*", // any package with its own vitest.config.ts
  "apps/workers/*"
];
