ARG NODE_VERSION=22.21.1
ARG PNPM_VERSION=10.32.1
ARG WORKER_NAME=payment
ARG WORKER_PACKAGE=@wanny/worker-payment

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

FROM base AS deps
ARG WORKER_NAME
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/packages/package.json ./apps/packages/package.json
COPY apps/workers/${WORKER_NAME}/package.json ./apps/workers/${WORKER_NAME}/package.json
RUN pnpm install --frozen-lockfile 

FROM base AS builder
ARG WORKER_NAME
ARG WORKER_PACKAGE
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/packages/node_modules ./apps/packages/node_modules
COPY --from=deps /app/apps/workers/${WORKER_NAME}/node_modules ./apps/workers/${WORKER_NAME}/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api ./apps/api
COPY apps/packages ./apps/packages
COPY apps/workers/${WORKER_NAME} ./apps/workers/${WORKER_NAME}
RUN pnpm --filter @wannys-nails/packages build
RUN pnpm --filter backend build
RUN pnpm --filter ${WORKER_PACKAGE} build || test -f apps/workers/${WORKER_NAME}/dist/index.js

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001


ARG WORKER_NAME
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps --chown=nodejs:nodejs /app/apps/packages/node_modules ./apps/packages/node_modules
COPY --from=deps --chown=nodejs:nodejs /app/apps/workers/${WORKER_NAME}/node_modules ./apps/workers/${WORKER_NAME}/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/src
COPY --from=builder --chown=nodejs:nodejs /app/apps/packages/package.json ./apps/packages/package.json
COPY --from=builder --chown=nodejs:nodejs /app/apps/packages/dist ./apps/packages/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/workers/${WORKER_NAME}/package.json ./apps/workers/${WORKER_NAME}/package.json
COPY --from=builder --chown=nodejs:nodejs /app/apps/workers/${WORKER_NAME}/dist ./apps/workers/${WORKER_NAME}/dist

USER nodejs
WORKDIR /app/apps/workers/payment
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 CMD node -e "process.exit(0)"
CMD ["node", "dist/index.js"]
