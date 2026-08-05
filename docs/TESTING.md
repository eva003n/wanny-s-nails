# Testing Guide — Wanny's Nails

This document is the single source of truth for how tests are written across this
monorepo. It applies equally to a human contributor and to an AI coding agent
working in this repo — if you are an agent, treat every rule here as binding
unless a task explicitly overrides it.

**Prime directive: a test that doesn't fail when the code is wrong is worse than
no test.** Coverage percentage is not a goal. A passing suite that would still
pass after deleting the business logic is a liability, not an asset — it hides
regressions instead of catching them.

---

## 1. Monorepo layout and where tests live

```
apps/
  api/            Express + Prisma + BullMQ backend, WannyBot logic
    vitest.config.ts
    src/
  web/            React 19 + Vite PWA admin dashboard
    vitest.config.ts
    src/
  packages/
      vitest.config.ts   (only if the package has logic worth testing directly)    
vitest.workspace.ts       root — orchestrates all of the above
```

- Test files live **next to the code they test**, not in a parallel `__tests__`
  tree: `bookingService.ts` → `bookingService.test.ts` in the same folder.
- Each app owns its own `vitest.config.ts` with its own `test.environment`
  (`node` for `apps/api`, `jsdom` for `apps/web`). Never share one root config
  across apps with conditional branching — see the earlier discussion in this
  repo's history for why that caused problems with Jest.
- Naming: `*.test.ts` / `*.test.tsx` for unit and component tests.
  `*.integration.test.ts` for anything touching a real DB, Redis, or Docker
  service. This split lets CI run fast unit tests on every push and slower
  integration tests on a narrower trigger (see §8).

---

## 2. The testing pyramid — non-negotiable ratio

```
        /\
       /E2E\        ~10% — Playwright, full booking/payment flows
      /------\
     /Integr. \     ~20% — Supertest + real test DB/Redis, RTL + MSW
    /----------\
   /   Unit     \   ~70% — pure functions, isolated components, FSM transitions
  /--------------\
```

If a feature can be verified with a unit test, it must have one, even if it
also gets integration/E2E coverage later. Do not skip straight to an
integration or E2E test "because it's more realistic" — that's slower
feedback and harder-to-diagnose failures for logic a unit test would catch
in milliseconds.

---

## 3. What "prod-grade" means, concretely

A test in this repo must satisfy all of the following. An agent generating
tests should self-check against this list before considering a test complete.

1. **It asserts behavior, not implementation.** Don't assert that a private
   helper was called with specific internal arguments; assert the observable
   outcome (HTTP response, DB state, rendered UI, emitted job).
2. **It fails when the logic is wrong.** Before finalizing a test, mentally
   (or actually) break the implementation and confirm the test goes red. A
   test that stays green under a broken implementation must be rewritten.
3. **It is deterministic.** No reliance on real wall-clock time without
   mocking it (`vi.useFakeTimers()`), no reliance on network calls to real
   third parties (Daraja, WhatsApp Business API) — always intercepted via
   `nock` or MSW. No test may depend on execution order or leftover state
   from another test.
4. **It cleans up after itself.** DB rows created in a test are removed
   (`beforeEach`/`afterEach` reset — see §5), mocks are cleared
   (`clearMocks: true` is set globally, but explicit `vi.restoreAllMocks()`
   in `afterEach` is required wherever `vi.spyOn` is used on a module with
   side effects).
5. **It tests the boundary that actually matters.** For a Daraja webhook
   handler, the boundary is "given this HTTP payload, what DB state and
   side effects result" — not "was `axios.post` called." Mock only what's
   external to the system under test; don't mock your own domain logic.
6. **Edge cases are explicit, not implied.** For anything financial
   (KES amounts, M-Pesa amounts, tax-style bracket math), test boundary
   values explicitly: zero, negative (should be rejected), the exact
   threshold between brackets/tiers, and rounding behavior.
7. **Idempotency and concurrency are tested where they're a real property
   of the system**, not assumed. If a handler is supposed to be idempotent
   (e.g. `CheckoutRequestID` dedup), there must be a test that fires the
   same input twice and asserts a single side effect — this is a correctness
   property, and untested idempotency is unverified idempotency.
8. **Test names describe behavior, not mechanics.** `it("creates a booking
   and returns 201")`, not `it("should work")` or `it("test 1")`.

---

## 4. `apps/api` — backend testing rules

### 4.1 Structure requirement

Express `app` must always be created via an exported factory
(`createApp()`), never bound to a port in the same file that defines routes.
This is what allows Supertest to run entirely in-process. If a task involves
touching `app.ts`/`server.ts`, preserve this separation.

### 4.2 Unit tests — what belongs here

- FSM transition functions (state + event → next state), tested as pure
  functions with no Redis/DB involved
- Tax/financial calculation logic
- Zod schema validation (valid and invalid payloads)
- Pure service-layer functions that don't touch I/O directly

### 4.3 Integration tests — what belongs here

- Every Express route, via Supertest, against a **real test Postgres
  instance** — never a mocked Prisma client. Mocking the ORM hides real
  schema/query bugs, which is exactly the class of bug integration tests
  exist to catch.
- Multi-tenant isolation: any route touching tenant-scoped data needs a
  test asserting Tenant A cannot read/write Tenant B's data.
- RBAC/permission chains (Better Auth-backed): test through the actual
  middleware stack, not by unit-testing the permission-check function in
  isolation — the chain itself is the thing that can break.
- Slot soft-lock TTL: real Redis (via testcontainers), assert lock
  acquisition, contention (second request during lock → rejected/queued
  per spec), and expiry release.
- M-Pesa Daraja flows: `nock`-intercepted, must include the 504-ambiguity
  case and reconciliation sweep behavior, not just the happy path.
- BullMQ: test the **producer** side (queue.add called with correct
  payload, mocked queue) and the **worker processor logic** (as a plain
  async function, called directly) separately. Do not attempt to run a
  real BullMQ worker inside a unit test; a real Redis-backed queue
  round-trip belongs in `*.integration.test.ts` via testcontainers, kept
  separate from the fast suite.

### 4.4 Required for every new route

Every new Express route added to this codebase must ship with, at minimum:
- One integration test for the success path
- One for each documented error response (4xx/5xx) the route can return
- One for auth/permission rejection if the route is protected

An agent implementing a new route without these is not done with the task.

### 4.5 Test database

- `.env.test` points at a dedicated test DB — never the dev or prod
  database, ever, under any circumstance.
- Reset strategy: truncate relevant tables in `beforeEach` (see the
  `resetDb()` pattern already established in this repo). Do not rely on
  test execution order to leave the DB in a needed state.

---

## 5. `apps/web` — frontend testing rules

### 5.1 Tooling

Vitest + React Testing Library + MSW. `jsdom` environment.

### 5.2 Core philosophy

Query by role/label/text (`getByRole`, `getByLabelText`), not by CSS class
or test-id-first. Use `userEvent`, not `fireEvent`, for all interaction
simulation — it more accurately models real browser event sequences.

### 5.3 What belongs in a component test

- Forms: validation errors appear correctly, submit calls the correct
  mutation with the correct payload
- Pages backed by TanStack Query: mock the query hook/MSW handler to
  return each real state the UI must handle — loading, success, error,
  empty — and assert the correct UI renders for each. A component test
  that only covers the success state is incomplete.
- Zustand store logic: test as a unit (no component needed) — create the
  store, dispatch actions, assert resulting state.
- PWA-specific behavior (service worker registration, offline fallback,
  `needRefresh`/`updateServiceWorker` flow): test the React-side logic
  (the hook state machine) directly; full service worker lifecycle
  behavior belongs in E2E (§6), since jsdom does not run a real service
  worker.

### 5.4 API mocking

MSW, always, for any component that fetches data. Never mock `fetch`
manually per-test — define handlers once, override per-test only for
the specific state under test (error, empty, etc.).

### 5.5 What NOT to test here

- Don't snapshot-test components with any dynamic content (dates, IDs) —
  snapshot tests are reserved for stable, purely presentational components,
  used sparingly.
- Don't re-test what RTL/Vitest/TanStack Query already guarantee (e.g.
  don't test that `useState` updates state).

---

## 6. E2E — Playwright

Lives at the repo root or in `apps/web/e2e/` (co-located with the app it
drives), run against a full `docker compose` stack (API + Postgres + Redis),
not against mocked services.

### 6.1 Required flows

At minimum, the following must have Playwright coverage before this is
considered production-ready:

- Full booking flow: create → appears in list → triggers the correct
  downstream job (assertable via a test-only endpoint or direct Redis/DB
  inspection)
- Payment flow: STK push trigger → simulated Daraja callback → Payment
  Detail page reflects the update
- Auth flow: login, protected route redirect behavior, logout
- PWA update flow: simulate a new service worker becoming available,
  assert the update prompt appears, assert clicking it does not fire
  while a critical mutation is in flight (this is a real product
  requirement from this project — see §7)

### 6.2 Rules

- Use `storageState` to log in once and reuse the session — don't re-login
  in every test.
- No arbitrary `sleep`/`waitForTimeout`. Use Playwright's built-in
  auto-waiting and explicit `waitFor` conditions tied to real state changes.
- Flakiness is a bug, not something to work around with retries. If a test
  is flaky, the root cause (timing, network idle detection, a race in the
  app itself) must be fixed, not silently retried into passing.

---

## 7. Project-specific correctness properties

These are things this project has decided matter, and any test suite
touching the related code must verify them explicitly:

- **Update-triggered SW activation must never interrupt a critical
  operation.** Any test around the update-prompt flow must assert the
  reload/update action is gated (disabled or deferred) while a booking or
  payment mutation is in flight.
- **M-Pesa STK push idempotency**: firing the same `CheckoutRequestID`
  webhook twice must produce exactly one state transition, not two.
- **Multi-service booking snapshotting**: the `BookingService` join table
  stores snapshotted fields at booking time — a test must confirm that
  changing the underlying service's price/name later does NOT retroactively
  change an already-created booking's snapshotted values.
- **Notification retry/dead-letter behavior**: a notification that fails
  delivery must retry per the configured policy and land in the dead-letter
  path after exhausting retries — not silently disappear.
- **FSM transition discipline**: invalid transitions must be rejected, not
  silently ignored or coerced into a valid state.

---

## 8. CI expectations

- Unit tests (`*.test.ts`) run on every push, every app, in parallel.
- Integration tests (`*.integration.test.ts`) run against real
  Postgres/Redis via `testcontainers` or a `docker-compose.test.yml`
  service, on every push to a PR and on merge to main. Cap `maxWorkers` to
  avoid overwhelming the shared test DB connection limit.
- E2E (Playwright) runs on merge to main, and optionally on-demand for a
  PR via a label/manual trigger, since it's the slowest tier.
- A PR that adds backend logic without a corresponding unit or integration
  test, or frontend logic without a component test, should not be merged —
  this applies to agent-authored PRs identically to human-authored ones.

---

## 9. For AI coding agents specifically

If you are an agent implementing a feature or fixing a bug in this repo:

1. **Write the test that would have caught the bug, before or alongside
   the fix.** For bug fixes, the test should fail against the pre-fix code
   and pass against the fix — verify this, don't assume it.
2. **Do not delete or weaken an existing test to make a change pass.** If
   a test seems wrong given new requirements, flag it explicitly rather
   than silently loosening an assertion or adding `.skip`.
3. **Do not mock your way around a failing integration test.** If a
   Supertest test against the real test DB is failing, the fix is almost
   never "mock Prisma instead" — find and fix the actual schema/query/logic
   issue.
4. **Follow the §3 checklist for every test you write**, and if a
   generated test would pass against intentionally broken logic, rewrite
   it before considering the task complete.
5. **Match existing patterns in the file/module you're working in** before
   introducing a new pattern — consistency across this codebase matters
   more than any individual test being marginally more elegant.
6. **Never commit real M-Pesa Daraja credentials, VAPID keys, or database
   URLs in test fixtures** — use `.env.test` and clearly fake placeholder
   values in any committed fixture data.

---

## 10. Quick reference — commands

```bash
# From repo root (via vitest.workspace.ts)
pnpm test                    # all apps, unit + integration
pnpm test:watch              # watch mode

# Per app
pnpm --filter api test
pnpm --filter web test

# E2E
pnpm exec playwright test

# Coverage
pnpm test -- --coverage
```

---

## 11. When in doubt

Prefer the slower, more realistic test over the faster, more mocked one —
**except** at the unit layer, where isolation is the point. If you're unsure
which layer a piece of logic belongs in: pure computation → unit;
"does this route/component correctly integrate with a real dependency" →
integration; "does the whole user-facing flow work" → E2E. When genuinely
uncertain, ask rather than guessing — a wrongly-scoped test is worse than a
missing one, since it gives false confidence.