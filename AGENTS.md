# AGENTS.md - Wanny's WhatsApp Booking System
## Project
Wanny's Nails — WhatsApp booking + M-Pesa payments for a Kenyan nail salon.
Stack: Node.js 20 / Express / TypeScript / Prisma / PostgreSQL / Redis / BullMQ / SwiftUI iOS.

## Docs (read before acting)
| File | Read when |
|---|---|
| `TECHNICAL_SPECIFICATION.md` | Architecture questions, integration patterns |
| `DATABASE_DESIGN.md` | Any schema or query work |
| `API_SPECIFICATION.md` | Adding/changing endpoints |
| `BOOKING_WORKFLOW.md` | Booking logic, slot engine, reminders |
| `PAYMENT_WORKFLOW.md` | Daraja STK Push, callbacks, reconciliation |
| `WHATSAPP_AUTOMATION.md` | FSM states, session handling, templates |
| `SECURITY.md` | Auth, validation, KDPA compliance |
| `DEPLOYMENT.md` | Env vars, Docker, CI/CD |

## Repo layout
```
apps/api/src/
  modules/      # bookings | payments | customers | slots | webhooks | auth
  workflows/    # WhatsApp FSM engine + state handlers
  jobs/         # BullMQ processors
  shared/       # middleware | lib (prisma, redis, queues) | utils
apps/ios/       # SwiftUI app
docs/           # All spec files above
```

## Non-negotiables
- **Schema first.** Update `prisma/schema.prisma` before writing service logic. Run `pnpm prisma migrate dev`.
- **Idempotent callbacks.** All Daraja + WhatsApp webhook handlers must check for duplicate processing before acting.
- **No hard deletes.** Set `deletedAt = now()`. Global Prisma middleware filters these automatically.
- **Audit every state change.** Write to `audit_logs` inside the same transaction as the mutation.
- **Queue all external calls.** WhatsApp messages, STK Push, email — enqueue via BullMQ, never call inline.
- **UTC in DB, EAT in UI.** Store all datetimes as UTC. iOS converts to `Africa/Nairobi` for display. Use `date-fns-tz` on the backend.
- **Validate env at startup.** Use the Zod `ConfigSchema` in `shared/config.ts`. App must not start with missing secrets.

## Error handling
- Throw typed `AppError` subclasses (`BookingConflictError`, `PaymentFailedError`, etc.).
- Global error handler maps them to `{ error: { code, message, details } }`.
- Never expose stack traces or internal messages in production responses.

## Auth rules
| Role | Can |
|---|---|
| `OWNER` | Everything |
| `STAFF` | CRUD bookings, view customers, see payment status (not amounts) |

Enforce with `requireRole(['OWNER'])` middleware. Webhook endpoints skip JWT — validate signatures instead.

## WhatsApp FSM rules
- Session key: `session:+254XXXXXXXXX` in Redis, TTL 1800s.
- Every state handler: load session → validate input → transition → save session → send messages.
- Invalid input ≥ 3× in one state → escalate to `HUMAN_ESCALATION`.
- Check `wamid` deduplication before processing (5-min Redis key).
- Always return HTTP 200 to WhatsApp immediately; process async.

## Booking slot rules
- Availability = business hours − blocked slots − existing non-cancelled bookings.
- Double-booking prevention: application-layer overlap check + partial unique DB index.
- Slot intervals: 30-minute boundaries (configurable).
- All times in EAT for slot generation logic, converted to UTC for storage.

## Payment rules
- STK Push: async via BullMQ. Update `payments.checkoutRequestId` after Daraja responds.
- Callback: idempotency on `mpesaReceiptNumber`. Verify `amount === booking.priceKes` before marking PAID.
- On failure: write `PaymentTransaction` record, update status, notify customer via queue.
- Never mutate `payment_transactions` rows — append only.

## Testing conventions
- Unit: pure functions (slot engine, FSM transitions, phone normalisation).
- Integration: modules with a real test DB (`wannysnails_test`).
- Mocks: Daraja + WhatsApp Cloud API always mocked in tests.
- Test file: `*.test.ts` colocated with source.

## Commit conventions
```
feat(bookings): add reschedule endpoint
fix(payments): handle duplicate Daraja callback
chore(db): add index on reminders.scheduled_at
```
Scope = module name. No WIP commits to `main`.

## When adding a new feature
1. Update the relevant spec doc in `docs/`.
2. Update `prisma/schema.prisma` if schema changes.
3. Add/update API spec in `API_SPECIFICATION.md`.
4. Implement: schema → service → route → job/notification → tests.
5. If new WhatsApp template needed: add to `WHATSAPP_AUTOMATION.md` and submit for Meta approval before deploying.
