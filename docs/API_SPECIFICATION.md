# API Specification — Wanny's Nails

**Version:** 1.0  
**Base URL:** `https://api.nailbook.co.ke/api/v1`  
**Auth:** Bearer JWT (Authorization header)  
**Content-Type:** `application/json`

---

## Conventions

### Success Response Shape

```json
{
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 142 }
}
```

`meta` is included on paginated responses only.

### Error Response Shape

```json
{
  "error": {
    "code": "BOOKING_NOT_FOUND",
    "message": "Booking with the specified ID was not found.",
    "details": { "bookingId": "abc-123" }
  }
}
```

### Common Error Codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body failed Zod validation |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Authenticated but insufficient role |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | State transition not allowed / slot unavailable |
| 422 | `UNPROCESSABLE` | Business rule violation |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### Pagination

All list endpoints accept `?page=1&limit=20`. Max limit: 100.

### Dates

All dates/times are ISO 8601 UTC in API request/response bodies. The  PWA converts to EAT (Africa/Nairobi, UTC+3) for display.

---

## Authentication APIs

### POST /auth/login

Authenticates a salon user (owner or staff).

**Authorization:** None (public)

**Request:**
```json
{
  "email": "grace@glownails.co.ke",
  "password": "securepassword123"
}
```

**Validation:**
- `email`: required, valid email format
- `password`: required, min 8 chars

**Response 200:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "name": "Grace Wanjiru",
      "email": "grace@glownails.co.ke",
      "role": "OWNER"
    }
  }
}
```

**Error Cases:**
- `401 UNAUTHORIZED` — Invalid email/password (do not distinguish between wrong email and wrong password)
- `403 FORBIDDEN` — Account is deactivated

---

### POST /auth/refresh

Exchanges a refresh token for a new access token.

**Request:**
```json
{ "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..." }
```

**Response 200:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 3600
  }
}
```

**Error Cases:**
- `401 UNAUTHORIZED` — Token expired, invalid, or revoked

---

### POST /auth/logout

Revokes the refresh token.

**Authorization:** Bearer JWT  
**Request:** `{ "refreshToken": "..." }`  
**Response 204:** No content

---

## Booking APIs

### GET /bookings

Returns a paginated list of bookings.

**Authorization:** Bearer JWT (any role)

**Query Parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page (max 100) |
| `status` | enum | all | Filter by BookingStatus |
| `paymentStatus` | enum | all | Filter by PaymentStatus |
| `customerId` | uuid | — | Filter by customer |
| `date` | date | — | Filter by appointment date (YYYY-MM-DD, EAT) |
| `from` | datetime | — | Appointment at or after (ISO UTC) |
| `to` | datetime | — | Appointment at or before (ISO UTC) |
| `sort` | string | `appointmentAt:asc` | Sort field:direction |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "reference": "NB-2026-00123",
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
        "name": "Grace Wanjiru"
      },
      "createdAt": "2026-06-04T08:32:11.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 47 }
}
```

---

### POST /bookings

Creates a new booking (for manual creation from the iOS app).

**Authorization:** Bearer JWT (any role)

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
- `customerId`: required, valid uuid, customer must exist
- `serviceId`: required, valid uuid, service must be active
- `appointmentAt`: required, ISO UTC, must be in the future, must fall within business hours

**Business Rules:**
- Slot must be available (no overlapping non-cancelled bookings)
- `appointmentAt` must align with configured slot intervals (e.g., 30-minute boundaries)

**Response 201:**
```json
{
  "data": { /* full booking object */ }
}
```

**Error Cases:**
- `409 BOOKING_SLOT_UNAVAILABLE` — Slot is taken
- `422 OUTSIDE_BUSINESS_HOURS` — Appointment time falls outside configured hours
- `422 SERVICE_INACTIVE` — The selected service is not active
- `404 CUSTOMER_NOT_FOUND`

---

### PATCH /bookings/:id

Updates booking notes. Status changes must use dedicated action endpoints.

**Authorization:** Bearer JWT (any role)

**Request:**
```json
{ "notes": "Updated notes" }
```

**Response 200:** Full booking object.

---

### DELETE /bookings/:id

Soft-deletes a booking (admin use only, not the same as cancellation).

**Authorization:** Bearer JWT, role = OWNER only

**Response 204:** No content

---

### POST /bookings/:id/approve

Approves a PENDING booking.

**Authorization:** Bearer JWT (any role)

**Request:** Empty body `{}`

**Business Rules:**
- Booking must have status PENDING
- Transition: PENDING → APPROVED
- Schedules 24h and 1h reminder jobs
- Sends WhatsApp confirmation to customer

**Response 200:** Full booking object with updated status.

**Error Cases:**
- `409 INVALID_STATUS_TRANSITION` — Booking is not in PENDING status
- `404 NOT_FOUND`

---

### POST /bookings/:id/reschedule

Reschedules an APPROVED or PENDING booking.

**Authorization:** Bearer JWT (any role)

**Request:**
```json
{
  "appointmentAt": "2026-06-07T14:00:00.000Z",
  "reason": "Customer requested change"
}
```

**Business Rules:**
- New slot must be available
- New slot must be within business hours
- Cancels existing reminder jobs and schedules new ones
- Sends WhatsApp reschedule notification to customer
- Previous status recorded in booking_status_history

**Response 200:** Full booking object.

**Error Cases:**
- `409 BOOKING_SLOT_UNAVAILABLE`
- `409 INVALID_STATUS_TRANSITION` — Cannot reschedule COMPLETED or CANCELLED booking

---

### POST /bookings/:id/cancel

Cancels a booking.

**Authorization:** Bearer JWT (any role)

**Request:**
```json
{
  "reason": "Customer requested cancellation"
}
```

**Business Rules:**
- Can cancel any booking except COMPLETED
- Cancels all scheduled reminder jobs
- Releases the slot
- Sends WhatsApp cancellation notice

**Response 200:** Full booking object.

---

## Payment APIs

### POST /payments/stk-push

Initiates an M-Pesa STK Push for a booking. Can also be called by the owner to retry a failed payment.

**Authorization:** Bearer JWT (any role)

**Request:**
```json
{
  "bookingId": "uuid",
  "phoneNumber": "+254712345678"
}
```

**Validation:**
- `bookingId`: must be APPROVED with UNPAID or PAYMENT_FAILED status
- `phoneNumber`: valid Kenyan phone (+2547xx or +2541xx)

**Business Rules:**
- Updates payment status to PAYMENT_PENDING
- Enqueues STK Push job (not synchronous — returns immediately)
- Creates a PaymentTransaction record with attempt_number

**Response 202 (Accepted):**
```json
{
  "data": {
    "paymentId": "uuid",
    "checkoutRequestId": "ws_CO_...",
    "message": "Payment request sent. Awaiting customer approval."
  }
}
```

**Error Cases:**
- `422 PAYMENT_NOT_ALLOWED` — Booking not in approvable state
- `422 AMOUNT_MISMATCH` — Amount does not match booking price
- `429 RATE_LIMITED` — STK Push already pending for this booking

---

### GET /payments

Returns paginated payment list.

**Authorization:** Bearer JWT (any role)

**Query Parameters:** `page`, `limit`, `status`, `from`, `to`, `customerId`

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
        "reference": "NB-2026-00123",
        "customer": { "name": "Wanjiku Kamau" },
        "service": { "name": "Gel Manicure" }
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 89 }
}
```

---

### GET /payments/:id

Returns a single payment with all transaction attempts.

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "status": "PAID",
    "amountKes": 1500,
    "mpesaReceiptNumber": "QHZ8XXXXXYZ",
    "transactions": [
      {
        "id": "uuid",
        "attemptNumber": 1,
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

Receives M-Pesa payment callback from Daraja. **Not authenticated with JWT** — validated with IP allowlist and Daraja signature.

**Authorization:** IP allowlist (Safaricom Daraja IPs) + request body validation

**Request (Daraja format):**
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

**Processing Logic:**
1. Find payment by CheckoutRequestID
2. Idempotency check on MpesaReceiptNumber
3. If ResultCode === 0: mark PAID, update booking
4. Else: mark FAILED, record reason
5. Enqueue WhatsApp notification job

**Response 200 (always — Daraja requires 200):**
```json
{ "ResultCode": 0, "ResultDesc": "Accepted" }
```

---

## Customer APIs

### GET /customers

**Authorization:** Bearer JWT (any role)

**Query Parameters:** `page`, `limit`, `search` (name or phone)

**Response 200:** Paginated customer list.

---

### GET /customers/:id

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
      "totalSpentKes": 18000,
      "lastBookingAt": "2026-06-04T09:00:00.000Z"
    }
  }
}
```

---

### GET /customers/:id/bookings

Returns booking history for a customer.

**Query Parameters:** `page`, `limit`, `status`

---

### GET /customers/:id/payments

Returns payment history for a customer.

---

## Notification APIs

### GET /notifications/reminders

Returns scheduled reminders (for ops visibility).

**Authorization:** Bearer JWT, role = OWNER

**Query Parameters:** `status`, `from`, `to`, `bookingId`

---

## WhatsApp Webhook APIs

### GET /webhooks/whatsapp

WhatsApp webhook verification endpoint.

**Authorization:** None (public)

**Query Parameters:**
- `hub.mode`: must equal `"subscribe"`
- `hub.verify_token`: must match `WHATSAPP_VERIFY_TOKEN` env var
- `hub.challenge`: echoed back in response body

**Response 200:** Plain text `hub.challenge` value

**Response 403:** If verify_token does not match

---

### POST /webhooks/whatsapp

Receives incoming WhatsApp messages and status updates.

**Authorization:** None (public) — validated via X-Hub-Signature-256 header

**Headers:**
- `X-Hub-Signature-256: sha256=<hmac>`

**Request (message event):**
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

**Processing:** Async — message is queued for FSM processing. 

**Response 200:** Always responds immediately with `{ "status": "ok" }` to prevent WhatsApp from retrying.

**Error Cases:** Never return non-200 to WhatsApp (causes duplicate delivery retries). Log errors internally.

---

## Services APIs

### GET /services

Returns active services.

**Authorization:** Bearer JWT (any role)

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
      "sortOrder": 1
    }
  ]
}
```

---

### POST /services

Creates a new service.

**Authorization:** Bearer JWT, role = OWNER

**Request:**
```json
{
  "name": "Gel Manicure",
  "description": "Long-lasting gel polish",
  "durationMinutes": 60,
  "priceKes": 1500,
  "sortOrder": 1
}
```

---

### PATCH /services/:id

Updates an existing service.

**Authorization:** Bearer JWT, role = OWNER

---

### DELETE /services/:id

Soft-deletes a service. Cannot delete a service with future bookings.

**Authorization:** Bearer JWT, role = OWNER

---

## Slots API

### GET /slots/availability

Returns available time slots for a given service and date.

**Authorization:** Bearer JWT (any role)  
**Also called internally by the WhatsApp FSM**

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `serviceId` | uuid | Yes | Service to check slots for |
| `date` | string | Yes | Date in YYYY-MM-DD format (EAT) |

**Response 200:**
```json
{
  "data": {
    "date": "2026-06-05",
    "serviceId": "uuid",
    "slots": [
      { "time": "10:00", "available": true, "appointmentAt": "2026-06-05T07:00:00.000Z" },
      { "time": "11:30", "available": true, "appointmentAt": "2026-06-05T08:30:00.000Z" },
      { "time": "14:00", "available": false, "appointmentAt": "2026-06-05T11:00:00.000Z" }
    ]
  }
}
```
