FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# ─── Install dependencies ────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/shared/package.json apps/shared/
COPY apps/workers/shared/package.json apps/workers/shared/
COPY apps/workers/notification/package.json apps/workers/notification/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/shared/node_modules apps/shared/node_modules
COPY --from=deps /app/apps/workers/shared/node_modules apps/workers/shared/node_modules
COPY --from=deps /app/apps/workers/notification/node_modules apps/workers/notification/node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules

COPY apps/shared/ apps/shared/
COPY apps/workers/shared/ apps/workers/shared/
COPY apps/workers/notification/ apps/workers/notification/
COPY apps/api/src/generated/ apps/api/src/generated/

RUN cd apps/workers/notification && pnpm build

# ─── Production ──────────────────────────────────────────────
FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

COPY --from=builder /app/apps/workers/notification/dist dist/
COPY --from=builder /app/apps/workers/notification/node_modules node_modules/
COPY --from=builder /app/apps/workers/notification/package.json ./

CMD ["node", "dist/src/index.js"]