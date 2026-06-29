# Architecture Decision Records — Wanny's Nails

**Format:** Each ADR documents a significant technical decision: context, decision, alternatives considered, and consequences.

---

## ADR-001: PostgreSQL as the Primary Database

**Date:** 2026
**Status:** Accepted

### Context

The platform needs a reliable, persistent store for bookings, customers, and payments. Data integrity is critical — a double-booking or a lost payment record would directly harm the business. The system is a single-tenant, single-salon deployment for now, with potential for multi-salon expansion.

### Decision

Use **PostgreSQL 18** as the primary relational database.

### Alternatives Considered

| Option | Reason Rejected |
|---|---|
| MySQL 8 | PostgreSQL's partial indexes, JSONB, and advisory locks are more useful for this domain. Community and tooling (especially Prisma) favour PG. |
| MongoDB | A booking system has highly relational data (bookings → customers → services → payments). Enforcing relational integrity in a document DB requires application-level discipline that relational DBs handle natively. |
| SQLite | Not suitable for production with concurrent writes from API + worker processes. |
| PlanetScale (MySQL serverless) | No foreign key enforcement by default. Branching workflow adds complexity for a small team. |

### Consequences

**Positive:**
- ACID transactions ensure booking + payment status are always consistent
- Partial indexes and row-level locking enable efficient slot availability queries
- Prisma has first-class PG support including typed raw SQL
- Excellent backup/restore tooling

**Negative:**
- Requires managed hosting (Railway/Render PG, or self-managed)
- Schema migrations require care (handled by Prisma Migrate)

---

## ADR-002: Prisma as the ORM

**Date:** 2026  
**Status:** Accepted

### Context

The backend is TypeScript-first. We need type-safe database access, readable query code, and a reliable migration system.

### Decision

Use **Prisma 5** as the ORM and migration tool.

### Alternatives Considered

| Option | Reason Rejected |
|---|---|
| Drizzle ORM | Newer, less ecosystem maturity, fewer contributors. Prisma's `$queryRaw` with full TypeScript is sufficient for complex queries. |
| TypeORM | Decorator-heavy, historically had many bugs with complex relations, slow development activity. |
| Knex.js (query builder) | Less type-safe. Would require manual type definitions for all entities. |
| Raw pg driver | Maximum control but maximum boilerplate. No migration tooling. |

### Consequences

**Positive:**
- Generated TypeScript types from schema — zero type drift between DB and app
- Prisma Migrate provides version-controlled, repeatable migrations
- Prisma Studio useful during development for inspecting data
- Excellent documentation and community

**Negative:**
- Prisma's generated client adds ~100ms cold start (acceptable for our scale)
- Complex aggregation queries sometimes require `$queryRaw` which loses type safety
- Prisma Middleware (for soft-delete filtering) has limited composability — documented clearly to avoid confusion

---

## ADR-003: Redis for Session State and Job Queue Backend

**Date:** 2026  
**Status:** Accepted

### Context

Two distinct needs: (1) WhatsApp conversation sessions need fast, TTL-aware key-value storage; (2) BullMQ (our chosen job queue) requires Redis as its backing store.

### Decision

Use **Redis 7** for both conversation session storage and as the BullMQ queue backend.

### Alternatives Considered

| Option | Reason Rejected |
|---|---|
| PostgreSQL for sessions | No native TTL. Would need a background job to clean expired sessions. Adds load to the primary DB for high-frequency reads/writes. |
| Memcached for sessions | No persistence. BullMQ requires Redis, so we'd need both. One less service to manage. |
| In-memory (Node.js Map) | Lost on process restart. Doesn't work with multiple worker instances. |

### Consequences

**Positive:**
- Sessions automatically expire via Redis TTL — no cleanup jobs needed
- BullMQ uses Redis for job persistence, delayed jobs, and pub/sub
- Single Redis instance serves both purposes
- Redis is fast enough for 500+ concurrent conversation sessions

**Negative:**
- Another service to manage and back up
- Redis failure means active sessions are lost (acceptable — customers restart their conversation) and queued jobs need recovery from AOF
- Redis AOF persistence must be enabled (not default) for job durability

---

## ADR-004: BullMQ for Job Queue

**Date:** 2026  
**Status:** Accepted

### Context

Several operations must be processed asynchronously: STK Push initiation, WhatsApp message sending, reminder scheduling, and appointment completion. These need: retry logic, delay scheduling (for reminders), job persistence, and visibility into queue health.

### Decision

Use **BullMQ** (Redis-backed job queue for Node.js).

### Alternatives Considered

| Option | Reason Rejected |
|---|---|
| Bull (predecessor) | BullMQ is the actively maintained successor with better TypeScript support and concurrency model. |
| Agenda (MongoDB-backed) | We're already using PostgreSQL and Redis. Adding MongoDB for queuing is unnecessary. |
| node-cron | No retry logic, no persistence, no job history. Not suitable for critical operations like payment initiation. |
| AWS SQS | External dependency, more complex setup, adds latency. Overkill for single-salon scale. |
| Inngest | Interesting but cloud-only, adds cost and external dependency. |

### Consequences

**Positive:**
- Delayed jobs enable precise reminder scheduling (enqueue once at booking approval, auto-fire at the right time)
- Built-in retry with exponential backoff
- Job deduplication via `jobId` prevents double-sending reminders on server restart
- Bull Board provides a UI for ops visibility

**Negative:**
- Tied to Redis availability
- BullMQ's TypeScript types have some rough edges with complex job data generics (documented workaround in codebase)

---

## ADR-005: WhatsApp Cloud API (Meta) for Customer Messaging

**Date:** 2026  
**Status:** Accepted

### Context

Customers are to interact exclusively through WhatsApp. We need to send and receive WhatsApp messages programmatically.

### Decision

Use **Meta WhatsApp Cloud API** (the hosted, cloud-based API).

### Alternatives Considered

| Option | Reason Rejected |
|---|---|
| WhatsApp Business API (On-Premise) | Self-hosted, requires significant infrastructure. Meta is ending support for the on-premise version. Cloud API is the official successor. |
| Twilio WhatsApp | Intermediary adds cost and latency. Direct Meta API is faster and cheaper at scale. Twilio's WhatsApp routes through Meta anyway. |
| 360dialog | Similar intermediary concerns. Direct API preferred. |
| Telegram Bot API | Target users are on WhatsApp, not Telegram. Not substitutable. |
| SMS-only | WhatsApp supports rich interactive messages (buttons, lists) that significantly improve the booking UX. Email is a fallback, not primary. |

### Consequences

**Positive:**
- Direct API, no intermediary cost
- Supports interactive messages (buttons, lists) — essential for the FSM UX
- Template management directly in Meta Business Manager
- Well-documented, stable API

**Negative:**
- Must comply with WhatsApp Business policies (template approval, opt-in requirements)
- Meta can change API terms/pricing
- Template approval takes 1–3 business days — plan ahead for new message templates
- Free tier limits (1000 service conversations/month) — will need paid tier at scale

---

## ADR-006: Daraja M-Pesa API v3 for Payments

**Date:** 2026  
**Status:** Accepted

### Context

The business operates in Kenya. The vast majority of customers pay via M-Pesa. We need to initiate payments programmatically and receive confirmation.

### Decision

Use **Safaricom Daraja API v3** (Lipa na M-Pesa / STK Push).

### Alternatives Considered

| Option | Reason Rejected |
|---|---|
| Daraja API v1/v2 | v3 is the current recommended version with improved security and response formats. No reason to use older versions for a new project. |
| Stripe | Minimal M-Pesa support in Kenya at time of decision. Cards have low penetration among the target demographic. |
| Flutterwave | Supports M-Pesa but as an intermediary — higher fees, more abstraction. Direct Daraja integration is preferred for a Kenya-only product. |
| Pesapal | Similar intermediary concerns. |
| Cash only | Defeats the purpose of the platform — reducing manual payment tracking is a core goal. |

### Consequences

**Positive:**
- STK Push delivers the payment directly to the customer's phone — no redirection, no app download
- M-Pesa is the dominant payment method for the target customer segment
- Direct integration, no intermediary fees

**Negative:**
- Daraja API can be slow (STK Push initiation can take 3–10 seconds) — mitigated by async processing
- Callbacks can be delayed or duplicated — requires idempotency handling
- Sandbox environment uses different credentials and simulates limited scenarios
- Safaricom's API reliability is lower than Western payment processors — retry logic is essential
- Amount must be in whole KES (no fractional amounts)

---

## ADR-007: Deterministic Workflow Engine instead of Agentic AI

**Date:** 2026  
**Status:** Accepted

### Context

The WhatsApp customer interaction could be powered by an LLM (e.g., GPT-4o) or by a deterministic finite state machine. We need to decide which approach.

### Decision

Use a **deterministic finite state machine (FSM)** for all WhatsApp customer interactions.

### Alternatives Considered

| Option | Reason Rejected |
|---|---|
| GPT-4o / Claude as booking agent | Per-message API cost (estimated KES 5–15/conversation at current rates) adds up quickly. Non-deterministic: hard to test and debug. Hallucinations could cause incorrect bookings or financial errors. Latency adds 2–5s per message. Compliance risk: LLM may generate responses that violate WhatsApp policies. |
| Rasa (self-hosted NLU) | Complex to set up and maintain. NLU adds value for open-ended conversations, not for bounded booking flows. |
| Hybrid (FSM + LLM for fallback) | Added complexity. The FSM handles all required use cases. Human escalation is the appropriate fallback for the rare edge case, not an LLM. |

### Consequences

**Positive:**
- Zero AI cost per conversation
- Completely deterministic and testable (unit tests for each state transition)
- Fast: state transitions complete in < 50ms (DB query + Redis read/write)
- Easy to audit: every decision is a known code path
- Easy to extend: add a new state file for new workflows

**Negative:**
- Cannot handle free-form input (e.g., "Can I book a gel manicure for next Tuesday at 2?")
- Numbered-menu UX is less natural than conversational NLU
- New workflows require developer involvement (no no-code configuration)

**Mitigation:** The numbered-menu UX is well-understood by Kenyan WhatsApp users (widely used by banks, utilities). Human escalation handles the < 5% of conversations that don't fit the workflow.

---

## ADR-008: Web app (React js) for Admin App

**Date:** 2026  
**Status:** Accepted

### Context

The salon owner uses an iPhone. Staff may use a any device iphone or android.
 

### Decision
Build a **PWA app with React**.

The deployment platform is mostly iphone for now and the client plans to add a laptop as a secondary device(non deterministic where macos, windows)

Apple deployments require apple developer account that cost $99/year(12,870ksh)

### Alternatives Considered

| Option | Reason Rejected |
|---|---|
| React Native | Cross-platform is valuable . The salon's devices can be ios or andriod. React Native adds build complexity for no benefit here. Plus still needs an apple developer account costing $99/year |
| Flutter | Same concern as React Native. |
| Progressive Web App (PWA) | Web apps cannot access APNs for real-time push notifications without workarounds. iOS PWA support is still limited. The booking approval notification experience would be degraded but since whatsapp notifies the owner of booking this is acceptable as a fallback|
| Expo (React Native) | Same as React Native concerns, plus Expo's managed workflow limits native module access. |

### Consequences

**Positive:**
- Limited access to iOS APIs: APNs (push notifications), Keychain, CoreData, WidgetKit (future)
- Even android users can use the admin app
- No App Store reviews, adds 1–3 days to each release
- Does not requires macOS + Xcode for development
- No learning a new language
- No need for apple developer account thus no costs
**Negative:**
- Limited access to ios native features
 
## ADR-010: Processes
Each process handles a single responsibility, if it crashes it does not affect the other and can scale independenntly

Four processes
- API process(main)
- Payments process(worker)
- Conversation process(worker)
- Notification process(worker)