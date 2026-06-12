# Deployment — Wanny's Nails

**Version:** 1.0

---

## Environments

| Environment | Purpose | URL |
|---|---|---|
| Development | Local machine — active development | http://localhost:8000 |
| Staging | Pre-production testing, mirrors production config | https://staging-api.wanny's-nails.co.ke |
| Production | Live system | https://api.wanny's-nails.co.ke |

---

## Local Development Setup

### Prerequisites

- Node.js 22.21.1
- pnpm 10.32.1
- Docker Desktop (for PostgreSQL + Redis)
- ngrok (for WhatsApp + Daraja API webhook testing)

### Steps

```bash
# 1. Clone and install
git clone https://github.com/eva003n/wanny-s-nails.git
cd wanny-s-nails/apps/api
pnpm install

# 2. Start dependencies
docker-compose up -d  # PostgreSQL on :5432, Redis on :6379

# 3. Configure environment
cp .env.example .env .env.development .env.production


# 4. Run migrations
pnpm prisma migrate dev

# 5. Seed development data
pnpm prisma db seed

# 6. Start the API
pnpm dev  # nodemon + ts-node-esm, hot reload


# 8. Expose webhook for WhatsApp and Daraja API testing
ngrok http 8000
# Copy the https URL → set as WHATSAPP_CALLBACK_URL in .env.development
# Copy the https URL → set as DARAJA_CALLBACK_URL in .env.development
# Register the ngrok URL in Meta Developer Console
```

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_DB: wannysnails_dev
      POSTGRES_USER: wannysnails
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## Docker Setup (Production)

### API Dockerfile

```dockerfile
# apps/api/Dockerfile
ARG NODE_VERSION=22.21.1
ARG PNPM_VERSION=10.32.1
FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Build
FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build  # tsc → dist/

# Production image
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 8000

# Run migrations then start
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/server.js"]
```

### Worker Dockerfile

```dockerfile
ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

CMD ["node", "dist/worker.js"]
```

### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      # ... all secrets injected from hosting platform
    ports:
      - "8000:8000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      # ... 
    restart: unless-stopped
    depends_on:
      - api
```

---

## CI/CD

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:18-alpine
        env:
          POSTGRES_DB: wannysnails_test
          POSTGRES_USER: nailbook
          POSTGRES_PASSWORD: testpassword
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 10s

      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]

    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v3
        with: { version: 10.32.1 }
      
      - uses: actions/setup-node@v4
        with:
          node-version: '22.21.1'
          cache: 'pnpm'
          cache-dependency-path: apps/api/pnpm-lock.yaml

      - name: Install dependencies
        run: cd apps/api && pnpm install --frozen-lockfile

      - name: Type check
        run: cd apps/api && pnpm typecheck

      - name: Lint
        run: cd apps/api && pnpm lint

      - name: Run migrations
        run: cd apps/api && pnpm prisma migrate deploy
        env:
          DATABASE_URL: postgresql://wannysnails:testpassword@localhost:5432/wannysnails_test

      - name: Run tests
        run: cd apps/api && pnpm test
        env:
          DATABASE_URL: postgresql://wannysnails_test:testpassword@localhost:5432/wannysnails_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret-at-least-32-chars-long
          NODE_ENV: test

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          # Railway / Render CLI deploy
          railway up --environment staging

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production  # requires manual approval in GitHub
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: railway up --environment production
```

### Deployment Flow

```
Developer opens PR → CI runs (typecheck + lint + tests)
       ↓
PR merged to develop → Auto-deploy to staging
       ↓
Staging smoke test (manual)
       ↓
PR: develop → main → CI runs again
       ↓
Merge → GitHub environment approval required
       ↓
Deploy to production → Health check passes
       ↓
Monitor Sentry + Better Stack for 30 minutes
```

---

## Monitoring

### Health Check Endpoint

```
GET /health

Response 200:
{
  "status": "ok",
  "version": "1.2.3",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2025-06-05T07:00:00.000Z"
}
```

### Uptime Monitoring

Better Stack (Uptime) configured to:
- Ping `/health` every 60 seconds from multiple regions
- Alert via SMS + email if downtime > 2 minutes

### Error Tracking

Sentry configured for:
- All unhandled exceptions
- Unhandled promise rejections
- Performance monitoring (transactions)
- Alert on error spike (> 10 new errors in 5 minutes)

### Logging

Pino structured JSON logs shipped to Better Stack (Logtail):
- Production: `info` level and above
- Staging: `debug` level and above
- Retention: 30 days

### BullMQ Dashboard

Bull Board exposed at `/admin/queues` (restricted to internal network / VPN only, not public):
- Monitor queue depths
- View failed jobs
- Manually retry or discard dead-letter jobs

---

## Backups

### PostgreSQL Backups

| Backup Type | Frequency | Retention | Storage |
|---|---|---|---|
| Continuous WAL archiving | Real-time | 7 days | Railway managed / S3 |
| Daily snapshot | 02:00 EAT | 30 days | S3 (encrypted) |
| Weekly snapshot | Sunday 02:00 EAT | 1 year | S3 (encrypted, Glacier after 90 days) |

**Backup verification:** Monthly restore test to a scratch environment, verified by running `pnpm prisma validate` and a suite of read queries.

### Redis Backups

Redis is used for ephemeral data (sessions, queue). BullMQ jobs are persisted. Redis AOF (append-only file) enabled for durability.

Recovery: Redis failure means active WhatsApp sessions are lost (customers restart their conversation). BullMQ jobs with `removeOnComplete: false` are recoverable from Redis AOF.

---

## Disaster Recovery

### RTO / RPO Targets

| Metric | Target |
|---|---|
| Recovery Time Objective (RTO) | < 2 hours |
| Recovery Point Objective (RPO) | < 24 hours (daily backup) |

### Scenarios

**Scenario 1: API instance crash**
- Auto-restart via Docker `restart: unless-stopped`
- Load balancer health check detects unhealthy instance within 30s
- Resolution: < 1 minute

**Scenario 2: Database corruption / accidental deletion**
1. Alert triggers from Sentry / Better Stack
2. Restore from most recent daily snapshot to a new DB instance
3. Point API to new DB via environment variable update
4. Replay any missed transactions from application logs if possible
5. Target resolution: < 2 hours

**Scenario 3: Compromised credentials**
1. Immediately rotate all secrets (JWT, WhatsApp, Daraja)
2. Revoke all active refresh tokens (DELETE FROM refresh_tokens)
3. Require all staff to re-login
4. Notify Safaricom and Meta of potential compromise
5. Post-mortem within 24 hours

**Scenario 4: Daraja API outage**
- STK Push jobs remain in BullMQ queue
- Customers notified: "Payment processing is temporarily unavailable. We'll send you a payment request as soon as it's restored."
- Owner can manually mark bookings as paid once restored

**Scenario 5: WhatsApp API outage**
- Notification jobs remain in queue with retry logic
- Customers already in conversations see no response (timeout after 30 min)
- Bookings are unaffected; reminders delivered when service restores

---

## Environment Variable Reference

```bash
# .env.example

# Server
NODE_ENV=development
PORT=8000

# Database
DATABASE_URL=postgresql://wannysnails:password@localhost:5432/wannysnails_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-at-least-32-chars

# WhatsApp
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=your-custom-verify-token
WHATSAPP_BUSINESS_ACCOUNT_ID=

# Daraja M-Pesa
DARAJA_CONSUMER_KEY=
DARAJA_CONSUMER_SECRET=
DARAJA_SHORTCODE=
DARAJA_PASSKEY=
DARAJA_CALLBACK_URL=https://api.wannysnails.co.ke/api/v1/payments/mpesa-callback
DARAJA_ENV=sandbox  # sandbox | production

# Notifications
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@nailbook.co.ke
# AFRICASTALKING_USERNAME=
# AFRICASTALKING_API_KEY=

# Monitoring
SENTRY_DSN=
BETTERSTACK_SOURCE_TOKEN=
```
