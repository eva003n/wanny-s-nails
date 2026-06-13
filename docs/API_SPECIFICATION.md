# API Specification — Wanny's Nails

**Version:** 1.0.0  
**Base URL:** `https://api.wannysnails.co.ke/api/v1`  
**Auth:** Bearer JWT (`Authorization: Bearer <token>`)  
**Content-Type:** `application/json`  
**Accept:** `application/json`

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Versioning](#versioning)
3. [Request Conventions](#request-conventions)
4. [Response Conventions](#response-conventions)
5. [Error Handling](#error-handling)
6. [Authentication & Security](#authentication--security)
7. [Rate Limiting](#rate-limiting)
8. [Pagination & Filtering](#pagination--filtering)
9. [Authentication APIs](#authentication-apis)
10. [Booking APIs](#booking-apis)
11. [Payment APIs](#payment-apis)
12. [Customer APIs](#customer-apis)
13. [Services APIs](#services-apis)
14. [Slots API](#slots-api)
15. [Notifications API](#notifications-api)
16. [Events API (SSE)](#events-api-sse)
17. [WhatsApp Webhook APIs](#whatsapp-webhook-apis)
18. [Health API](#health-api)

---

## Design Principles

| Principle | Implementation |
|---|---|
| **Resource-oriented** | URLs name resources, not actions (`/bookings/:id/approve` not `/approveBooking`) |
| **Consistent shape** | Every response — success or error — follows the same envelope |
| **Predictable status codes** | HTTP verbs and status codes are used according to their semantics |
| **Fail fast** | Validation errors returned before any business logic executes |
| **Idempotent writes** | PUT/PATCH/DELETE are safe to retry. POST action endpoints accept an `Idempotency-Key` header |
| **No breaking changes** | Additive changes only within a version(new features). Breaking changes require a new version (`/v2/`) |
| **Timezone-safe** | All datetimes stored and transmitted as ISO 8601 UTC. Display conversion is the client's responsibility |
| **Security by default** | All endpoints require auth except webhooks (signature-validated, IP allowlist) and health check |

---

## Versioning

URL path versioning:

```
/api/v1/bookings    ← current
/api/v2/bookings    ← future breaking change
```

**Deprecation policy:**
- A version is announced deprecated via a `Deprecation: true` response header and a `Sunset: <date>` header.
- Deprecated versions are supported for a minimum of 6 months after the sunset date announcement.
- The `Link` header points to the migration guide: `Link: <https://docs.wannysnails.co.ke/migration/v2>; rel="deprecation"`.

---

## Request Conventions

### Headers

| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes (authenticated routes) | `Bearer <accessToken>` |
| `Content-Type` | Yes (POST/PUT/PATCH) | Must be `application/json` |
| `Accept` | Recommended | `application/json` |
| `Idempotency-Key` | Optional (POST actions) | UUID v4. Prevents duplicate processing on retry |
| `X-Request-ID` | Optional | Client-generated UUID for request tracing. Echoed in response. |

### Idempotency

POST action endpoints (`/approve`, `/cancel`, `/reschedule`, `stk-push`) accept an `Idempotency-Key` header. Identical key + endpoint = same response returned without re-processing. Keys expire after 24 hours.

```
POST /api/v1/bookings/uuid/approve
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

### Request body rules
- Unknown fields are ignored (not rejected) — allows forward-compatible clients.
- `null` and omitted fields are treated differently: `null` explicitly clears a value; omitted means no change (PATCH semantics).

---

## Response Conventions

### Success envelope

```json
{
  "data": { },
  "meta": { }
}
```

`meta` is only present on paginated list responses.

### Single resource response

```json
{
  "data": {
    "id": "uuid",
    "reference": "WN-2026-00123",
    ...
  }
}
```

### List response

```json
{
  "data": [ { }, { } ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Response headers

| Header | Always present | Description |
|---|---|---|
| `X-Request-ID` | Yes | Echoes client header or generates one if absent. Use for support tickets. |
| `X-RateLimit-Limit` | Yes | Requests allowed in current window |
| `X-RateLimit-Remaining` | Yes | Requests remaining in current window |
| `X-RateLimit-Reset` | Yes | Unix timestamp when window resets |
| `Deprecation` | On deprecated versions | `true` |
| `Sunset` | On deprecated versions | ISO 8601 date when version is retired |

---

## Error Handling

### Error envelope

All errors — validation, auth, business logic, server — return the same shape:

```json
{
  "error": {
    "code": "BOOKING_SLOT_UNAVAILABLE",
    "message": "The selected time slot is no longer available.",
    "details": {
      "field": "appointmentAt",
      "value": "2026-06-05T11:00:00.000Z"
    },
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

`details` is optional. Present for validation errors (field-level) and business rule violations with context.
`requestId` always present — matches `X-Request-ID` response header.

### HTTP status codes

| Status | Code | When to use |
|---|---|---|
| `200` | — | Successful GET, PATCH, POST action (approve, cancel) |
| `201` | — | Resource created (POST /bookings, POST /customers) |
| `202` | — | Accepted for async processing (STK Push enqueued) |
| `204` | — | Successful DELETE, logout |
| `400` | `VALIDATION_ERROR` | Zod schema failure — malformed request |
| `401` | `UNAUTHORIZED` | Missing, expired, or invalid JWT |
| `403` | `FORBIDDEN` | Valid JWT but insufficient role |
| `404` | `NOT_FOUND` | Resource does not exist (or soft-deleted) |
| `409` | `CONFLICT` | State transition not allowed / slot taken |
| `410` | `GONE` | Resource was permanently deleted |
| `422` | `UNPROCESSABLE` | Business rule violation (outside hours, inactive service) |
| `429` | `RATE_LIMITED` | Too many requests |
| `500` | `INTERNAL_ERROR` | Unexpected server error — never exposes internals |
| `503` | `SERVICE_UNAVAILABLE` | Dependency down (Daraja, WhatsApp) — includes `Retry-After` header |

### Validation error shape

When `code` is `VALIDATION_ERROR`, `details` contains field-level errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "errors": [
        { "field": "appointmentAt", "message": "Must be a future date" },
        { "field": "serviceId", "message": "Required" }
      ]
    },
    "requestId": "..."
  }
}
```

---

## Authentication & Security

### Token lifecycle

| Token | TTL | Storage (client) | Rotation |
|---|---|---|---|
| Access token (JWT) | 1 hour | Memory (React context) — never localStorage | On every refresh |
| Refresh token (opaque) | 30 days | `httpOnly` cookie set by API | Rotated on use (sliding window) |

### Silent refresh flow

1. API call returns `401`.
2. Client calls `POST /auth/refresh` automatically.
3. If successful: retry the original request with the new access token.
4. If refresh also fails: redirect to `/login`.

### Webhook endpoints

Webhook endpoints (`/webhooks/whatsapp`, `/payments/mpesa-callback`) do not use JWT. They are protected by:
- **WhatsApp:** `X-Hub-Signature-256` HMAC header validated against `WHATSAPP_APP_SECRET`.
- **Daraja:** IP allowlist (Safaricom's published Daraja IP ranges) + request body shape validation.

---

## Rate Limiting

Rate limits use a sliding window algorithm. Headers are returned on every response.

| Endpoint group | Limit | Window |
|---|---|---|
| Global (all authenticated routes) | 300 req | 15 min |
| `POST /auth/login` | 10 req | 15 min per IP |
| `POST /auth/refresh` | 20 req | 15 min |
| `POST /payments/stk-push` | 5 req | 5 min per booking |
| `POST /webhooks/whatsapp` | 500 req | 1 min (Meta sends bursts) |

On limit exceeded:

```
HTTP 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1749120000
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please wait before retrying.",
    "details": { "retryAfterSeconds": 60 }
  }
}
```

---

## Pagination & Filtering

### Query parameters (all list endpoints)

| Param | Type | Default | Max | Description |
|---|---|---|---|---|
| `page` | integer | 1 | — | Page number (1-indexed) |
| `limit` | integer | 20 | 100 | Items per page |
| `sort` | string | resource-specific | — | `field:asc` or `field:desc` |

### Filtering

Filters are resource-specific and documented per endpoint. Common patterns:

```
GET /bookings?status=PENDING
GET /bookings?from=2026-06-01T00:00:00Z&to=2026-06-30T23:59:59Z
GET /bookings?customerId=uuid&status=APPROVED
GET /customers?search=Wanjiku
```

Multiple values for the same filter use comma-separation:

```
GET /bookings?status=PENDING,APPROVED
```

### Cursor pagination (future)

High-volume endpoints will move to cursor-based pagination. The `meta` object will add `nextCursor` and `prevCursor` fields. Offset-based will continue working until explicitly deprecated.

---

## Authentication APIs

### POST /auth/login

Authenticates a salon user (owner or staff).

**Authorization:** Public  
**Idempotency-Key:** Not applicable

**Request:**
```json
{
  "email": "wanny@wannysnails.co.ke",
  "password": "securepassword123"
}
```

**Validation:**
| Field | Rule |
|---|---|
| `email` | Required, valid email format, max 255 chars |
| `password` | Required, min 8 chars |

**Response 200:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "name": "Wanny",
      "email": "wanny@wannysnails.co.ke",
      "role": "OWNER"
    }
  }
}
```

Note: `refreshToken` is set as an `httpOnly` `Secure` `SameSite=Strict` cookie — not in the response body.

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `401` | `UNAUTHORIZED` | Wrong email or password (do not distinguish — prevents enumeration) |
| `403` | `FORBIDDEN` | Account is deactivated |
| `429` | `RATE_LIMITED` | 10+ failed attempts in 15 min from same IP |

---

### POST /auth/refresh

Exchanges the refresh token cookie for a new access token.

**Authorization:** Public (refresh token read from `httpOnly` cookie)  
**Request body:** Empty `{}`

**Response 200:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 3600
  }
}
```

New refresh token set in `httpOnly` cookie (rotated on use).

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `401` | `UNAUTHORIZED` | Cookie missing, token expired, or token revoked |

---

### POST /auth/logout

Revokes the current refresh token.

**Authorization:** Bearer JWT  
**Request body:** Empty `{}`  
**Response:** `204 No Content`

Clears the `httpOnly` refresh token cookie.

---

## Booking APIs

### GET /bookings

Returns a paginated, filterable list of bookings.

**Authorization:** Bearer JWT (any role)

**Query parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | — |
| `limit` | int | 20 | Max 100 |
| `status` | enum / csv | all | `PENDING,APPROVED,CANCELLED,COMPLETED,NO_SHOW,RESCHEDULED` |
| `paymentStatus` | enum / csv | all | `UNPAID,PAYMENT_PENDING,PAID,PAYMENT_FAILED,REFUNDED` |
| `customerId` | uuid | — | Filter by customer |
| `serviceId` | uuid | — | Filter by service |
| `date` | `YYYY-MM-DD` | — | Exact date match (EAT) |
| `from` | ISO UTC | — | Appointment at or after |
| `to` | ISO UTC | — | Appointment at or before |
| `sort` | string | `appointmentAt:asc` | `appointmentAt`, `createdAt`, `priceKes` |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "reference": "WN-2026-00123",
      "appointmentAt": "2026-06-05T11:00:00.000Z",
      "durationMinutes": 60,
      "priceKes": 1500,
      "status": "APPROVED",
      "paymentStatus": "PAID",
      "notes": null,
      "customer": {
        "id": "uuid",
        "name": "Wanjiku Kamau",
        "phone": "+254712345678"
      },
      "service": {
        "id": "uuid",
        "name": "Gel Manicure"
      },
      "approvedBy": {
        "id": "uuid",
        "name": "Wanny"
      },
      "createdAt": "2026-06-04T08:32:11.000Z",
      "updatedAt": "2026-06-04T09:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### POST /bookings

Creates a new booking (manual creation from the PWA).

**Authorization:** Bearer JWT (any role)  
**Idempotency-Key:** Supported

**Request:**
```json
{
  "customerId": "uuid",
  "serviceId": "uuid",
  "appointmentAt": "2026-06-05T11:00:00.000Z",
  "notes": "Customer prefers gel topcoat"
}
```

**Validation:**
| Field | Rule |
|---|---|
| `customerId` | Required, valid UUID, customer must exist and not be soft-deleted |
| `serviceId` | Required, valid UUID, service must be active |
| `appointmentAt` | Required, ISO 8601 UTC, must be in the future, must fall within business hours, must align to 30-min slot boundary |
| `notes` | Optional, max 500 chars |

**Response 201:** Full booking object.

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `409` | `BOOKING_SLOT_UNAVAILABLE` | Slot is already taken |
| `422` | `OUTSIDE_BUSINESS_HOURS` | Time outside configured hours |
| `422` | `SERVICE_INACTIVE` | Service is not active |
| `404` | `CUSTOMER_NOT_FOUND` | Customer does not exist |

---

### GET /bookings/:id

Returns a single booking with full relations.

**Authorization:** Bearer JWT (any role)

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "reference": "WN-2026-00123",
    "appointmentAt": "2026-06-05T11:00:00.000Z",
    "durationMinutes": 60,
    "priceKes": 1500,
    "status": "APPROVED",
    "paymentStatus": "PAID",
    "notes": null,
    "customer": { "id": "uuid", "name": "Wanjiku Kamau", "phone": "+254712345678" },
    "service": { "id": "uuid", "name": "Gel Manicure", "durationMinutes": 60 },
    "approvedBy": { "id": "uuid", "name": "Wanny" },
    "statusHistory": [
      {
        "fromStatus": null,
        "toStatus": "PENDING",
        "actorType": "SYSTEM",
        "actorId": null,
        "reason": "Created via WhatsApp",
        "createdAt": "2026-06-04T08:32:11.000Z"
      },
      {
        "fromStatus": "PENDING",
        "toStatus": "APPROVED",
        "actorType": "USER",
        "actorId": "uuid",
        "reason": null,
        "createdAt": "2026-06-04T09:00:00.000Z"
      }
    ],
    "reminders": [
      { "type": "REMINDER_24H", "status": "SENT", "sentAt": "2026-06-04T11:00:00.000Z" },
      { "type": "REMINDER_1H", "status": "SCHEDULED", "scheduledAt": "2026-06-05T10:00:00.000Z" }
    ],
    "createdAt": "2026-06-04T08:32:11.000Z",
    "updatedAt": "2026-06-04T09:00:00.000Z"
  }
}
```

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `404` | `NOT_FOUND` | Booking does not exist or is soft-deleted |

---

### PATCH /bookings/:id

Updates mutable booking fields. Only `notes` is patchable — status transitions use dedicated action endpoints.

**Authorization:** Bearer JWT (any role)

**Request:**
```json
{ "notes": "Customer called to confirm — no topcoat" }
```

**Validation:** `notes` max 500 chars. `null` clears the field.

**Response 200:** Full booking object.

---

### DELETE /bookings/:id

Soft-deletes a booking record (admin operation). This is not the same as cancellation — use `POST /bookings/:id/cancel` for the business action.

**Authorization:** Bearer JWT, role = `OWNER` only  
**Response:** `204 No Content`

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `403` | `FORBIDDEN` | Role is not OWNER |
| `422` | `UNPROCESSABLE` | Cannot delete a booking with a completed payment |

---

### POST /bookings/:id/approve

Transitions a PENDING booking to APPROVED.

**Authorization:** Bearer JWT (any role)  
**Idempotency-Key:** Supported  
**Request body:** Empty `{}`

**Side effects:**
- Writes `PENDING → APPROVED` to `booking_status_history`
- Schedules 24h and 1h reminder BullMQ jobs
- Enqueues WhatsApp `booking_confirmed` template message to customer

**Response 200:** Full booking object with updated status.

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `409` | `INVALID_STATUS_TRANSITION` | Booking is not in PENDING status |
| `404` | `NOT_FOUND` | Booking does not exist |

---

### POST /bookings/:id/reschedule

Moves a PENDING or APPROVED booking to a new time slot.

**Authorization:** Bearer JWT (any role)  
**Idempotency-Key:** Supported

**Request:**
```json
{
  "appointmentAt": "2026-06-07T14:00:00.000Z",
  "reason": "Customer requested change"
}
```

**Validation:**
| Field | Rule |
|---|---|
| `appointmentAt` | Required, ISO 8601 UTC, future, within business hours, 30-min boundary |
| `reason` | Optional, max 255 chars |

**Side effects:**
- Cancels existing reminder BullMQ jobs
- Schedules new reminder jobs for the new time
- Writes status history entry
- Enqueues WhatsApp `booking_rescheduled` template message

**Response 200:** Full booking object.

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `409` | `BOOKING_SLOT_UNAVAILABLE` | New slot is taken |
| `409` | `INVALID_STATUS_TRANSITION` | Cannot reschedule COMPLETED or CANCELLED booking |
| `422` | `OUTSIDE_BUSINESS_HOURS` | New time outside business hours |

---

### POST /bookings/:id/cancel

Cancels a booking.

**Authorization:** Bearer JWT (any role)  
**Idempotency-Key:** Supported

**Request:**
```json
{
  "reason": "Customer requested cancellation"
}
```

**Validation:** `reason` optional, max 255 chars.

**Side effects:**
- Cancels all `SCHEDULED` reminder jobs
- Releases the slot (no DB action needed — soft-deleted/cancelled bookings excluded from slot checks)
- Writes status history entry
- Enqueues WhatsApp `booking_cancelled` template message

**Response 200:** Full booking object.

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `409` | `INVALID_STATUS_TRANSITION` | Booking is already COMPLETED |

---

### POST /bookings/:id/mark-paid

Manually marks a booking as paid (for cash or offline payments).

**Authorization:** Bearer JWT, role = `OWNER` only

**Request:**
```json
{
  "method": "CASH",
  "notes": "Customer paid in salon"
}
```

**Validation:** `method` required, enum: `CASH`.

**Response 200:** Full booking object.

---

## Payment APIs

### POST /payments/stk-push

Initiates an M-Pesa STK Push. Accepts the booking ID and the phone number to charge. Returns immediately — actual payment processing is async.

**Authorization:** Bearer JWT (any role)  
**Idempotency-Key:** Supported (prevents duplicate STK Push on retry)

**Request:**
```json
{
  "bookingId": "uuid",
  "phoneNumber": "+254712345678"
}
```

**Validation:**
| Field | Rule |
|---|---|
| `bookingId` | Required, UUID, booking must be APPROVED with UNPAID or PAYMENT_FAILED status |
| `phoneNumber` | Required, valid Kenyan phone (E.164: `+2547xx` or `+2541xx`) |

**Response 202:**
```json
{
  "data": {
    "paymentId": "uuid",
    "checkoutRequestId": "ws_CO_...",
    "message": "Payment request sent to +254712345678. Awaiting customer approval."
  }
}
```

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `422` | `PAYMENT_NOT_ALLOWED` | Booking not in a payable state |
| `429` | `RATE_LIMITED` | STK Push already pending for this booking |

---

### GET /payments

Returns a paginated payment list.

**Authorization:** Bearer JWT (any role). STAFF receives `amountKes: null` — amounts are OWNER-only.

**Query parameters:** `page`, `limit`, `status`, `from`, `to`, `customerId`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "bookingId": "uuid",
      "amountKes": 1500,
      "status": "PAID",
      "mpesaReceiptNumber": "QHZ8XXXXXYZ",
      "phoneNumber": "+254712345678",
      "completedAt": "2026-06-04T09:00:11.000Z",
      "booking": {
        "reference": "WN-2026-00123",
        "customer": { "name": "Wanjiku Kamau" },
        "service": { "name": "Gel Manicure" },
        "appointmentAt": "2026-06-05T11:00:00.000Z"
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 89, "totalPages": 5, "hasNextPage": true, "hasPrevPage": false }
}
```

---

### GET /payments/:id

Returns a single payment with all transaction attempts.

**Authorization:** Bearer JWT (OWNER sees `amountKes`; STAFF sees `null`)

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "bookingId": "uuid",
    "amountKes": 1500,
    "status": "PAID",
    "mpesaReceiptNumber": "QHZ8XXXXXYZ",
    "phoneNumber": "+254712345678",
    "completedAt": "2026-06-04T09:00:11.000Z",
    "transactions": [
      {
        "id": "uuid",
        "attemptNumber": 1,
        "checkoutRequestId": "ws_CO_...",
        "resultCode": 0,
        "resultDesc": "The service request is processed successfully.",
        "mpesaReceiptNumber": "QHZ8XXXXXYZ",
        "createdAt": "2026-06-04T08:59:45.000Z"
      }
    ]
  }
}
```

---

### POST /payments/mpesa-callback

Receives M-Pesa payment result from Safaricom Daraja. This endpoint is called by Daraja — not by the PWA.

**Authorization:** IP allowlist (Safaricom Daraja IP ranges) + request body shape validation. No JWT.

**Request:**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "ws_CO_...",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 1500 },
          { "Name": "MpesaReceiptNumber", "Value": "QHZ8XXXXXYZ" },
          { "Name": "TransactionDate", "Value": 20260604090011 },
          { "Name": "PhoneNumber", "Value": 254712345678 }
        ]
      }
    }
  }
}
```

**Processing (all inside a single DB transaction):**
1. Find payment by `CheckoutRequestID`
2. Idempotency check on `MpesaReceiptNumber` — discard if already processed
3. Verify `Amount` matches `booking.priceKes` — mismatch → `DISPUTED`, alert owner
4. `ResultCode === 0`: mark PAID, update booking `paymentStatus`
5. `ResultCode !== 0`: mark FAILED, record `ResultDesc` as `failureReason`
6. Enqueue WhatsApp notification job (outside transaction — non-critical)

**Response 200 (always — Daraja retries on non-200):**
```json
{ "ResultCode": 0, "ResultDesc": "Accepted" }
```

**Daraja ResultCode reference:**
| Code | Meaning | Action |
|---|---|---|
| `0` | Success | Mark PAID |
| `1` | Insufficient funds | Mark FAILED — notify customer |
| `1032` | Request cancelled / timeout | Mark FAILED — offer retry |
| `1037` | Customer did not respond | Mark FAILED — offer retry |
| `26` | System busy | Mark FAILED — retry STK Push job |

---

## Customer APIs

### GET /customers

Returns a paginated, searchable customer list.

**Authorization:** Bearer JWT (any role)

**Query parameters:**
| Param | Type | Description |
|---|---|---|
| `page` | int | — |
| `limit` | int | Max 100 |
| `search` | string | Partial match on name or phone |
| `sort` | string | `name:asc` (default), `createdAt:desc`, `lastBookingAt:desc` |

**Response 200:** Paginated array of customer summary objects.

---

### POST /customers

Creates a customer record manually (PWA). Customers are also auto-created by the WhatsApp FSM on first contact.

**Authorization:** Bearer JWT (any role)

**Request:**
```json
{
  "name": "Wanjiku Kamau",
  "phone": "+254712345678",
  "email": "wanjiku@example.com"
}
```

**Validation:**
| Field | Rule |
|---|---|
| `name` | Required, 2–100 chars |
| `phone` | Required, E.164 Kenyan number (`+2547xx` or `+2541xx`), unique |
| `email` | Optional, valid email, unique if provided |

**Response 201:** Full customer object.

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `409` | `PHONE_ALREADY_EXISTS` | Phone number already registered |

---

### GET /customers/:id

Returns a full customer profile.

**Authorization:** Bearer JWT (any role)

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Wanjiku Kamau",
    "phone": "+254712345678",
    "email": null,
    "consentGiven": true,
    "consentAt": "2026-01-15T14:22:00.000Z",
    "stats": {
      "totalBookings": 12,
      "completedBookings": 10,
      "cancelledBookings": 1,
      "noShowCount": 1,
      "totalSpentKes": 18000,
      "averageBookingValueKes": 1636,
      "lastBookingAt": "2026-06-04T09:00:00.000Z"
    },
    "createdAt": "2026-01-15T14:22:00.000Z",
    "updatedAt": "2026-06-04T09:00:00.000Z"
  }
}
```

---

### PATCH /customers/:id

Updates customer name or email.

**Authorization:** Bearer JWT (any role)

**Request:**
```json
{
  "name": "Wanjiku K.",
  "email": "new@example.com"
}
```

Phone number is not patchable (it is the identity key — contact support to change).

**Response 200:** Full customer object.

---

### GET /customers/:id/bookings

Returns booking history for a customer.

**Authorization:** Bearer JWT (any role)  
**Query parameters:** `page`, `limit`, `status`

---

### GET /customers/:id/payments

Returns payment history for a customer.

**Authorization:** Bearer JWT (OWNER only for `amountKes`)  
**Query parameters:** `page`, `limit`, `status`

---

## Services APIs

### GET /services

Returns the active service catalogue.

**Authorization:** Bearer JWT (any role)

**Query parameters:**
| Param | Description |
|---|---|
| `includeInactive` | `true` to include inactive services (OWNER only) |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Gel Manicure",
      "description": "Long-lasting gel polish with cuticle care",
      "durationMinutes": 60,
      "priceKes": 1500,
      "isActive": true,
      "sortOrder": 1,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### POST /services

Creates a new service.

**Authorization:** Bearer JWT, role = `OWNER`

**Request:**
```json
{
  "name": "Gel Manicure",
  "description": "Long-lasting gel polish with cuticle care",
  "durationMinutes": 60,
  "priceKes": 1500,
  "sortOrder": 1
}
```

**Validation:**
| Field | Rule |
|---|---|
| `name` | Required, 2–100 chars, unique |
| `durationMinutes` | Required, integer, min 15, max 480 |
| `priceKes` | Required, integer, min 1 |
| `sortOrder` | Optional, integer, defaults to 0 |

**Response 201:** Full service object.

---

### PATCH /services/:id

Updates a service.

**Authorization:** Bearer JWT, role = `OWNER`

**Request:** Any subset of service fields. All are optional.

```json
{
  "priceKes": 1800,
  "isActive": false
}
```

**Response 200:** Full service object.

---

### DELETE /services/:id

Soft-deletes a service.

**Authorization:** Bearer JWT, role = `OWNER`  
**Response:** `204 No Content`

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `422` | `SERVICE_HAS_FUTURE_BOOKINGS` | Cannot delete a service with upcoming confirmed bookings |

---

## Slots API

### GET /slots/availability

Returns available time slots for a given service and date. Used by both the PWA calendar and the WhatsApp FSM internally.

**Authorization:** Bearer JWT (any role)

**Query parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `serviceId` | uuid | Yes | Service to check slots for |
| `date` | `YYYY-MM-DD` | Yes | Date in EAT timezone |

**Response 200:**
```json
{
  "data": {
    "date": "2026-06-05",
    "serviceId": "uuid",
    "serviceName": "Gel Manicure",
    "durationMinutes": 60,
    "totalSlots": 8,
    "availableSlots": 5,
    "slots": [
      {
        "time": "10:00",
        "available": true,
        "appointmentAt": "2026-06-05T07:00:00.000Z"
      },
      {
        "time": "11:30",
        "available": false,
        "appointmentAt": "2026-06-05T08:30:00.000Z"
      }
    ]
  }
}
```

**Error cases:**
| Status | Code | Condition |
|---|---|---|
| `422` | `BUSINESS_CLOSED` | The requested date is a closed day |
| `400` | `VALIDATION_ERROR` | Date is in the past |

---

## Notifications API

### GET /notifications/reminders

Returns scheduled and sent reminders. For operational visibility (OWNER only).

**Authorization:** Bearer JWT, role = `OWNER`

**Query parameters:** `status`, `from`, `to`, `bookingId`, `page`, `limit`

**Response 200:** Paginated reminder list with `bookingId`, `type`, `channel`, `status`, `scheduledAt`, `sentAt`.

---

## Events API (SSE)

Real-time event stream for the PWA dashboard. The client opens a persistent `EventSource` connection. The server pushes events when booking or payment state changes occur.

### GET /events

**Authorization:** Bearer JWT (passed as query parameter — `EventSource` does not support custom headers)

```
GET /api/v1/events?token=<accessToken>
```

**Response:** `text/event-stream`

**Event types:**

| Event | Payload | When |
|---|---|---|
| `booking.created` | `{ bookingId, customerName, service, appointmentAt }` | New WhatsApp booking created |
| `booking.approved` | `{ bookingId }` | Booking approved |
| `booking.cancelled` | `{ bookingId }` | Booking cancelled |
| `booking.rescheduled` | `{ bookingId, newAppointmentAt }` | Booking rescheduled |
| `payment.completed` | `{ bookingId, paymentId, amountKes }` | M-Pesa payment confirmed |
| `payment.failed` | `{ bookingId, paymentId, resultCode }` | M-Pesa payment failed |
| `ping` | `{}` | Sent every 30s to keep connection alive |

**Example stream:**
```
event: booking.created
data: {"bookingId":"uuid","customerName":"Wanjiku Kamau","service":"Gel Manicure","appointmentAt":"2026-06-05T11:00:00.000Z"}

event: ping
data: {}
```

**Client reconnection:** `EventSource` reconnects automatically on disconnect using the `Last-Event-ID` header. The server replays any events missed since that ID (up to 5 minutes of backlog, stored in Redis).

---

## WhatsApp Webhook APIs

### GET /webhooks/whatsapp

WhatsApp webhook verification (called by Meta once during setup).

**Authorization:** Public  
**Query parameters:** `hub.mode`, `hub.verify_token`, `hub.challenge`

**Logic:** Returns `hub.challenge` as plain text if `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN` env var.

**Response 200:** Plain text `hub.challenge`  
**Response 403:** Token mismatch

---

### POST /webhooks/whatsapp

Receives incoming WhatsApp messages and delivery status updates.

**Authorization:** Public — validated via `X-Hub-Signature-256` HMAC header.

**Headers:**
```
X-Hub-Signature-256: sha256=<hmac-sha256 of raw body with WHATSAPP_APP_SECRET>
```

**Important:** Signature must be validated against the **raw request body bytes** before JSON parsing.

**Request:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "phone_number_id": "..." },
        "contacts": [{ "profile": { "name": "Wanjiku" }, "wa_id": "254712345678" }],
        "messages": [{
          "id": "wamid.xxx",
          "from": "254712345678",
          "timestamp": "1717488000",
          "type": "text",
          "text": { "body": "Hi" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Processing:**
1. Validate `X-Hub-Signature-256`
2. Deduplicate on `wamid` (Redis, 5-min TTL)
3. Enqueue message for async FSM processing
4. Return `200` immediately

**Response 200:**
```json
{ "status": "ok" }
```

**Critical:** Never return non-200 — Meta retries on any non-200 response, causing duplicate processing.

---

## Health API

### GET /health

Liveness and readiness check. Used by Docker health checks, load balancers, and uptime monitors.

**Authorization:** Public

**Response 200:**
```json
{
  "status": "ok",
  "version": "2.0.0",
  "uptime": 86432,
  "timestamp": "2026-06-05T07:00:00.000Z",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "queue": "ok"
  }
}
```

**Response 503** (if any check fails):
```json
{
  "status": "degraded",
  "checks": {
    "database": "ok",
    "redis": "error",
    "queue": "error"
  }
}
```

`503` triggers load balancer health check failure and removes the instance from rotation.
