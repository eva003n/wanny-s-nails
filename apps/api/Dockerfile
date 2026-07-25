ARG NODE_VERSION=22.21.1
ARG PNPM_VERSION=10.32.1

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/packages/package.json ./apps/packages/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/workers/notification/package.json ./apps/workers/notification/package.json
COPY apps/workers/payment/package.json ./apps/workers/payment/package.json
COPY apps/workers/conversation/package.json ./apps/workers/conversation/package.json
RUN pnpm install --frozen-lockfile 

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/packages/node_modules ./apps/packages/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api ./apps/api
COPY apps/packages ./apps/packages
RUN pnpm --filter @wannys-nails/packages build
RUN pnpm --filter backend build

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps --chown=nodejs:nodejs /app/apps/packages/node_modules ./apps/packages/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/packages/package.json ./apps/packages/package.json
COPY --from=builder --chown=nodejs:nodejs /app/apps/packages/dist ./apps/packages/dist

USER nodejs
WORKDIR /app/apps/api
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 CMD node -e "process.exit(0)"
CMD ["node", "dist/index.js"]