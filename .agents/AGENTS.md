# AGENTS.md — Wanny's Nails

WhatsApp booking + M-Pesa payments for a Kenyan nail salon — Node.js/Express API,
React 19 PWA, BullMQ workers, and a shared packages library (pnpm monorepo).

**Toolchain:** Node.js `22.21.1` (`.nvmrc`), pnpm `10.32.1`. Worktree defined in `pnpm-workspace.yaml`.

## Coding styles
- TypeScript strict mode, no `any` types
- Use named exports, not default exports

## Commands
Run everything per-app with `pnpm --filter <app> <script>`; `apps/packages/core` is built first and consumed by api + workers.

| Task | Command |
|---|---|
| Install | `pnpm install` |
| API dev | `pnpm dev:api` (or `cd apps/api && pnpm dev`) — port 8000 |
| PWA dev | `pnpm dev:web` (or `cd apps/web && pnpm dev`) — port 5173 |
| Lint (api, web) | `pnpm --filter ./apps/api lint` · `pnpm --filter ./apps/web lint` |
| Typecheck | `pnpm --filter <app> typecheck` (api, web, workers/*); `pnpm --filter ./apps/packages/core typecheck` |
| Unit / component test | `pnpm --filter <app> test` (api, web, packages/core, workers/*) |
| Single test file | `pnpm --filter <app> exec vitest run <path/to/file.test.ts>` |
| Single test by name | `pnpm --filter <app> exec vitest run <path/to/file.test.ts> -t "<test name>"` |
| Integration tests | run inside `apps/api` `test` — needs real Postgres (`test`) + Redis up |
| E2E (Playwright) | `pnpm --filter ./apps/web test:e2e` |
| Single E2E spec | `pnpm --filter ./apps/web exec playwright test <path/to/file.spec.ts>` |
| Prisma (schema lives in packages/core) | `pnpm --filter ./apps/packages/core db:migrate` · `db:seed` · `prisma:generate` — all `--config prisma/prisma.config.ts` |

## Repo layout
```
apps/api/src/
  modules/    # auth | bookings | business-hours | customers | dashboard | events
              # health | notifications | payments | push-subscriptions | services
              # slots | webhooks
  shared/     # middleware | lib | utils | types

apps/packages/core/src/         # @wannys-nails/core — shared domain (booking), utils,
                           # notification schemas; Prisma schema + seed live here (prisma/)

apps/web/src/
  pages/      # dashboard | bookings | customers | payments | settings | notifications
  components/ # layout + ui (dumb components)
  hooks/      # useSSE, useOnline, usePushSubscription, data-hooks
  lib/        # api client, auth, schemas, sse, IndexedDB
  store/      # Zustand (auth, ui)
  tests/      # unit | integration | e2e (Playwright)

apps/workers/
  conversation/  # WhatsApp FSM + Gemini AI fallback (states/, engine, processors)
  payment/       # M-Pesa STK Push + callback + verification
  notification/  # email / whatsapp / web-push senders

docs/         # All spec files
```

## Rules by area

| Area | File |
|---|---|
| Backend architecture, DB, API design | [backend.md](./backend.md) |
| PWA conventions, components, routing | [frontend.md](./frontend.md) |
| WhatsApp FSM + Gemini AI fallback | [whatsapp.md](./whatsapp.md) |
| Booking and payment logic | [domain.md](./domain.md) |
| Testing and git workflow | [workflow.md](./workflow.md) |

## Spec docs (read before acting)
**Ignore** the `RESEARCH.md` file

| File | Read when |
|---|---|
| `TECHNICAL_SPECIFICATION.md` | Architecture questions |
| `DATABASE_DESIGN.md` | Schema or query work |
| `API_SPECIFICATION.md` | Adding/changing endpoints |
| `BOOKING_WORKFLOW.md` | Booking logic, slot engine |
| `PAYMENT_WORKFLOW.md` | Daraja STK Push, callbacks |
| `WHATSAPP_AUTOMATION.md` | FSM states, AI fallback |
| `SECURITY.md` | Auth, KDPA compliance |
| `UI_UX_SPECIFICATION.md` | PWA screens, design tokens |
| `PROGRESSIVE_WEB_APPS.md` | PWA setup, service worker, offline behaviour |
| `DEPLOYMENT.md` | Env vars, Docker, CI/CD |

## Git branches
- **feature/`<name>`** - each feature get implemented in a new branch
- **dev** = for development related tasks 
- **staging** - staging environment that similar to production,
- **main** - live code in production