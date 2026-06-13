# AGENTS.md — Wanny's Nails

WhatsApp booking + M-Pesa payments for a Kenyan nail salon (Node.js API + React PWA).

**Package manager:** pnpm

## Commands
| Task | Command |
|---|---|
| Install | `pnpm install` |
| API dev | `cd apps/api && pnpm dev` (port 8000) |
| PWA dev | `cd apps/web && pnpm dev` (port 5173) |
| Typecheck | `pnpm typecheck` |
| Test | `pnpm test` |
| DB migrate | `cd apps/api && pnpm prisma migrate dev` |

## Repo layout
```
apps/api/src/
  modules/    # bookings | payments | customers | slots | webhooks | auth
  workflows/  # WhatsApp FSM + AI fallback
  jobs/       # BullMQ processors
  shared/     # middleware | lib | utils

apps/web/src/
  pages/      # Dashboard | Bookings | Customers | Payments | Settings
  components/
  hooks/      # useApi | useSSE | useAuth
  lib/        # API client | shared types

docs/         # All spec files
```

## Rules by area

| Area | File |
|---|---|
| Backend architecture, DB, API design | [backend.md](./agents/backend.md) |
| PWA conventions, components, routing | [frontend.md](./agents/frontend.md) |
| WhatsApp FSM + Gemini AI fallback | [whatsapp.md](./agents/whatsapp.md) |
| Booking and payment logic | [domain.md](./agents/domain.md) |
| Testing and git workflow | [workflow.md](./agents/workflow.md) |

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
| `DEPLOYMENT.md` | Env vars, Docker, CI/CD |

