# Wanny's Nails — Nail Salon Booking & WhatsApp Automation Platform

## Product Vision

Wanny's Nails is a booking management platform purpose-built for a Kenyan nail salon. Customers book, pay, and receive reminders entirely through WhatsApp. Salon owners and staff manage the business through a Progressive Web App (PWA). Payments run on M-Pesa Daraja API v3.

The system is designed to eliminate missed appointments, reduce manual scheduling effort, improve the client payment experience, and give the salon owner full visibility into revenue and capacity — all without requiring customers to download an app or learn a new interface.

---

## Business Objectives

| Objective | Target |
|---|---|
| Reduce no-shows | ≥ 40% reduction within 90 days |
| Increase booking completion rate | ≥ 85% of initiated conversations |
| Eliminate manual scheduling | 100% of bookings through the platform |
| Payment collection at booking | ≥ 90% M-Pesa payment rate |
| Reminder delivery rate | ≥ 98% |

---

## Core Features

### Customer-Facing (WhatsApp)
- Conversational booking flow (service → date → time → confirm)
- M-Pesa STK Push payment at booking confirmation
- AI fallback layer (Gemini 2.0 Flash) for FAQs and edge cases the FSM cannot handle
- Automated appointment reminders (24h and 1h before)
- Rescheduling and cancellation through WhatsApp
- Appointment lookup ("What's my next booking?")

### Salon Owner / Staff (PWA)
- Installable on any device — iOS, Android, or desktop — no App Store required
- Dashboard: today's appointments, revenue, pending approvals
- Real-time updates via SSE (new bookings appear without refresh)
- Web Push notifications for new bookings (when PWA is installed)
- Approve, reschedule, or cancel bookings
- Manage services and pricing
- Configure business hours and slot availability
- View customer profiles and booking history
- Payment history and reconciliation
- Team management (staff accounts)
- WhatsApp and M-Pesa settings
- Offline support: today's schedule readable from service worker cache

---

## System Architecture Summary

```
Customer (WhatsApp)
        │
        ▼
WhatsApp Cloud API
        │
        ▼
Backend API (Node.js / Express)
        │         │
        │    Gemini 2.0 Flash (AI fallback — free tier)
        │
   ┌────┴────┐
   │         │
PostgreSQL  Redis (sessions + cache)
   │         │
   └────┬────┘
        │
      BullMQ (job queues)
        │
   ┌────┴──────────────┐
   │                   │
M-Pesa Daraja API   Notification Services
                    (WhatsApp / Email)

PWA (React / Vite) ──────► Backend API (REST + SSE)
```

Full diagrams in [ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Technology Stack

### Backend
| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | Async I/O, large ecosystem |
| Framework | Express.js | Lightweight, well-understood |
| Language | TypeScript | Type safety, better DX |
| ORM | Prisma | Type-safe DB access, migrations |
| Database | PostgreSQL 16 | ACID, relational integrity |
| Cache / Sessions | Redis 7 | Fast, pub/sub, session TTL |
| Queue | BullMQ | Reliable job processing on Redis |
| Auth | JWT + refresh tokens | Stateless, works across devices |
| Logging | Pino + pino-http | Structured JSON logs |
| AI Fallback | Gemini 2.0 Flash | Free tier, WhatsApp FAQ handler |

### Frontend (PWA)
| Layer | Technology | Reason |
|---|---|---|
| Framework | React 18 | Component model, large ecosystem |
| Build tool | Vite | Fast dev server, optimised builds |
| PWA | vite-plugin-pwa (Workbox) | Service worker, manifest, offline cache |
| Routing | React Router v6 | URL-based navigation and modals |
| Icons | Lucide React | Consistent, tree-shakeable icon set |
| HTTP client | Axios + Tanstack query  | REST API calls |
| Real-time | EventSource (SSE) | Live booking and payment updates |

### External Services
| Service | Provider |
|---|---|
| WhatsApp | Meta WhatsApp Cloud API |
| Payments | Safaricom M-Pesa Daraja API v3 |
| Email | Resend |
| AI Fallback | Google Gemini API (free tier) |

### Infrastructure
| Component | Technology |
|---|---|
| Hosting | Railway / Render |
| Container | Docker |
| CI/CD | GitHub Actions |
| Monitoring | Better Stack (Logtail + Uptime) |
| Error Tracking | Sentry |

---

## Repository Structure

```
wanny-s-nails/
├── apps/
│   ├── api/                    # Express backend
│   │   ├── src/
│   │   │   ├── modules/        # Feature modules (bookings, payments, etc.)
│   │   │   ├── shared/         # Shared utilities, middleware, types
│   │   │   ├── jobs/           # BullMQ job processors
│   │   │   ├── workflows/      # WhatsApp FSM + AI fallback handler
│   │   │   └── app.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   └── web/                    # React PWA
│       ├── src/
│       │   ├── pages/          # Dashboard, Bookings, Customers, Payments, Settings
│       │   ├── components/     # Shared UI components
│       │   ├── hooks/          # API hooks, SSE hook, auth hook
│       │   └── lib/            # API client, shared types
│       ├── public/
│       │   ├── manifest.json
│       │   └── icons/          # 192×192, 512×512 PWA icons
│       └── vite.config.ts
├── docs/                       # All specification files
├── scripts/                    # Dev/ops scripts
├── docker-compose.yml
├── .github/workflows/
└── README.md
```

---

## Documentation Index

| File | Description |
|---|---|
| [PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) | Full PRD — personas, user stories, functional and non-functional requirements |
| [TECHNICAL_SPECIFICATION.md](docs/TECHNICAL_SPECIFICATION.md) | Architecture, component design, integration patterns |
| [UI_UX_SPECIFICATION.md](docs/UI_UX_SPECIFICATION.md) | PWA design system, screen specs, user flows, responsive layout |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | C4 diagrams and sequence diagrams (Mermaid) |
| [DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) | ERD, table definitions, Prisma schema |
| [API_SPECIFICATION.md](docs/API_SPECIFICATION.md) | OpenAPI-style endpoint documentation |
| [BOOKING_WORKFLOW.md](docs/BOOKING_WORKFLOW.md) | Booking lifecycle, availability engine |
| [PAYMENT_WORKFLOW.md](docs/PAYMENT_WORKFLOW.md) | M-Pesa STK Push flow, callbacks, reconciliation |
| [WHATSAPP_AUTOMATION.md](docs/WHATSAPP_AUTOMATION.md) | FSM + AI hybrid engine, state machine, Gemini integration |
| [SECURITY.md](docs/SECURITY.md) | Auth, authorization, encryption, KDPA compliance |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker, CI/CD, environments, monitoring |
| [DECISIONS.md](docs/DECISIONS.md) | Architecture Decision Records (ADRs) |
| [AGENTS.md](.agents/AGENTS.md) | Agent instructions and development rules |

---

## Development Workflow

1. **Documentation first** — All features are specified in docs before any code is written.
2. **Schema first** — Database schema is finalised before writing service logic.
3. **API contract first** — API shapes are agreed before frontend work begins.
4. **Feature branches** — `feat/`, `fix/`, `chore/` prefixes; squash-merge to `main`.
5. **CI gates** — Tests, linting, and type-check must pass before merge.
6. **Staging before production** — Every release is deployed to staging and smoke-tested first.

---

## Local Development Quick Start

```bash
# Prerequisites: Node.js 20, Docker Desktop, pnpm

git clone https://github.com/eva003n/wanny-s-nails.git
cd wanny-s-nails

# API environment
cp apps/api/.env.example apps/api/.env
# Fill in: DATABASE_URL, REDIS_URL, JWT_SECRET,
#          WHATSAPP_*, DARAJA_*, RESEND_API_KEY, GEMINI_API_KEY

# Start PostgreSQL and Redis
docker-compose up -d

# Install and migrate
cd apps/api
pnpm install
pnpm prisma migrate dev
pnpm dev                    # API on http://localhost:8000

# In a second terminal — start the PWA
cd apps/web
pnpm install
pnpm dev                    # PWA on http://localhost:5173
```

For WhatsApp and M-Pesa local testing, use ngrok to expose the webhook endpoint:

```bash
ngrok http 8000
# Copy the https URL
# Set WHATSAPP_CALLBACK_URL and DARAJA_CALLBACK_URL in apps/api/.env
# Register the ngrok URL in Meta Developer Console
```
