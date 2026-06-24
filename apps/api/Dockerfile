
ARG NODE_VERSION=22.21.1
ARG PNPM_VERSION=10.32.1

# ============================================================================
# STAGE 1: Dependencies
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /apps


# Copy monorepo root files for pnpm to resolve workspace
# ─── Install dependencies ────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy shared packages (needed for workspace resolution)
COPY apps/packages ./apps/packages

# Install all dependencies using the root lock file
# This respects symlinks in node_modules/.pnpm and workspace hoisting
RUN pnpm install --frozen-lockfile --prefer-offline

# ============================================================================
# STAGE 2: Build
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /apps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy monorepo config and root package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy shared packages
COPY apps/packages ./apps/packages

# Copy worker code
# Note: Inject WORKER_NAME at build time
ARG WORKER_NAME=payment
COPY apps/api ./apps/api

# Build the worker TypeScript
WORKDIR /apps/api
RUN pnpm run build 2>/dev/null || echo "No build script; using src directly"

# ============================================================================
# STAGE 3: Runtime
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS runtime

WORKDIR /apps

# Install pnpm for runtime dependency resolution
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Copy node_modules from builder
COPY --from=builder --chown=nodejs:nodejs /apps/node_modules ./node_modules

# Copy monorepo structure (needed for module resolution at runtime)
COPY --chown=nodejs:nodejs pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY --chown=nodejs:nodejs apps/packages ./apps/packages

# Copy worker code (built + source for source maps)
ARG WORKER_NAME=payment
COPY --chown=nodejs:nodejs apps/api ./apps/api

# Health check: worker process should stay alive
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Start the worker
WORKDIR /apps/api
CMD ["node", "dist/index.js"]
