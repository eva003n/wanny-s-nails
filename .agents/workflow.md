# Testing & Workflow

## Testing

### What to test where
| Type | Scope | DB |
|---|---|---|
| Unit | Pure functions: slot engine, FSM transitions, phone normalisation, AI intent detection | None |
| Integration | API modules end-to-end | `wannysnails_test` (real PostgreSQL) |
| Component | React components and hooks | None (React Testing Library) |

### Rules
- Test files colocated with source: `foo.ts` → `foo.test.ts`.
- Always mock: Daraja API, WhatsApp Cloud API, Gemini API.
- Never mock: Prisma, Redis (use real instances in integration tests).
- No snapshot tests in the PWA — they break too easily and catch nothing useful.

## Git workflow

### Branch naming
```
feat/bookings-reschedule
fix/payments-duplicate-callback
chore/db-reminder-index
```

### Commit format
```
feat(bookings): add reschedule endpoint
feat(web): add booking detail screen
fix(payments): handle duplicate Daraja callback
fix(web): fix SSE reconnect on network restore
chore(db): add index on reminders.scheduled_at
```
Scope = module name (`bookings`, `payments`, `web`, `db`, etc.).

### Rules
- No WIP commits to `main`.
- Squash-merge PRs.
- CI must pass (typecheck + lint + tests) before merge.

## Adding a new feature — checklist
1. Update the relevant spec doc in `docs/`.
2. Update `prisma/schema.prisma` if schema changes needed → `pnpm prisma migrate dev`.
3. Document the endpoint in `API_SPECIFICATION.md`.
4. **API:** schema → service → route → job/notification → integration test.
5. **PWA:** API hook → component → route → responsive check (mobile + desktop).
6. New WhatsApp template → add to `WHATSAPP_AUTOMATION.md`, submit to Meta, wait for approval before deploying.
7. New AI fallback behaviour → update system prompt in `workflows/ai-fallback.ts` + update `WHATSAPP_AUTOMATION.md`.
