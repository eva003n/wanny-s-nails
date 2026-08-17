ARG NODE_VERSION=22.21.1
ARG PNPM_VERSION=10.32.1

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/packages/core/package.json ./apps/packages/core/package.json
COPY apps/workers/notification/package.json ./apps/workers/notification/package.json
COPY apps/workers/payment/package.json ./apps/workers/payment/package.json
COPY apps/workers/conversation/package.json ./apps/workers/conversation/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN pnpm exec vite build

FROM nginx:1.27-alpine AS runtime

# Copy nginx config as a static file (not a template)
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
# Copy built assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Graceful shutdown
STOPSIGNAL SIGQUIT

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]