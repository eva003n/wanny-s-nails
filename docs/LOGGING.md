# Logging

This project uses [Pino](https://github.com/pinojs/pino) for structured logging, replacing the previous Winston implementation.

## Logger Architecture

### Singleton Pattern
The logger is a singleton instance created at `src/shared/lib/logger.ts`. Always import from there. Never call `pino()` anywhere else.

```typescript
import { logger } from "../../shared/lib/logger.js";
```

### Module-Scoped Child Loggers
Each module creates its own child logger at the top of the file to automatically include the module context in all log entries:

```typescript
const log = logger.child({ module: "payments" });
```

Naming convention for `module` field:

| Location | Value |
|---|---|
| `modules/bookings/` | `"bookings"` |
| `modules/payments/` | `"payments"` |
| `modules/customers/` | `"customers"` |
| `modules/webhooks/` | `"webhooks"` |
| `modules/events/` | `"events"` |
| `modules/health/` | `"health"` |
| `modules/auth/` | `"auth"` |
| `modules/services/` | `"services"` |
| `modules/slots/` | `"slots"` |
| `modules/notifications/` | `"notifications"` |
| `modules/users/` | `"users"` |
| `jobs/reminders/` | `"jobs.reminders"` |
| `jobs/stk-push/` | `"jobs.stk-push"` |
| `workflows/` | `"workflows.fsm"` |

### Request-Scoped Logger
Inside route handlers and middleware, use `req.log` (bound to the request's `requestId`) instead of the module-level child logger:

```typescript
req.log.info({ bookingId }, "Approving booking");
```

Use the module child logger only in service functions that don't receive `req`:

```typescript
// service function — no req available
log.info({ bookingId, actorId }, "Booking approved");
```

## Log Levels

| Level | When |
|---|---|
| `log.error` | 5xx errors, unhandled exceptions, job exhausted all retries, Daraja/WhatsApp API failures |
| `log.warn` | 4xx client errors, payment amount mismatch, STK Push retry attempt, AI fallback triggered |
| `log.info` | Booking state changes, payment completed, reminder sent, session transitions |
| `log.debug` | Slot calculation details, FSM state loads/saves, cache hits/misses |

**Rule:** Never use `log.error` for 4xx errors — those are the client's fault, not yours.

## Log Shape

Always use structured logging with objects before the message string:

```typescript
// ✅ Correct — structured, queryable
log.info(
  { event: "booking.approved", bookingId, actorId, previousStatus: "PENDING" },
  "Booking approved",
);

log.error(
  { err, event: "payment.stk_push.failed", bookingId, attempt: job.attemptsMade },
  "STK Push failed",
);

log.warn(
  { event: "payment.amount_mismatch", bookingId, expected: 1500, received: 800 },
  "Payment amount mismatch — flagged for review",
);

// ❌ Wrong — unqueryable strings
log.info(`Booking ${bookingId} approved by ${actorId}`);
log.error(err.stack);
log.info(JSON.stringify(req.body));
```

### `event` Field — Required on All Domain Logs
Every log line for a domain action must include an `event` field using dot notation:

```
booking.created
booking.approved
booking.cancelled
booking.rescheduled
payment.stk_push.initiated
payment.stk_push.failed
payment.callback.received
payment.callback.amount_mismatch
payment.completed
reminder.sent
reminder.failed
whatsapp.message.received
whatsapp.message.sent
whatsapp.fsm.transition
whatsapp.ai_fallback.triggered
whatsapp.human_escalation.triggered
auth.login.success
auth.login.failed
health.check.database_failed
health.check.redis_failed
sse.client.connected
sse.client.disconnected
server.started
```

This allows log queries like `event = "payment.stk_push.failed" AND attempt = 3` in Better Stack.

## Error Objects

Always use the `err` key so Pino's error serializer captures `message`, `stack`, and `type` correctly:

```typescript
// ✅ Correct
log.error({ err, bookingId }, "Failed to approve booking");

// ❌ Wrong — Error properties are non-enumerable, logs {}
log.error({ error: err, bookingId }, "Failed to approve booking");

// ❌ Wrong — loses structure
log.error(err.message);
```

The logger has both `err` and `error` as serializer aliases, but use `err` as the standard.

## Environment-Specific Behavior

### Development
- Pretty-printed, colorized output via `pino-pretty`
- Format: `yyyy-mm-dd hh:MM:ss.l TT`
- No file or remote logging

### Production
- Raw JSON to stdout (machine-readable)
- Daily rotating log files:
  - **All logs:** `logs/app.log` (rotate daily, keep 14 days)
  - **Errors only:** `logs/app-error.log` (rotate daily, keep 30 days)
- Remote logging to Better Stack via `@logtail/pino`

## Sensitive Data Redaction

The logger automatically redacts these fields before any transport sees them:
- `req.headers.authorization`
- `req.headers.cookie`
- Any field ending in `.password`
- Any field ending in `.token`

Values are replaced with `[REDACTED]`.

## Configuration (Environment Variables)

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | Pino log level (trace, debug, info, warn, error, fatal) |
| `LOGTAIL_SOURCE_TOKEN` | `""` | Better Stack source token (prod only) |
| `LOGTAIL_INGESTION_HOST` | `""` | Better Stack endpoint (prod only) |

## HTTP Request Logging

HTTP logging is handled by `pino-http` via `src/shared/middleware/log.middleware.ts`:

- Automatically logs all incoming requests and responses
- Uses `req.log` for request-scoped logging
- Skips noisy routes: `/health`, `/favicon.ico`
- Log level based on response status code:
  - `info` for 2xx and 3xx
  - `warn` for 4xx
  - `error` for 5xx

## BullMQ Job Logging Pattern

Bind a job-scoped child logger at the start of every job processor:

```typescript
export async function processJob(job: Job<JobData>) {
  const jobLog = log.child({ jobId: job.id, bookingId: job.data.bookingId });

  jobLog.info({ attempt: job.attemptsMade + 1 }, "Job started");

  try {
    await doWork(job.data);
    jobLog.info("Job completed");
  } catch (err) {
    jobLog.error({ err, attempt: job.attemptsMade + 1 }, "Job failed");
    throw err; // re-throw so BullMQ retries
  }
}
```

Always re-throw after logging in job processors — swallowing the error prevents BullMQ from retrying.

## What to Never Log

```typescript
// ❌ PII / credentials — redaction covers these but don't rely on it
log.info({ user });             // full user object includes passwordHash
log.info({ body: req.body });   // may contain passwords
log.debug({ token });           // access or refresh tokens

// ✅ Log only IDs and non-sensitive context
log.info({ userId: user.id, role: user.role });
log.debug({ bodyKeys: Object.keys(req.body) });