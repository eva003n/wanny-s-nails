# Backend Rules

## Hard rules

- **Schema first.** Update `prisma/schema.prisma` before writing any service logic. Run `pnpm prisma migrate dev`.
- **No hard deletes.** Set `deletedAt = now()`. Global Prisma middleware filters soft-deleted rows automatically — never add `deletedAt: null` to individual queries.
- **Audit every state change.** Write to `audit_logs` inside the same DB transaction as the mutation. Example:

```typescript
await prisma.$transaction([
  prisma.booking.update({ where: { id }, data: { status: "APPROVED" } }),
  prisma.auditLog.create({
    data: {
      entity: "Booking",
      entityId: id,
      action: "STATUS_CHANGE",
      fromStatus: "PENDING",
      toStatus: "APPROVED",
      actorId,
      actorType: "USER",
    },
  }),
]);
```

- **Queue all external calls.** WhatsApp, STK Push, email — enqueue via BullMQ. Never call external APIs inline in a request handler.
- **UTC in DB, EAT in UI.** Store all datetimes as UTC. Use `date-fns-tz` with `Africa/Nairobi` for slot generation. The PWA handles EAT display.
- **Validate env at startup.** `shared/config.ts` uses a Zod `ConfigSchema`. The process exits if any required secret is missing.
- **Idempotent callbacks.** Daraja and WhatsApp webhook handlers check for duplicate processing before acting (see [domain.md](./domain.md) for specifics).

## Error handling

Throw typed `AppError` subclasses — never generic `Error`:

```typescript
next(new BookingConflictError()); // 409
next(new PaymentFailedError(code)); // 402
next( new NotFoundError("Booking")); // 404
```

Global error handler maps to: `{ error: { code, message, details } }`.  
Never expose stack traces or internal messages in production responses.

## Auth

| Role    | Permissions                                                     |
| ------- | --------------------------------------------------------------- |
| `OWNER` | All operations                                                  |
| `STAFF` | CRUD bookings, view customers, see payment status (not amounts) |

- Enforce with `requireRole(['OWNER'])` middleware.
- Webhook endpoints skip JWT — validate `X-Hub-Signature-256` for whatsapp and IP allow list for Daraja API.

## Convention: Routes → Controllers → Services

***NB:*** **Routes wire, middleware guards, controllers orchestrate, services execute.**

| Layer | Responsibility | Contains |
| --- | --- | --- |
| **Routes** (`*.routes.ts`) | controller reference ONLY (controller already wrapped with asyncHandler)` |
| **Controllers** (`*.controller.ts`) | Parse validated request, call services, send response | Read `req.validated`, call service, use response helpers |
| **Services** (`*.service.ts`) | All business logic and DB operations | Prisma queries, validation rules, transaction handling |

Never put business logic in routes.
Never access the database from routes.
Never send `res.json()` from services — return data to controllers.
Keep controllers small and stateless.

## Middleware ordering

Apply middleware in this order for each route:

```
authenticate → requireRole → idempotencyMiddleware → validate(schema) → asyncHandler(controller)
```

- `authenticate` always comes first after the HTTP method.
- `requireRole` comes after authentication.
- `idempotencyMiddleware` goes between auth and validation for state-changing POST/PUT/PATCH/DELETE routes.
- `validate(schema)` runs **after** auth and **before** the controller handler.
- `asyncHandler` is always the final wrapper on the the controller.

## Controller convention

- **Keep routes thin:** move request handling into `*.controller.ts` files and keep `*.routes.ts` for wiring only.
- **Controller signature:** Controllers are exported functions wrapped with asyncHandler, not raw async functions.
- *****
```typescript
// ✅ Correct
export const getBooking = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    ...
  }
);

// ❌ Wrong — never wrap with asyncHandler inside controller
export async function getBooking(req: Request, res: Response) {
  const booking = await bookingsService.getById(req.params.id as string);
  success(res, booking);
}
```

- **Consistency:** follow this pattern for all modules (auth, bookings, customers, services, payments, webhooks, etc.).

## Validation

- **Always use the `validate()` middleware** from `shared/middleware/validate.middleware.ts` for request validation. It validates `body`, `params`, and `query` in a single pass and sets `req.validated`.
- **Never use inline `safeParse` in controllers.** The `validate()` middleware eliminates duplicated boilerplate.
### Zod schema rules
- `lib/schemas` = shared DTOs (frontend + backend)
- `${module}*.schema.ts` = backend validation only
- frontend never touches backend schemas
- controllers use domain schemas only
- schemas are never defined inside routes

```typescript
// In *.routes.ts
import { createBookingSchema } from "./bookings.controller.js";
router.post("/", authenticate, validate(createBookingSchema), bookingsController.createBooking);
```

- **Controller reads `req.validated`:**

```typescript
export const createBooking = asyncHandler(async(req: Request, res: Response, next: NextFunction) =>{
  const input = req.validated!.body as CreateBookingInput;
  const booking = await bookingsService.create(input);
  created(res, booking);
})
```

## Service convention

Services are plain object literals — not classes:

```typescript
export const bookingsService = {
  async create(input: CreateBookingInput) { ... },
  async list(filters: ListFilters) { ... },
};
```

- Accept a strongly typed input interface, never raw `Request` objects.
- Return typed data to the controller — never send HTTP responses.
- Validate business rules (status transitions, slot availability, etc.) and throw typed `AppError` subclasses on violation.
- Use `include: { ... }` with `select` to avoid over-fetching. Always include related entities with `select` for ID + name only:

```typescript
include: {
  customer: { select: { id: true, name: true, phone: true } },
  service: { select: { id: true, name: true } },
}
```

## Pagination

Use `parsePagination` from `shared/utils/pagination.ts` and the `paginated` response helper from `shared/utils/response.ts`:

```typescript
import { parsePagination } from "../../shared/utils/pagination.js";
import { paginated } from "../../shared/utils/response.js";

export const listBookings = asyncHandler(async(req: Request, res: Response, next: NextFunction) =>{
  const { page, limit, sort } = parsePagination(req.query as Record<string, unknown>, {
    sort: "appointmentAt:asc",
  });
  const result = await bookingsService.list({ page, limit, sort });
  paginated(res, result.items, result.total, result.page, result.limit);
})
```

## Response helpers

Always use the standard response helpers from `shared/utils/response.ts`:

| Helper | Use case | HTTP Status |
| --- | --- | --- |
| `success(res, data)` | Single resource or list | 200 |
| `created(res, data)` | Resource created | 201 |
| `noContent(res)` | Successful deletion, no body | 204 |
| `paginated(res, data, total, page, limit)` | Paginated list | 200 |

Never call `res.status().json()` directly in controllers — always go through these helpers.

## Adding an endpoint

1. Document it in `API_SPECIFICATION.md` first.
2. Define Zod validation schema(s) in the controller file.
3. Implement: route → validate → controller → service → Prisma → audit log.
4. Add integration test against `wannysnails_test` DB.