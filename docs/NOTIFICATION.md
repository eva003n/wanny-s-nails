# Notifications System — Wanny's Nails

Production-grade reference for the notification domain. Audience: Evan + coding agents working in this monorepo. Treat this as the source of truth for how notifications are modeled, triggered, delivered, and made reliable. If you're an agent implementing a notification-related task, read this fully before writing code.

---

## 1. Scope & Channels

Three channels, one orchestration core:

| Channel | Direction | Provider | Used for |
|---|---|---|---|
| WhatsApp | Client-facing | Meta WhatsApp Business API | Booking lifecycle, payments, reminders, feedback |
| Push (Web Push) | Admin-facing (PWA) | VAPID / browser push services | Booking + payment alerts to salon staff |
| Email | Fallback / receipts | Transactional email provider Resend | Payment receipts, admin digest, fallback when WhatsApp fails |

**Rule:** channels are a delivery detail, not a branching point in business logic. `NotificationService.dispatch(eventType, context)` never knows or cares which channel will be used — that's resolved from `NOTIFICATION_TRIGGERS` config. Don't write `if (channel === 'whatsapp')` anywhere outside the `senders/` directory.

---

## 2. Database Design

### `notifications`
Canonical record of every notification instance — one row per (recipient, channel) pair per event.

```prisma

model Notification {
  id          String         @id @default(uuid())
  bookingId   String         @map("booking_id")
  recipientId String         @map("recipient_id")
  recipientType NotificationRecipient         @map("recipient_type")
  type        NotificationType
  channel     NotificationChannel @default(EMAIL)
  payload     Json
  metadata    Json?          @default("{}")                 
  status      NotificationStatus @default(SCHEDULED)
  scheduledAt DateTime       @map("scheduled_at") // reminders
  sentAt      DateTime       @map("sent_at")
  deliveredAt DateTime?      @map("delivered_at")
  idempotencyKey String        @map(" idempotency_key")
  createdAt   DateTime       @default(now()) @map("created_at")

  booking Booking @relation(fields: [bookingId], references: [id])

  @@index([bookingId])
  @@index([scheduledAt, status])
  @@map("notifications")
}

model NotificationSubscription {
  id          String         @id @default(uuid())
  recipientId String         @map("recipient_id")
  recipientType NotificationRecipient         @map("recipient_type")
  channel     NotificationChannel
  endpoint    string  // phone number (E.164) | push endpoint URL | email address
  metadata    Json?          @default("{}")    
  isActive    Boolean        @map("is_active") @default(false)

  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")


  @@unique([recipientId, channel, endpoint])
  @@index([recipientType, recipientId, channel])
  @@map("notification_subscriptions")

}

model PushSubscription {
  id           String   @id @default(uuid())
  userId       String
  endpoint     String   @unique
  p256dh       String
  auth         String
  userAgent    String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@index([userId])
}
```
 No FK from `notifications` to the subscription tables — resolve recipient → endpoint at dispatch time, don't couple the audit record to a subscription that might later be deleted.

---

## 3. Event Sources → Notification Triggers

| Event | Client (WhatsApp) | Admin (PWA Push) | Email (fallback/receipt) |
| :----- | :---------------- | :--------------- | :--- |
| `BOOKING_CREATED` | — | New booking received | — |
| `BOOKING_PENDING_CONFIRMATION` | Booking pending confirmation | Booking awaiting confirmation | — |
| `BOOKING_CONFIRMED` | Booking confirmation | Booking confirmed | — |
| `BOOKING_REJECTED` | Booking rejected | Booking rejected | — |
| `BOOKING_CANCELLED` | Booking cancellation | Booking cancelled | — |
| `BOOKING_RESCHEDULED` | Booking rescheduled | Booking rescheduled | — |
| `BOOKING_COMPLETED` | Appointment completed | Appointment completed | — |
| `BOOKING_NO_SHOW` | Missed appointment | Customer marked as no-show | — |
| `APPOINTMENT_REMINDER` | Appointment reminder | — | — |
| `PAYMENT_REQUEST` | Payment request | — | — |
| `PAYMENT_RECEIVED` | Payment received confirmation | Customer payment received | Receipt (always sent if email on file) |
| `PAYMENT_REFUNDED` | Refund confirmation | Refund processed | Receipt |
| `PAYMENT_FAILED` | Payment failed | Customer payment failed | — |
| `PAYMENT_EXPIRED` | Payment request expired | Payment request expired | — |
| `THANK_YOU` | Thank you message | — | — |
| `FEEDBACK_REQUEST` | Feedback request | — | — |
| `REVIEW_REQUEST` | Review request | — | — |
| `WHATSAPP_DELIVERY_FAILED` (internal) | — | — | Fallback receipt/alert if client has no working WhatsApp number |

**Email fallback rule:** Email is not a parallel channel for every event — it's a fallback. If a WhatsApp send lands in `dead_letter` for a `PAYMENT_RECEIVED` or `BOOKING_CONFIRMED` event, the reconciliation job enqueues an email fallback **only if** the client has an email on file. Don't double-send WhatsApp + Email by default; that's noisy and most Kenyan clients in this flow won't check email.

```typescript
// apps/api/modules/notifications/notification-triggers.ts
export const NOTIFICATION_TRIGGERS = {
  BOOKING_CREATED: {
    recipients: [
      { type: 'admin', channel: 'push', template: 'new_booking_alert' },
    ],
  },
  BOOKING_CONFIRMED: {
    recipients: [
      { type: 'client', channel: 'whatsapp', template: 'booking_confirmation' },
      { type: 'admin', channel: 'push', template: 'booking_confirmed_alert' },
    ],
  },
  APPOINTMENT_REMINDER: {
    recipients: [
      { type: 'client', channel: 'whatsapp', template: 'reminder_24h' // reminder_1h
       },
    ],
  },
  PAYMENT_RECEIVED: {
    recipients: [
      { type: 'client', channel: 'whatsapp', template: 'payment_receipt' },
      { type: 'admin', channel: 'push', template: 'payment_received_alert' },
      { type: 'client', channel: 'email', template: 'payment_receipt_email', condition: 'hasEmail' },
    ],
  },
  // ... remaining rows from the table above, same shape
} as const;

export type NotificationEventType = keyof typeof NOTIFICATION_TRIGGERS;
```

Add a `condition` field (optional) for recipients that should only fire under a predicate (e.g. `hasEmail`, `isOptedIn`). The dispatcher evaluates it against `context` before enqueueing — keeps conditional logic declarative instead of buried in handlers.

---

## 4. Template Registry

Every `template` string referenced above must resolve to exactly one entry here. This is the part agents most often get wrong — adding a trigger without registering its template, or duplicating a template under two names.

```typescript
// apps/api/modules/notifications/templates/registry.ts
export const TEMPLATES = {
  booking_confirmation: {
    channel: 'whatsapp',
    waTemplateName: 'booking_confirmation_v2', // must match Meta-approved template name exactly
    requiresApproval: true, // outside 24h session window
    vars: ['clientName', 'serviceName', 'dateTime', 'salonAddress'],
  },
  reminder_24h: {
    channel: 'whatsapp',
    waTemplateName: 'appointment_reminder_v1',
    requiresApproval: true,
    vars: ['clientName', 'serviceName', 'dateTime'],
  },
  new_booking_alert: {
    channel: 'push',
    requiresApproval: false,
    vars: ['clientName', 'serviceName', 'dateTime'],
  },
  payment_receipt_email: {
    channel: 'email',
    requiresApproval: false,
    vars: ['clientName', 'amount', 'receiptUrl'],
  },
  // ...
} as const;
```

**Rules for agents touching templates:**
- Never inline a message string in a handler. Register it here first, reference by key.
- WhatsApp templates with `requiresApproval: true` cannot be sent until the matching name exists and is **approved** in WhatsApp Business Manager. If you add a new WhatsApp template to this registry, that is a deploy blocker until approval comes through — flag it, don't silently fall back to a free-form message outside the 24h session window (Meta will reject it).
- Version template names when changing wording (`_v2`, `_v3`) rather than mutating an approved template's expected variables — approval is per exact template content.

---

## 5. Orchestration Layer

```
apps/api → emits domain event (internal event emitter or DB row insert)
        ↓
NotificationService.dispatch(eventType, context)
        ↓
  1. Look up trigger config for eventType
  2. For each recipient config: evaluate `condition` if present
  3. Resolve recipient → endpoint (notification_subscriptions / push_subscriptions)
  4. Render template with context vars (validate all `vars` are present — throw if not)
  5. Write notification record (status: 'pending'), idempotencyKey = `${bookingId}:${eventType}:${channel}`
  6. Enqueue BullMQ job per (recipient, channel), referencing notification.id
  7. Update notification status -> 'queued'
```

**Non-negotiable ordering: write the DB row before enqueueing the job.** If the process crashes between steps 5 and 6, a reconciliation sweep can find `pending` rows with no corresponding job and re-enqueue. If you enqueue first and the DB write fails, you've sent something with no record — unrecoverable and undebuggable.

```typescript
// apps/api/modules/notifications/notification.service.ts
async function dispatch(eventType: NotificationEventType, context: NotificationContext) {
  const trigger = NOTIFICATION_TRIGGERS[eventType];
  if (!trigger) {
    logger.warn(`No trigger registered for event: ${eventType}`);
    return;
  }

  for (const recipientConfig of trigger.recipients) {
    if (recipientConfig.condition && !evaluateCondition(recipientConfig.condition, context)) {
      continue;
    }

    const endpoint = await resolveEndpoint(recipientConfig.type, recipientConfig.channel, context);
    if (!endpoint) {
      logger.warn(`No active ${recipientConfig.channel} endpoint for ${recipientConfig.type}`, { context });
      continue;
    }

    const idempotencyKey = `${context.bookingId}:${eventType}:${recipientConfig.channel}`;

    const notification = await db.notification.upsert({
      where: { idempotencyKey },
      create: {
        type: eventType,
        recipientType: recipientConfig.type,
        recipientId: endpoint.recipientId,
        channel: recipientConfig.channel,
        payload: renderTemplate(recipientConfig.template, context),
        idempotencyKey,
        bookingId: context.bookingId,
        status: 'pending',
      },
      update: {}, // idempotent: if it already exists, don't reset status or re-send
    });

    await notificationQueue.add(`send-${recipientConfig.channel}`, {
      notificationId: notification.id,
      endpoint,
      template: recipientConfig.template,
    }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
    });

    await db.notification.update({ where: { id: notification.id }, data: { status: 'queued' } });
  }
}
```

Note the `upsert` with a no-op `update`: this makes `dispatch()` itself safe to call twice for the same event (e.g. a retried API request) without creating a duplicate row or resetting an already-sent notification back to pending.

---

## 6. WhatsApp Delivery (client-facing)

Outbound half of the same FSM that handles inbound conversation — architecturally simpler, distinct gotchas.

- **Session vs template messages.** Within a 24h customer-initiated session, free-form messages are allowed. Outside it, only pre-approved templates work. Booking confirmations sent right after a client messages you can be free-form; a `reminder_24h` sent a day later must use an approved template.
- **Submit templates ahead of time.** Approval has lead time — budget for it in your rollout schedule, not as a same-day dependency.
- **Rate limits & messaging tiers.** WhatsApp Business accounts have tiered 24h messaging limits (250/1K/10K/unlimited unique users) scaling with quality rating. Configure BullMQ's per-queue rate limiter to match your current tier — don't hardcode an optimistic number.
- **Delivery status webhooks.** `sent → delivered → read → failed` callbacks land on a webhook endpoint that updates `notifications.status`. Verify the HMAC signature on every webhook call — same pattern as the M-Pesa callback validation already in this codebase. Never trust an unsigned webhook body.

```typescript
// apps/workers/notification-worker/senders/whatsapp-sender.ts
async function sendWhatsAppNotification(job: Job<NotificationJobData>) {
  const { notificationId, endpoint, template } = job.data;
  const templateConfig = TEMPLATES[template];

  if (templateConfig.requiresApproval) {
    const sessionActive = await isWithinCustomerSession(endpoint.phone);
    if (!sessionActive) {
      // must use the approved template path; free-form will be rejected by Meta
    }
  }

  const response = await whatsappClient.sendTemplate({
    to: endpoint.phone,
    template: templateConfig.waTemplateName,
    params: await loadRenderedPayload(notificationId),
  });

  await db.notification.update({
    where: { id: notificationId },
    data: {
      status: 'sent',
      sentAt: new Date(),
      providerMessageId: response.messages[0].id, // needed to correlate the later webhook
    },
  });
}
```

```typescript
// apps/api/modules/notifications/webhooks/whatsapp-webhook.handler.ts
async function handleWhatsAppStatusWebhook(req: Request) {
  verifyHmacSignature(req); // throws if invalid — never skip

  for (const statusUpdate of req.body.entry[0].changes[0].value.statuses ?? []) {
    await db.notification.updateMany({
      where: { providerMessageId: statusUpdate.id },
      data: {
        status: mapWaStatus(statusUpdate.status), // 'delivered' | 'read' | 'failed'
        deliveredAt: statusUpdate.status === 'delivered' ? new Date() : undefined,
        readAt: statusUpdate.status === 'read' ? new Date() : undefined,
        failedAt: statusUpdate.status === 'failed' ? new Date() : undefined,
        lastError: statusUpdate.errors?.[0]?.title,
      },
    });
  }
}
```

---

## 7. PWA Push Delivery (admin-facing)

Standard Web Push, but prod-grade means handling the edge cases:

```javascript
// apps/web/public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      data: { url: data.url },
      tag: data.notificationId, // collapses duplicate notifications for the same event
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((newSub) => fetch('/api/push-subscriptions/refresh', {
        method: 'POST',
        body: JSON.stringify(newSub),
      }))
  );
});
```

```typescript
// apps/workers/notification-worker/senders/push-sender.ts
async function sendPushNotification(job: Job<NotificationJobData>) {
  const { notificationId, endpoint } = job.data;
  const sub = await db.pushSubscription.findUnique({ where: { id: endpoint.subscriptionId } });
  if (!sub?.isActive) {
    await db.notification.update({ where: { id: notificationId }, data: { status: 'failed', lastError: 'subscription_inactive' } });
    return;
  }

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(await loadRenderedPayload(notificationId))
    );
    await db.notification.update({ where: { id: notificationId }, data: { status: 'sent', sentAt: new Date() } });
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await db.pushSubscription.update({ where: { id: sub.id }, data: { isActive: false } });
    }
    throw err; // let BullMQ retry policy handle transient failures
  }
}
```

- **VAPID keys**: generate once, store in secrets manager / `.env`, never rotate without re-registering all clients.
- **Fallback to in-app is mandatory, not optional.** Push requires the PWA to have been opened once and permission granted — many admins won't have done this. Every push-eligible notification must also write an `InAppNotification` row in the same transaction as the `Notification` row, so the dashboard bell is correct regardless of push delivery.

---

## 8. Email Delivery (fallback/receipts)

```typescript
// apps/workers/notification-worker/senders/email-sender.ts
async function sendEmailNotification(job: Job<NotificationJobData>) {
  const { notificationId, endpoint, template } = job.data;
  const payload = await loadRenderedPayload(notificationId);

  await emailClient.send({
    to: endpoint.email,
    subject: TEMPLATES[template].subject,
    html: renderEmailTemplate(template, payload),
  });

  await db.notification.update({ where: { id: notificationId }, data: { status: 'sent', sentAt: new Date() } });
}
```

- Email has no session-window restriction like WhatsApp — always free-form, but still goes through the same template registry for consistency and auditability.
- Used for: receipts (always, if email on file), and as a **fallback** when a WhatsApp send for a critical event (`BOOKING_CONFIRMED`, `PAYMENT_RECEIVED`) ends up in `dead_letter` — see reconciliation job below.

---

## 9. Reliability Layer

This is what separates "it sends a WhatsApp message" from "production-grade."

**Retry strategy** — exponential backoff, capped attempts, explicit dead-letter handling:

```typescript
await notificationQueue.add(`send-${channel}`, jobData, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86400 },
  removeOnFail: false, // keep failed jobs visible for inspection
});
```

**Dead-letter handling** — after final retry failure, BullMQ's failed set is the DLQ. A worker event listener marks the notification row:

```typescript
notificationQueue.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    await db.notification.update({
      where: { id: job.data.notificationId },
      data: { status: 'dead_letter', lastError: err.message },
    });

    // critical-event fallback: if this was a WhatsApp send for a critical event, try email
    if (job.data.channel === 'whatsapp' && CRITICAL_EVENTS.includes(job.data.eventType)) {
      await tryEmailFallback(job.data);
    }
  }
});
```

Surface `dead_letter` rows on the admin dashboard: "3 reminders failed to send — retry?"

**Reconciliation job** — cron-driven sweep (every 5 min), checks for:
- `pending` notifications older than 5 min with no associated job (crash recovery between DB write and enqueue)
- `sent` WhatsApp messages with no delivery webhook after 10 min (possible API/webhook issue — flag, don't auto-retry blindly)
- Scheduled reminders that should have fired but didn't (clock drift, worker downtime) — compare `scheduledFor` against `now()` for rows still `pending`

**Idempotency at delivery, not just enqueue.** The `idempotencyKey` on the `notifications` row prevents duplicate *rows*, but a retried BullMQ job can still hit "first attempt actually succeeded, ack was lost" — pass a client-generated reference to the WhatsApp/email API where the provider supports dedup, so your own backoff retries can't double-send.

**Observability** — structured logs per notification: `notification_id`, `correlation_id` (= `booking_id`), `channel`, `event_type`, `status_transition`. Metrics: `notifications_sent_total{channel,type,status}`, `notifications_failed_total{channel,type,reason}`, `notification_delivery_latency_seconds{channel}`. Export to whatever your existing observability stack consumes (mirror the standard already set in the frontend rules README).

---

## 10. Scheduling Reminders

Time-deferred, not event-driven — the trickiest category.

```typescript
// when booking is confirmed
const job = await reminderQueue.add(
  'reminder-24h',
  { bookingId, eventType: 'APPOINTMENT_REMINDER' },
  { delay: msUntil(appointment.startTime.getTime() - 24 * 60 * 60 * 1000) }
);

await db.booking.update({ where: { id: bookingId }, data: { reminder24hJobId: job.id } });
```

**Mandatory rule: cancel the scheduled job on reschedule/cancellation.**

```typescript
async function onBookingCancelledOrRescheduled(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (booking.reminder24hJobId) {
    await reminderQueue.remove(booking.reminder24hJobId);
  }
  if (booking.reminder1hJobId) {
    await reminderQueue.remove(booking.reminder1hJobId);
  }
  // if rescheduled (not cancelled), re-enqueue against the new time and store new job ids
}
```

Forgetting this is the classic bug: client cancels, reminder fires anyway, client is confused or annoyed. Any agent touching the cancellation/reschedule path must check this file for job-id cleanup as part of the change — not just the booking status update.

---

## 11. Security

- **Webhook signature verification is mandatory** on every inbound webhook (WhatsApp delivery status, any email provider bounce/complaint webhook). Reuse the HMAC verification pattern from the M-Pesa Daraja integration — never process a webhook body before verifying its signature.
- **Secrets**: WhatsApp access token, VAPID private key, email provider API key all live in environment-specific secrets (not committed, not logged). Never log full payloads containing phone numbers or tokens — redact in structured logs.
- **PII minimization**: `notifications.payload` stores rendered template variables for debugging — avoid storing raw payment details or full card/M-Pesa transaction metadata here; reference the source record (`bookingId`, a payment id) instead and join when needed.
- **Rate limit inbound webhook endpoints** separately from outbound sending rate limits — a webhook flood (legitimate or malicious) shouldn't be able to overwhelm the API process.

---

## 12. Testing Strategy

- **Unit**: template rendering (missing vars throw), trigger config resolution (correct recipients for each event, `condition` evaluation), idempotency key generation.
- **Integration**: `NotificationService.dispatch()` against a test DB — verify row written before job enqueued; verify `upsert` behavior doesn't reset status on duplicate dispatch calls.
- **Worker tests**: each sender (`whatsapp-sender`, `push-sender`, `email-sender`) mocked against the provider SDK — verify status transitions on success, verify `410`/`404` marks subscription inactive, verify thrown errors trigger BullMQ retry (not swallowed).
- **Webhook tests**: signature verification rejects tampered/unsigned payloads; valid payloads correctly update `notifications.status` via `providerMessageId` correlation.
- **Reconciliation job tests**: seed `pending` rows with old timestamps, verify sweep re-enqueues; seed `sent` rows past the delivery-webhook timeout, verify they're flagged not silently retried.
- **Manual/staging-only**: actual WhatsApp template send against Meta's test number before any new approved template goes to production — confirms the approved template name and variable count match exactly.

---

## 13. Rules for Agents Working in This Domain

1. **Never hardcode a message string.** Register it in the template registry (§4) first.
2. **Never add a trigger row without registering its template(s).** Both halves ship together.
3. **Never call a provider SDK (WhatsApp/webpush/email) directly from `apps/api`.** All sends go through `notificationQueue` → worker → sender. The API only dispatches and writes rows.
4. **Never skip the DB-row-before-enqueue ordering** in §5. If you're refactoring `dispatch()`, preserve this.
5. **Never touch booking cancellation/reschedule logic without checking for orphaned reminder jobs** (§10).
6. **Never process a webhook before verifying its signature** (§11).
7. **If adding a new WhatsApp template that requires approval**, flag it explicitly as a deploy blocker — don't assume same-day availability.
8. **If a channel send can fail in a way that matters to the business** (booking confirmation, payment receipt), make sure there's a fallback or DLQ visibility path — don't let it fail silently into `dead_letter` with nothing surfaced.
9. **When in doubt about whether something is a new event type or a variant of an existing one**, check the trigger table (§3) first — extend it before inventing a new `NotificationEventType`.

---

## 14. Rollout Order

1. Migrate `notifications`, `notification_subscriptions`, `push_subscriptions`, `in_app_notifications` tables.
2. Build `NotificationService.dispatch()` core + trigger config + template registry skeleton.
3. Wire `BOOKING_CONFIRMED` → WhatsApp confirmation (reuses existing WhatsApp client from FSM work).
4. Add admin push: VAPID setup, service worker, subscription endpoint, `new_booking_alert`.
5. Reminder scheduling + cancellation-aware job removal.
6. WhatsApp delivery-status webhook handler (with signature verification).
7. Email sender + critical-event fallback path.
8. Reconciliation cron + DLQ dashboard surfacing.
9. Rate limiting tuned to current WhatsApp messaging tier.
10. Observability: structured logs + metrics wired into existing stack.