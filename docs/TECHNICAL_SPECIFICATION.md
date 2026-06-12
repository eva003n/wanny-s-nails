# Technical Specification — Wannny's Nails

**Version:** 1.0  
**Status:** Approved

---

## Architecture Overview

Wanny's Nails is a three-tier system:

1. **Presentation layer** — WhatsApp Cloud API (customer) and PWA (salon staff/owner)
2. **Application layer** — Node.js/Express REST API with background job processing via BullMQ
3. **Data layer** — PostgreSQL (primary store) and Redis (sessions, cache, job queue)

The system is event-driven at its edges: WhatsApp sends webhooks, Daraja sends payment callbacks, and BullMQ drives all async work (reminders, retries, notifications).

---

## Design Principles

1. **Workflow over AI** — The WhatsApp bot uses a deterministic finite state machine. No LLM at runtime. This ensures predictable behaviour, zero per-message AI cost, and easier debugging.
2. **Queue everything async** — Any operation that touches an external API (WhatsApp, Daraja, Email) is handled by a BullMQ job, not inline in the request handler.
3. **Idempotency at all edges** — Daraja callbacks, WhatsApp webhook deliveries, and queue jobs are all designed to be processed multiple times safely.
4. **Schema-first** — Prisma schema is the single source of truth for the data model. Types are generated from it.
5. **Fail loudly in development, fail gracefully in production** — Errors are logged with full context; users receive friendly messages; the system does not crash.
6. **Soft delete everything** — No booking, customer, or payment record is ever hard-deleted.

7. **AI as fallback** - use AI as a fallback for sistuations that the finite machine cannot handle

---

## System Context Diagram

See [ARCHITECTURE.md](./ARCHITECTURE.md) for Mermaid diagrams.

```
┌─────────────┐     WhatsApp messages      ┌─────────────────────┐
│  Customer   │◄──────────────────────────►│  WhatsApp Cloud API  │
│  (phone)    │                            └──────────┬──────────┘
└─────────────┘                                       │ webhook POST
                                                      ▼
┌─────────────┐     HTTPS REST API         ┌─────────────────────┐
│  iOS App    │◄──────────────────────────►│   WAnny's Nail Backend   │
│(owner/staff)│                            │   (Express + TS)     │
└─────────────┘                            └──┬───────┬───────┬──┘
                                              │       │       │
                                         ┌────┘  ┌────┘  ┌────┘
                                         ▼       ▼       ▼
                                     Postgres  Redis  BullMQ
                                                         │
                                              ┌──────────┼──────────┐
                                              ▼          ▼          ▼
                                          Daraja    WhatsApp    Resend
                                          M-Pesa    Cloud API   Email
```

---

## High-Level Architecture

### Backend API (apps/api)

```
src/
├── app.ts                  # Express app factory
├── index.ts                # HTTP server entry point
├── modules/
│   ├── auth/               # Login, refresh, logout
│   ├── bookings/           # Booking CRUD, state machine
│   ├── customers/          # Customer profiles
│   ├── payments/           # STK Push, callbacks
│   ├── notifications/      # Reminder scheduling
│   ├── services/           # Salon service catalogue
│   ├── slots/              # Availability engine
│   └── webhooks/           # WhatsApp + Daraja webhook handlers
├── shared/
│   ├── middleware/         # Auth, error handler, rate limiter
│   ├── lib/                # Redis client, Prisma client, queue setup
│   ├── types/              # Shared TS types
│   └── utils/              # Date/time, phone number helpers
├── jobs/
│   ├── reminders/          # 24h and 1h reminder processors
│   ├── payments/           # Payment job processor
│   └── notifications/      # WhatsApp/SMS/email dispatch
└── workflows/
    ├── engine.ts           # WhatsApp FSM engine
    └── states/             # One file per FSM state
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| `modules/bookings` | Booking lifecycle: create, approve, cancel, reschedule. Calls slot engine to verify availability before mutating. Emits domain events for downstream processing. |
| `modules/payments` | Initiates STK Push via Daraja. Handles callbacks. Updates booking payment status. Records all transaction attempts. |
| `modules/slots` | Computes available slots given business hours, service duration, and existing bookings. Pure function — no side effects. |
| `modules/webhooks` | Receives and validates incoming webhooks. Parses message content, delegates to the FSM engine. Responds with HTTP 200 immediately (async processing). |
| `workflows/engine` | Stateless FSM runner. Loads session from Redis. Executes the transition function for the current state + input. Saves updated session to Redis. Sends outbound WhatsApp messages. |
| `jobs/reminders` | BullMQ processor. Queries bookings with upcoming appointments. Sends WhatsApp reminders via the WhatsApp module. Marks reminder as sent in the DB. |
| `jobs/payments` | BullMQ processor. Calls Daraja STK Push endpoint. Handles retries on failure. |

---

## Backend Design

### Request Lifecycle

```
Incoming HTTP Request
        │
        ▼
Rate Limiter (express-rate-limit)
        │
        ▼
Auth Middleware (JWT verification)
        │
        ▼
Request Validation (Zod schemas)
        │
        ▼
Route Handler
        │
        ▼
Service Layer (business logic)
        │
        ▼
Prisma ORM ──► PostgreSQL(Repository)
        │
        ▼
Response serialisation
        │
        ▼
HTTP Response
```

Errors at any stage are caught by a global error handler that maps domain errors to HTTP status codes and returns a consistent `{ error: { code, message, details } }` shape.

### Error Response Shape

```json
{
  "error": {
    "code": "BOOKING_SLOT_UNAVAILABLE",
    "message": "The selected time slot is no longer available.",
    "details": {}
  }
}
```

### Environment Configuration

All configuration is injected via environment variables and validated at startup using Zod. The application refuses to start if required variables are missing.

```typescript
// src/shared/config.ts
const ConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  WHATSAPP_ACCESS_TOKEN: z.string(),
  WHATSAPP_PHONE_NUMBER_ID: z.string(),
  WHATSAPP_VERIFY_TOKEN: z.string(),
  DARAJA_CONSUMER_KEY: z.string(),
  DARAJA_CONSUMER_SECRET: z.string(),
  DARAJA_SHORTCODE: z.string(),
  DARAJA_PASSKEY: z.string(),
  DARAJA_CALLBACK_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().default(3000),
});
```

---

## Progressive Web App Design

### Architecture Pattern

The PWA app use:

```
UI (React Components / Pages)
            │
            ▼
State Layer (React Query + Zustand/Context)
            │
            ▼
      Service Layer
            │
            ▼
API Client (Fetch / Axios)
            │
            ▼
       Backend API
```

### Key Design Decisions
- **React throughout** — Responsive design optimized for iPhone Safari and desktop browsers.
- **TypeScript** — End-to-end type safety across the application.
- **React Query (TanStack Query)** — Handles server state, caching, background refetching, and loading states.
- **Zustand (or Context API)** — Manages client-side UI state such as filters, modals, and authentication status.
- **Secure Authentication** — Access tokens stored in HTTP-only cookies. No JWTs stored in localStorage.
- **PWA Support** — Installable via "Add to Home Screen" with service worker support for offline access.
- **IndexedDB** — Used for offline caching of today's schedule and recently viewed customer data.
- **Push Notifications (Optional)** — Web Push API can be used where supported; business-critical reminders should be sent through WhatsApp, SMS, or email rather than relying solely on browser notifications.

### State Management
Business logic is separated from UI components.
```
Page / Component
       │
       ▼
Custom Hook
(useBookings, useSchedule)
       │
       ▼
  Service Layer
       │
       ▼
   API Client
```

### Offline Behaviour
- Today's schedule is cached in IndexedDB and displayed immediately while fresh data is fetched in the background.
- Recently viewed customer records remain available offline.
- Write operations (approve, cancel, reschedule) require network connectivity.
- When offline, the application displays a persistent connectivity banner and disables actions that require server communication.
- Once connectivity is restored, React Query automatically refreshes stale data.

#### PWA-Specific Features
- Installable on the owner's iPhone home screen.
- Full-screen app-like experience.
- Service Worker caches application assets for fast startup.
- Automatic updates on deployment.
- No App Store approval process.
- Works on iPhone, Android, tablet, and desktop from the same codebase.
---

```
web/
├── README.md
├── eslint.config.js
├── index.html
├── package.json
├── pnpm-lock.yaml
├── public
│   └── favicon.svg
├── pwa-assets.config.ts
├── src
│   ├── App.css
│   ├── App.tsx
│   ├── PWABadge.css
│   ├── PWABadge.tsx
│   ├── assets
│   ├── components
│   ├── hooks
│   ├── index.css
│   ├── lib
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── indexdb.ts
│   ├── main.tsx
│   ├── pages
│   │   ├── bookings
│   │   ├── customers
│   │   ├── dashboard
│   │   ├── payments
│   │   └── settings
│   ├── services
│   │   ├── booking.service.ts
│   │   ├── customer.service.ts
│   │   └── payment.service.ts
│   ├── store
│   │   └── auth.store.ts
│   ├── types
│   └── vite-env.d.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## WhatsApp Integration Design

### Overview

The WhatsApp integration uses Meta's WhatsApp Cloud API. The backend:
1. Receives incoming messages via webhook POST
2. Validates the payload with the Meta signature header
3. Passes the message to the FSM engine
4. Sends outbound messages via the Send Message REST API

### Message Types Used

| Type | Purpose |
|---|---|
| `text` | General responses, confirmations |
| `interactive/button` | Choices with up to 3 buttons (e.g., Yes/No/Cancel) |
| `interactive/list` | Menus with up to 10 items (service selection, date selection) |
| `template` | Approved templates for reminders, notifications (required for 24h+ re-engagement) |

### Template Management

WhatsApp requires pre-approved templates for messages sent outside the 24-hour customer service window. The following templates must be submitted and approved:

| Template Name | Trigger | Variables |
|---|---|---|
| `appointment_reminder_24h` | 24h before appointment | `{{customer_name}}`, `{{service}}`, `{{date}}`, `{{time}}` |
| `appointment_reminder_1h` | 1h before appointment | `{{customer_name}}`, `{{service}}`, `{{time}}` |
| `booking_confirmed` | Booking approved | `{{booking_ref}}`, `{{service}}`, `{{date}}`, `{{time}}` |
| `payment_received` | Payment confirmed | `{{booking_ref}}`, `{{amount}}` |
| `booking_cancelled` | Booking cancelled | `{{service}}`, `{{date}}` |
| `booking_rescheduled` | Booking rescheduled | `{{service}}`, `{{new_date}}`, `{{new_time}}` |

### Webhook Verification

```
GET /webhooks/whatsapp?hub.mode=subscribe&hub.challenge=xxx&hub.verify_token=yyy

Verify: hub.verify_token === process.env.WHATSAPP_VERIFY_TOKEN
Response: hub.challenge (plain text)
```

### Message Signature Validation

```typescript
const signature = req.headers['x-hub-signature-256'] as string;
const payload = req.rawBody; // must capture raw bytes
const expectedSig = 'sha256=' + hmacSha256(payload, WHATSAPP_APP_SECRET);
if (!timingSafeEqual(signature, expectedSig)) throw new UnauthorizedError();
```

---

## Daraja Integration Design

### API Version

M-Pesa Daraja API v3 (Safaricom).

### STK Push Flow (Lipa na M-Pesa Online)

```
1. Backend generates a timestamp: YYYYMMDDHHMMSS (EAT)
2. Backend generates a password: base64(ShortCode + Passkey + Timestamp)
3. POST to Daraja /mpesa/stkpush/v3/processrequest
4. Daraja sends STK Push to customer's phone
5. Customer approves on their phone
6. Daraja POSTs result to our callback URL
7. Backend updates payment + booking status
```

### Request Body (STK Push)

```json
{
  "BusinessShortCode": "174379",
  "Password": "<base64 encoded>",
  "Timestamp": "20250601120000",
  "TransactionType": "CustomerPayBillOnline",
  "Amount": 1500,
  "PartyA": "254712345678",
  "PartyB": "174379",
  "PhoneNumber": "254712345678",
  "CallBackURL": "your domain",
  "AccountReference": "NB-2025-00123",
  "TransactionDesc": "Nail appointment payment"
}
```

### Callback Processing

```typescript
// Idempotency: check if MpesaReceiptNumber already exists before processing
const existing = await prisma.paymentTransaction.findUnique({
  where: { mpesaReceiptNumber: callback.Body.stkCallback.CallbackMetadata?.Item
    .find(i => i.Name === 'MpesaReceiptNumber')?.Value }
});
if (existing) return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
```

### Failure Handling

| Scenario | Handling |
|---|---|
| STK Push timeout (customer didn't respond) | ResultCode 1032 — mark payment as EXPIRED, notify customer, offer retry |
| Customer cancelled on phone | ResultCode 1 — mark as CANCELLED, notify |
| Network error reaching Daraja | Retry job up to 2 times with 30s backoff |
| Duplicate callback | Idempotency check on MpesaReceiptNumber |
| Amount mismatch | Mark as DISPUTED, alert owner, do not confirm booking |

---

## Queue Architecture

### Queues

| Queue Name | Job Types | Concurrency | Retry |
|---|---|---|---|
| `notifications` | whatsapp-message, email | 10 | 3, exponential backoff |
| `payments` | stk-push, payment-verify | 5 | 2, 30s backoff |
| `reminders` | reminder-24h, reminder-1h | 10 | 3 |
| `bookings` | booking-timeout, slot-release | 5 | 2 |

### Job Definition Pattern

```typescript
// All jobs are typed
interface ReminderJobData {
  bookingId: string;
  type: '24h' | '1h';
  customerPhone: string;
  customerName: string;
  service: string;
  appointmentAt: string; // ISO datetime
}

// Scheduled on booking approval
await reminderQueue.add(
  'reminder-24h',
  jobData,
  { delay: millisUntil24hBefore, attempts: 3, backoff: { type: 'exponential', delay: 60000 } }
);
```

### Dead Letter Queue

Jobs that exhaust all retries are moved to a `dead-letter` queue. A daily alert is sent to the system administrator with the count and details. Manual intervention is required to replay or discard.

---

## State Machine Design

See [WHATSAPP_AUTOMATION.md](./WHATSAPP_AUTOMATION.md) for full detail.

### Summary of States

```
IDLE → GREETING → SERVICE_SELECTION → DATE_SELECTION
     → TIME_SELECTION → BOOKING_CONFIRMATION
     → PAYMENT_PENDING → PAYMENT_COMPLETED → IDLE

From any state:
  "cancel" → CANCELLATION_FLOW
  "reschedule" → RESCHEDULING_FLOW
  "my appointment" → LOOKUP_FLOW
  timeout (30m) → IDLE (session cleared)
```

---

## Error Handling

### Domain Error Hierarchy

```typescript
class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) { super(message); }
}

class BookingConflictError extends ApiError {
  constructor() { super('BOOKING_SLOT_UNAVAILABLE', 409, 'Slot is no longer available'); }
}

class PaymentFailedError extends ApiError {
  constructor(mpesaCode: number) {
    super('PAYMENT_FAILED', 402, 'M-Pesa payment was not completed', { mpesaCode });
  }
}
```

### Global Error Handler
```typescript
// apps/api/src/shared/middleware/error.middleware.ts
export const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, path: req.path }, err.message);
    return res.status(err.httpStatus).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  logger.error({ err, path: req.path }, 'Unhandled error');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
} 
```

``` typescript
// apps/api/src/app.ts
import {errorMiddleware} from "shared/middleware.ts"

app.use(errorMiddleware);

```
### Global async handler
Prevent repeated use of try catch on each request handler

``` typescript
// apps/api/src/shared/utils/asynchandler.ts
import type {RequestHandler} from "express"

const asyncHandler = (requestFunc: RequestHandler) => {
    return (req: Request, res: Response, next: NextFunction) => Promise.resolve(requestFunc(req, res, next)).catch((err) => {
        return next(err)
    })
}
```
---

## Monitoring Strategy

### Metrics to Track

| Metric | Tool | Alert Threshold |
|---|---|---|
| API response time p95 | Better Stack | > 500ms |
| Error rate | Sentry | > 1% of requests |
| Queue depth (notifications) | BullMQ + Redis | > 500 jobs |
| Failed jobs count | BullMQ dashboard | > 10 in 1h |
| Daraja callback rate | Custom metric | < 80% success in 1h |
| WhatsApp message delivery rate | Meta dashboard | < 95% |
| Database connection pool usage | pg stats | > 80% |

### Structured Logging

All logs use structured JSON via `pino`:

```typescript
logger.info({
  event: 'booking.created',
  bookingId: booking.id,
  customerId: customer.id,
  service: booking.service.name,
  durationMs: Date.now() - start,
}, 'Booking created');
```

Log levels: `error` (alerts), `warn` (attention needed), `info` (normal operations), `debug` (development only).

---

## Scalability Considerations

### Current Scale Targets
- 50 bookings/day (single salon)
- 200 WhatsApp conversations/day
- 3 staff users on iOS app

### Scaling Path

| Bottleneck | Current | Next Step |
|---|---|---|
| API throughput | Single instance | Horizontal scaling behind load balancer |
| DB connections | Prisma connection pooling (20) | PgBouncer |
| Queue throughput | Single BullMQ instance | Multiple worker instances |
| WhatsApp rate limits | 1000 messages/day (free tier) | Business tier (unlimited) |

