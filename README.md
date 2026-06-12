# Wanny's Nails — Nail Salon Booking & WhatsApp Automation Platform

## Product Vision

Wanny's Nails  is a booking management platform purpose-built for Kenyan nail salon. Customers book, pay, and receive reminders entirely through WhatsApp. Salon owners and staff manage the business through a native iOS application. Payments run on M-Pesa Daraja API v3.

The system is designed to eliminate missed appointments, reduce manual scheduling effort, improve clients payment experience and give the salon owner full visibility into revenue and capacity — all without requiring customers to download an app or learn a new interface.

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
- Automated appointment reminders (24h and 1h before)
- Rescheduling and cancellation through WhatsApp
- Appointment lookup ("What's my next booking?")

### Salon Owner / Staff (iOS App)
- Dashboard: today's appointments, revenue, pending approvals
- Approve, reschedule, or cancel bookings
- Manage services and pricing
- Configure business hours and slot availability
- View customer profiles and booking history
- Payment history and reconciliation
- Team management (staff accounts)
- WhatsApp and M-Pesa settings

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
        │
   ┌────┴────┐
   │         │
PostgreSQL  Redis (sessions + cache)
   │         │
   └────┬────┘
        │
      BullMQ (job queues)
        │
   ┌────┴────────────────┐
   │                     │
M-Pesa Daraja API    Notification Services
                     (WhatsApp / SMS / Email)

iOS Admin App ──────► Backend API
```

Full diagrams in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Technology Stack

### Backend
| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | Async I/O, large ecosystem |
| Framework | Express.js | Lightweight, well-understood |
| Language | TypeScript | Type safety, better DX |
| ORM | Prisma | Type-safe DB access, migrations |
| Database | PostgreSQL 18 | ACID, relational integrity |
| Cache / Sessions | Redis 7 | Fast, pub/sub, session TTL |
| Queue | BullMQ | Reliable job processing on Redis |
| Auth | JWT + refresh tokens | Stateless, mobile-friendly |
|Logging | Pino + Pino-http|

### Mobile
| Layer | Technology |
|---|---|
| Platform | iOS (Swift / SwiftUI) |
| Min iOS | 16.0 |
| Networking | URLSession + async/await |
| Storage | Keychain (tokens), CoreData (cache) |

### External Services
| Service | Provider |
|---|---|
| WhatsApp | Meta WhatsApp Cloud API |
| Payments | Safaricom M-Pesa Daraja API v3 |
<!-- | SMS | Africa's Talking | -->
| Email | Resend |

### Infrastructure
| Component | Technology |
|---|---|
| Hosting | Railway / Render (initial) |
| Container | Docker |
| CI/CD | GitHub Actions |
| Monitoring | Better Stack (Logtail + Uptime) |
| Error Tracking | Sentry |

---

## Repository Structure
```
Wanny's Nails/
├── apps/
│   ├── api/                    # Express backend
│   │   ├── src/
│   │   │   ├── modules/        # Feature modules (bookings, payments, etc.)
│   │   │   ├── shared/         # Shared utilities, middleware, types
│   │   │   ├── jobs/           # BullMQ job processors
│   │   │   ├── workflows/      # WhatsApp state machine
│   │   │   └── app.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   └── ios/                    # SwiftUI iOS app
│       ├── Wanny's Nail/
│       └── NailBook.xcodeproj
├── docs/                       # This directory
├── scripts/                    # Dev/ops scripts
├── docker-compose.yml
├── .github/workflows/
└── README.md
```

---

## Documentation Index

| File | Description |
|---|---|
| [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | Full PRD — personas, user stories, functional and non-functional requirements |
| [TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md) | Architecture, component design, integration patterns |
| [UI_UX_SPECIFICATION.md](./UI_UX_SPECIFICATION.md) | iOS app design system, screen specs, user flows |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | C4 diagrams and sequence diagrams (Mermaid) |
| [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) | ERD, table definitions, Prisma schema |
| [API_SPECIFICATION.md](./API_SPECIFICATION.md) | OpenAPI-style endpoint documentation |
| [BOOKING_WORKFLOW.md](./BOOKING_WORKFLOW.md) | Booking lifecycle, availability engine |
| [PAYMENT_WORKFLOW.md](./PAYMENT_WORKFLOW.md) | M-Pesa STK Push flow, callbacks, reconciliation |
| [WHATSAPP_AUTOMATION.md](./WHATSAPP_AUTOMATION.md) | Conversational state machine, workflow engine |
| [SECURITY.md](./SECURITY.md) | Auth, authorization, encryption, KDPA compliance |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Docker, CI/CD, environments, monitoring |
| [DECISIONS.md](./DECISIONS.md) | Architecture Decision Records (ADRs) |

---

## Development Workflow

1. **Documentation first** — All features are specified in docs before any code is written.
2. **Schema first** — Database schema is finalized before writing service logic.
3. **API contract first** — API shapes are agreed before frontend/mobile work begins.
4. **Feature branches** — `feat/`, `fix/`, `chore/` prefixes; squash-merge to `main`.
5. **CI gates** — Tests, linting, and type-check must pass before merge.
6. **Staging before production** — Every release is deployed to staging and smoke-tested first.

---

## Local Development Quick Start

```bash
# Prerequisites: Node.js 20, Docker Desktop, pnpm

git clone https://github.com/eva003n/wanny-s-nails.git
cd wanny-s-nails

cp apps/api/.env.example apps/api/.env apps/api/.env.development apps/api/.env.production
# Fill in WhatsApp, Daraja, and other credentials

docker-compose up -d        # Starts PostgreSQL and Redis

cd apps/api
pnpm install
pnpm prisma migrate dev
pnpm dev                    # API on http://localhost:8000
```

For WhatsApp and Mpesa local testing, use ngrok to expose the webhook endpoint.
