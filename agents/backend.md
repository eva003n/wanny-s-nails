# Backend Rules

## Hard rules
- **Schema first.** Update `prisma/schema.prisma` before writing any service logic. Run `pnpm prisma migrate dev`.
- **No hard deletes.** Set `deletedAt = now()`. Global Prisma middleware filters soft-deleted rows automatically — never add `deletedAt: null` to individual queries.
- **Audit every state change.** Write to `audit_logs` inside the same DB transaction as the mutation.
- **Queue all external calls.** WhatsApp, STK Push, email — enqueue via BullMQ. Never call external APIs inline in a request handler.
- **UTC in DB, EAT in UI.** Store all datetimes as UTC. Use `date-fns-tz` with `Africa/Nairobi` for slot generation. The PWA handles EAT display.
- **Validate env at startup.** `shared/config.ts` uses a Zod `ConfigSchema`. The process exits if any required secret is missing.
- **Idempotent callbacks.** Daraja and WhatsApp webhook handlers check for duplicate processing before acting (see [domain.md](./domain.md) for specifics).

## Error handling
Throw typed `AppError` subclasses — never generic `Error`:
```typescript
throw new BookingConflictError();      // 409
throw new PaymentFailedError(code);    // 402
throw new NotFoundError('Booking');    // 404
```
Global error handler maps to: `{ error: { code, message, details } }`.  
Never expose stack traces or internal messages in production responses.

## Auth
| Role | Permissions |
|---|---|
| `OWNER` | All operations |
| `STAFF` | CRUD bookings, view customers, see payment status (not amounts) |

- Enforce with `requireRole(['OWNER'])` middleware.
- Webhook endpoints skip JWT — validate `X-Hub-Signature-256` instead.

## Adding an endpoint
1. Document it in `API_SPECIFICATION.md` first.
2. Add Zod validation schema.
3. Implement: route → service → Prisma → audit log.
4. Add integration test against `wannysnails_test` DB.
