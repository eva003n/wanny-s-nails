# Security Specification — Wanny's Nails

**Version:** 1.0

---

## Authentication

### Staff / Owner (PWA App)

- **Mechanism:** JWT (access token + refresh token pair)
- **Access token TTL:** 1 hour
- **Refresh token TTL:** 7 days
- **Storage (PWA):** Both tokens set as signed `httpOnly` `Secure` `SameSite=Strict` cookies. Access token also returned in response body (React context backup).
- **Algorithm:** HS256, secret minimum 256 bits (32 bytes), stored in environment variable

**Login flow:**
1. POST `/auth/login` with email + password
2. Server validates password with `bcrypt.compare` (cost factor 12)
3. Returns `accessToken` (short-lived JWT) + `refreshToken` (opaque random token stored in DB)
4. Both tokens are set as signed `httpOnly` cookies
5. Refresh token is hashed before DB storage (SHA-256)

**Token refresh:**
1. POST `/auth/refresh` with refreshToken
2. Server finds hashed token in DB, validates not expired/revoked
3. Issues new accessToken + refresh token, both set as signed `httpOnly` cookies (sliding window)

**Logout:**
1. POST `/auth/logout` — marks refreshToken as revoked in DB
2. PWA app clears both signed `httpOnly` cookies

**Failed login handling:**
- After 5 failed attempts on the same email within 15 minutes: account temporarily locked for 30 minutes
- Lockout state stored in Redis (`lockout:{email}`)
- Do NOT distinguish between wrong email and wrong password in error messages (prevents user enumeration)

---

## Authorization

### Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| `OWNER` | **Full access** — manage team (invite/deactivate staff), change M-Pesa/WhatsApp configuration, delete services, view all reports, mark manual payments, view payment amounts, soft-delete bookings |
| `ADMIN` | All `STAFF` permissions **plus** user management (list/create/update/deactivate users), view payment amounts, manage bookings and customers |
| `STAFF` | Create/view/approve/reschedule/cancel bookings; view customers; view payments (no amounts); view schedule |

**Rules:**

- Staff cannot see payment amounts — they can only see "Paid" / "Unpaid" status
- ADMIN can manage users (list/create/update/deactivate) but cannot delete records, manage team, or change M-Pesa/WhatsApp configuration
- Only OWNER can delete records (soft delete)
- Only OWNER can manage team (invite/deactivate staff)
- Only OWNER can change M-Pesa or WhatsApp configuration

---

## Webhook Security

### WhatsApp Webhook

All incoming POST requests to `/webhooks/whatsapp` are validated before processing:

```typescript
function validateWhatsAppSignature(req: Request): void {
  const signature = req.headers["x-hub-signature-256"] as string;
  if (!signature) throw new UnauthorizedError("Missing signature");

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
      .update(req.rawBody) // raw bytes, not parsed JSON
      .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new UnauthorizedError("Invalid signature");
  }
}
```

`req.rawBody` must be captured before JSON parsing middleware runs.

### Daraja Callback

M-Pesa callbacks are validated by:

1. **IP allowlist** — Only accept callbacks from Safaricom's known Daraja IP ranges (maintained as env config)
2. **Request body validation** — Zod schema validation on callback body shape
3. **Business validation** — CheckoutRequestID must match a known pending payment

---

## Rate Limiting

```typescript
// Global rate limiter (all routes)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// Auth endpoints — stricter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many login attempts" },
  },
});

// WhatsApp webhook — generous (Meta sends bursts)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  skip: (req) => validateWhatsAppSignature(req), // signed requests bypass count
});
```

---

## Secrets Management

### Development

Secrets in `.env, .env.development, .env.production` file (gitignored). `.env.example` committed with placeholder values.

### Production

Secrets stored in the hosting platform's secret store (e.g., Railway Secrets, Render Secrets, or environment variables injected at deploy time). Never committed to version control.

### Required Secrets

| Variable                   | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string                        |
| `REDIS_URL`                | Redis connection string                             |
| `JWT_SECRET`               | Min 32 bytes, generated with `openssl rand -hex 32` |
| `WHATSAPP_ACCESS_TOKEN`    | Meta permanent access token                         |
| `WHATSAPP_APP_SECRET`      | Meta app secret (for signature validation)          |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business phone number ID                   |
| `WHATSAPP_VERIFY_TOKEN`    | Custom token for webhook verification               |
| `DARAJA_CONSUMER_KEY`      | Safaricom Daraja consumer key                       |
| `DARAJA_CONSUMER_SECRET`   | Safaricom Daraja consumer secret                    |
| `DARAJA_PASSKEY`           | Safaricom Daraja passkey                            |
| `DARAJA_SHORTCODE`         | M-Pesa paybill/till number                          |
| `RESEND_API_KEY`           | SendGrid email API key                              |

**Rotation policy:**

- JWT_SECRET: rotate every 90 days (all active sessions invalidated — acceptable given 7-day refresh token TTL with re-login prompt)
- WhatsApp/Daraja credentials: rotate immediately on suspected compromise

---

## Audit Logging

All significant actions are written to the `audit_logs` table **within the same database transaction as the action itself**.

### Audited Events

| Event                           | Actor                    |
| ------------------------------- | ------------------------ |
| Booking created                 | USER / SYSTEM            |
| Booking approved                | USER                     |
| Booking cancelled               | USER / CUSTOMER          |
| Booking rescheduled             | USER / CUSTOMER          |
| Payment initiated               | SYSTEM                   |
| Payment completed               | SYSTEM (Daraja callback) |
| Payment manually marked         | USER                     |
| Staff account created           | USER (OWNER)             |
| Staff account deactivated       | USER (OWNER)             |
| Service created/updated/deleted | USER (OWNER)             |
| Business hours updated          | USER (OWNER)             |
| Login success/failure           | SYSTEM                   |

### Log Content

```typescript
interface AuditLogEntry {
  entityType: string; // "Booking", "Payment", "User"
  entityId: string;
  action: string; // "APPROVED", "CANCELLED", etc.
  actorType: string; // "USER", "SYSTEM", "CUSTOMER"
  actorId?: string;
  before?: object; // Relevant fields before change (no PII like passwords)
  after?: object; // Relevant fields after change
  ipAddress?: string; // For USER actions
}
```

**PII in audit logs:** Customer phone numbers are stored in audit logs as they are business-critical for reconciliation. Passwords are never logged. Full payment callback bodies have Daraja credentials stripped before storage.

---

## Encryption

### Data in Transit

- All HTTP endpoints served over TLS 1.2+
- HSTS header enforced in production
- TLS terminated at the load balancer/proxy

### Data at Rest

- PostgreSQL database encryption at rest via hosting provider (Railway/Render)
- Redis data encrypted at rest via hosting provider
- Backups encrypted before upload to object storage

### Sensitive Fields in DB

- Passwords: bcrypt hash (cost 12) — never store plaintext
- Daraja credentials: environment variables only — never in DB
- M-Pesa receipt numbers: stored plaintext (required for reconciliation, not sensitive)
- Customer phone numbers: stored plaintext (required for WhatsApp/SMS — business necessity)

---

## Kenya Data Protection Act (KDPA) 2019 Compliance

### Data Controller Registration

The salon owner is the Data Controller. Registration with the Office of the Data Protection Commissioner (ODPC) is required before go-live.

### Lawful Basis for Processing

- **Contract performance:** Customer name and phone number processed to fulfil the booking contract
- **Consent:** Marketing messages (if any future upsells) require explicit opt-in

### Consent Management

Consent is captured at first interaction in the WhatsApp flow:

```
Welcome to Wanny's Nails! 👋

By continuing, you agree that we may:
• Store your name and phone number to manage your bookings
• Send you appointment reminders and updates

Reply YES to continue or STOP to opt out.
```

Consent is recorded in `customers.consent_given` and `customers.consent_at`.

**Opt-out:** Customer replies "STOP" at any time. System:

1. Sets `consent_given = false`
2. Removes all scheduled reminder jobs
3. Sends confirmation: "You have been unsubscribed. You won't receive further messages from us."
4. Future messages blocked (checked before every outbound message)

### Data Subject Rights

| Right                  | Implementation                                             |
| ---------------------- | ---------------------------------------------------------- |
| Right to access        | Owner can export customer data from PWA app (CSV export)   |
| Right to rectification | Owner can edit customer name/email from app                |
| Right to erasure       | Soft delete customer + bookings; hard delete after 7 years |
| Right to portability   | JSON/CSV export of customer's booking history              |
| Right to object        | Opt-out ("STOP") removes from all messaging                |

### Data Retention

- Booking and payment data: 7 years (Kenya financial regulations)
- Conversation logs (Redis): 30-minute TTL (auto-cleared)
- Conversation session history (DB): 90 days then deleted by scheduled job
- Audit logs: 7 years

### Data Minimisation

- Only name and phone number collected from customers (email is optional)
- No biometric data, national ID, or financial account details stored
- M-Pesa phone number stored only for payment reconciliation

---

## WhatsApp Business Policy Compliance

1. **Opt-in required:** Customers must initiate the conversation or have previously opted in before receiving template messages
2. **Template approval:** All outbound templates submitted and approved by Meta before deployment
3. **No spam:** Messages only sent in response to customer actions or for appointment-related notifications
4. **Honest identity:** Business name and purpose clearly communicated in first message
5. **Opt-out honoured:** STOP keyword processed immediately
6. **No prohibited content:** No financial solicitation, no deceptive content