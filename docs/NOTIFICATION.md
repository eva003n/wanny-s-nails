# Notifications System — Wanny's Nails

Production-grade reference for the notification domain. Audience: Evan + coding agents working in this monorepo. Treat this as the source of truth for how notifications are modeled, triggered, delivered, and made reliable. If you're an agent implementing a notification-related task, read this fully before writing code.

---

## 1. Scope & Channels

Three channels, one orchestration core:

| Channel | Direction | Provider | Used for |
|---|---|---|---|
| WhatsApp | Client-facing | Meta WhatsApp Business API | Booking lifecycle, payments, reminders, feedback |
| Push (Web Push) | Admin-facing (PWA) | VAPID / browser push services | Booking + payment alerts to salon staff |
| Email | Fallback / receipts | Transactional email provider | Payment receipts, admin digest, fallback when WhatsApp fails |

**Key design decisions:**

- **One dispatcher, one queue.** A single `notificationQueue` receives all notification intents. The dispatch job writes the `Notification` row first, then enqueues the send. Per-channel routing is handled by the dispatcher, not by separate queues. This decouples "what happened and who needs to know" from "how to deliver it."
- **Channel senders are isolated.** WhatsApp, push, and email each have their own sender module. The dispatcher never calls a provider SDK directly — it uses the queue → worker → sender pipeline.
- **The `notifications` table is the source of truth for delivery state**, not queue state. Queue state is ephemeral; the `notifications` row is permanent and drives the admin PWA's notification audit trail.
- **Workers are stateless.** No in-memory state survives a restart. All coordination goes through Redis (rate limits, dedup keys) or Postgres (delivery log).
- **Channels are a delivery detail, not a branching point in business logic.** `NotificationService.dispatch(eventType, context)` never knows or cares which channel will be used — that's resolved from `NOTIFICATION_TRIGGERS` config. Don't write `if (channel === 'whatsapp')` anywhere outside the `senders/` directory.

---

## 2. Database Design

### `notifications`
Canonical record of every notification instance — one row per (recipient, channel) pair per event.

```prisma
model Notification {
  id              String               @id @default(uuid())
  bookingId       String               @map("booking_id")
  recipientId     String               @map("recipient_id")
  recipientType   NotificationRecipient @map("recipient_type")
  type            NotificationType
  channel         NotificationChannel  @default(EMAIL)
  payload         Json
  metadata        Json?                @default("{}")                 
  status          NotificationStatus   @default(PENDING)
  scheduledAt     DateTime?            @map("scheduled_at")
  sentAt          DateTime?            @map("sent_at")
  deliveredAt     DateTime?            @map("delivered_at")
  readAt          DateTime?            @map("read_at")
  failedAt        DateTime?            @map("failed_at")
  lastError       String?              @map("last_error")
  correlationId   String?              @map("correlation_id")
  idempotencyKey  String               @unique @map("idempotency_key")
  createdAt       DateTime             @default(now()) @map("created_at")

  booking   Booking  @relation(fields: [bookingId], references: [id])

  @@index([bookingId])
  @@index([scheduledAt, status])
  @@index([recipientType, recipientId])
  @@index([idempotencyKey])
  @@map("notifications")
}
```

**Why `payload Json` on the notification row:** template rendering happens at dispatch time, not at delivery time. Storing the rendered payload means a customer support query in three months can show exactly what text was sent, even if the template has since changed. Never store raw template + variables and re-render on demand — rendered content is the audit artifact, not the template.

**No FK from `notifications` to the subscription tables** — resolve recipient → endpoint at dispatch time, don't couple the audit record to a subscription that might later be deleted.

### `notification_subscriptions`
Stores delivery endpoints per (recipient, channel) pair:

```prisma
model NotificationSubscription {
  id            String                @id @default(uuid())
  recipientId   String                @map("recipient_id")
  recipientType NotificationRecipient @map("recipient_type")
  channel       NotificationChannel
  endpoint      String  // phone number (E.164) | push endpoint URL | email address  
  metadata      Json?                 @default("{}")    
  isActive      Boolean               @map("is_active") @default(false)

  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@unique([recipientId, channel, endpoint])
  @@index([recipientType, recipientId, channel])
  @@map("notification_subscriptions")
}
```

### `push_subscriptions`
VAPID push subscriptions for admin/staff browser notifications:

```prisma
model PushSubscription {
  id        String   @id @default(uuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("push_subscriptions")
}
```

### `notification_preferences`
Admin preferences — clients don't have preferences (WhatsApp is always-on):

```prisma
model NotificationPreference {
  id              String   @id @default(uuid())
  adminUserId     String   @unique @map("admin_user_id")
  webPush         Boolean  @default(true)
  email           Boolean  @default(true)
  quietHoursStart Int?     @map("quiet_hours_start") // 0-23, Africa/Nairobi hour
  quietHoursEnd   Int?     @map("quiet_hours_end")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("notification_preferences")
}
```

---

## 3. Event Sources → Notification Triggers

| Event | Client (WhatsApp) | Admin (PWA Push) | Email (fallback/receipt) |
| :----- | :---------------- | :--------------- | :--- |
| `BOOKING_CREATED` | — | New booking received | — |
| `BOOKING_PENDING_CONFIRMATION` | Booking pending confirmation | Booking awaiting confirmation | — |
| `BOOKING_CONFIRMED` | Booking confirmation | Booking confirmed | — |
| `BOOKING_REJECTED` | Booking rejected | Booking rejected | — |
| `BOOKING_CANCELLED` | (client cancelled → admin push; admin cancelled → client whatsapp) | (client cancelled → admin push; admin cancelled → client whatsapp) | — |
| `BOOKING_RESCHEDULED` | Booking rescheduled | Booking rescheduled | — |
| `BOOKING_COMPLETED` | Appointment completed | Appointment completed | — |
| `BOOKING_NO_SHOW` | Missed appointment | Customer marked as no-show | — |
| `APPOINTMENT_REMINDER` | Appointment reminder (24h or 1h) | — | — |
| `PAYMENT_REQUEST` | Payment request | — | — |
| `PAYMENT_RECEIVED` | Payment received confirmation | Customer payment received | Receipt (always sent if email on file) |
| `PAYMENT_REFUNDED` | Refund confirmation | Refund processed | Receipt |
| `PAYMENT_SUCCESS` | Payment success notification | — | — |
| `PAYMENT_FAILED` | Payment failed | Customer payment failed | — |
| `PAYMENT_EXPIRED` | Payment request expired | Payment request expired | — |
| `PAYMENT_RETRY_PROMPT` | Payment retry prompt with button | — | — |
| `SLOT_RELEASED` | — | Slot re-opened on calendar | — |
| `REVIEW_RECEIPT` | Booking summary/review | — | — |
| `THANK_YOU` | Thank you message | — | — |
| `FEEDBACK_REQUEST` | Feedback request | — | — |
| `REVIEW_REQUEST` | Review request | — | — |

**Cancellation routing distinction:** `BOOKING_CANCELLED` is a single event type in the Prisma schema, but the dispatcher context carries who initiated the cancellation (`cancelledBy` = `CLIENT` or `ADMIN`). The trigger config for `BOOKING_CANCELLED` uses a condition to decide which channel to fire based on the initiator. When the client cancels, the admin gets a push notification. When the admin cancels, the client gets a WhatsApp message.

**Email fallback rule:** Email is not a parallel channel for every event — it's a fallback. If a WhatsApp send lands in `dead_letter` for a `PAYMENT_RECEIVED` or `BOOKING_CONFIRMED` event, the reconciliation job enqueues an email fallback **only if** the client has an email on file. Don't double-send WhatsApp + Email by default; that's noisy and most Kenyan clients in this flow won't check email.

```typescript
// apps/api/modules/notifications/notification-triggers.ts
export const NOTIFICATION_TRIGGERS = {
  BOOKING_CREATED: {
    recipients: [
      { type: 'OWNER', channel: 'PUSH', template: 'new_booking_alert' },
    ],
  },
  BOOKING_CONFIRMED: {    recipients: [
      { type: 'CLIENT', channel: 'WHATSAPP', template: 'booking_confirmation' },
      { type: 'OWNER', channel: 'PUSH', template: 'booking_confirmed_alert' },
    ],
  },
  APPOINTMENT_REMINDER: {
    recipients: [
      { type: 'CLIENT', channel: 'WHATSAPP', template: 'reminder_24h' },
    ],
  },
  PAYMENT_RECEIVED: {
    recipients: [
      { type: 'CLIENT', channel: 'WHATSAPP', template: 'payment_receipt' },
      { type: 'OWNER', channel: 'PUSH', template: 'payment_received_alert' },
      { type: 'CLIENT', channel: 'EMAIL', template: 'payment_receipt_email', condition: 'hasEmail' },
    ],
  },
  SLOT_RELEASED: {
    recipients: [
      { type: 'OWNER', channel: 'PUSH', template: 'slot_released_alert' },
    ],
  },
  PAYMENT_RETRY_PROMPT: {
    recipients: [
      { type: 'CLIENT', channel: 'WHATSAPP', template: 'payment_retry_prompt' },
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
    channel: 'WHATSAPP',
    waTemplateName: 'booking_confirmation_v2', // must match Meta-approved template name exactly
    requiresApproval: true, // outside 24h session window
    vars: ['clientName', 'serviceName', 'dateTime', 'salonAddress'],
  },
  reminder_24h: {
    channel: 'WHATSAPP',
    waTemplateName: 'appointment_reminder_v1',
    requiresApproval: true,
    vars: ['clientName', 'serviceName', 'dateTime'],
  },
  new_booking_alert: {
    channel: 'PUSH',
    pushTitle: 'New Booking',
    requiresApproval: false,
    vars: ['clientName', 'serviceName', 'dateTime'],
  },
  payment_receipt_email: {
    channel: 'EMAIL',
    subject: 'Your Payment Receipt — Wanny\'s Nails',
    requiresApproval: false,
    vars: ['clientName', 'amount', 'receiptUrl'],
  },
  slot_released_alert: {
    channel: 'PUSH',
    pushTitle: 'Slot Available',
    requiresApproval: false,
    vars: ['dateTime'],
  },
  payment_retry_prompt: {
    channel: 'WHATSAPP',
    waTemplateName: 'payment_retry_prompt_v1',
    requiresApproval: true,
    vars: ['clientName', 'serviceName', 'amount'],
  },
  // ...
} as const;
```

**Rules for agents touching templates:**
- Never inline a message string in a handler. Register it here first, reference by key.
- WhatsApp templates with `requiresApproval: true` cannot be sent until the matching name exists and is **approved** in WhatsApp Business Manager. If you add a new WhatsApp template to this registry, that is a deploy blocker until approval comes through — flag it, don't silently fall back to a free-form message outside the 24h session window (Meta will reject it).
- Version template names when changing wording (`_v2`, `_v3`) rather than mutating an approved template's expected variables — approval is per exact template content.
- The WhatsApp Cloud API message payload shape (template body parameters, quick reply buttons, etc.) is rendered in the WhatsApp sender worker, not in the registry. The registry only defines variable names; the sender constructs the Cloud API message object from those variables.

---

## 5. Orchestration Layer

```
Domain event fires (booking confirmed, payment received, scheduled reminder)
         ↓
NotificationService.dispatch(eventType, context)
         ↓
  1. Look up trigger config for eventType
  2. For each recipient config: evaluate `condition` if present
  3. Resolve recipient → endpoint (customer phone, admin userId for push, customer email)
  4. Render template with context vars (validate all `vars` are present — throw if not)
  5. Write notification record (status: 'PENDING'), idempotencyKey = `${bookingId}:${eventType}:${channel}:${recipientType}`
  6. Enqueue BullMQ job on notificationQueue, referencing notification.id
  7. Update notification status → 'QUEUED'
```

**Non-negotiable ordering: write the DB row before enqueueing the job.** If the process crashes between steps 5 and 6, a reconciliation sweep can find `PENDING` rows with no corresponding job and re-enqueue. If you enqueue first and the DB write fails, you've sent something with no record — unrecoverable and undebuggable.

**Deduplication at enqueue:** BullMQ jobs are enqueued with `jobId` set to `${channel}:${notification.id}`. BullMQ silently drops enqueue calls for an existing `jobId` in `waiting` or `active` state. This prevents duplicate delivery when the dispatch job itself retries after a partial fan-out.

```typescript
// apps/api/modules/notifications/notifications.service.ts
async function dispatch(eventType: NotificationEventType, context: NotificationContext) {
  const trigger = NOTIFICATION_TRIGGERS[eventType];
  if (!trigger) {
    logger.warn({ event: 'dispatch.unknown_type', eventType });
    return;
  }

  for (const recipientConfig of trigger.recipients) {
    // 1. Evaluate condition
    if (recipientConfig.condition && !evaluateCondition(recipientConfig.condition, context)) {
      continue;
    }

    // 2. Resolve endpoint
    const endpoint = await resolveEndpoint(recipientConfig.type, recipientConfig.channel, context);
    if (!endpoint) {
      logger.warn({ event: 'dispatch.no_endpoint', ... });
      continue;
    }

    // 3. Generate idempotency key
    const idempotencyKey = `${context.bookingId}:${eventType}:${recipientConfig.channel}:${recipientConfig.type}`;

    // 4. Render template
    const payload = renderTemplateForChannel(recipientConfig.template, context);

    // 5. Write DB row (upsert — idempotent)
    const notification = await db.notification.upsert({
      where: { idempotencyKey },
      create: {
        bookingId: context.bookingId,
        recipientId,
        recipientType: recipientConfig.type,
        type: eventType,
        channel: recipientConfig.channel,
        payload,
        idempotencyKey,
        status: 'PENDING',
        correlationId: context.bookingId,
      },
      update: {}, // no-op: if it already exists, don't reset status
    });

    // 6. Enqueue the job with deterministic jobId for dedup
    await notificationQueue.add(`send-${recipientConfig.channel.toLowerCase()}`, {
      notificationId: notification.id,
      recipientId,
      recipientType: recipientConfig.type,
      channel: recipientConfig.channel,
      template: recipientConfig.template,
      payload,
      endpoint,
      eventType,
      bookingId: context.bookingId,
    }, {
      jobId: `${recipientConfig.channel.toLowerCase()}:${notification.id}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: false,
    });

    // 7. Update status → QUEUED
    await db.notification.update({
      where: { id: notification.id },
      data: { status: 'QUEUED' },
    });
  }
}
```

Note the `upsert` with a no-op `update`: this makes `dispatch()` itself safe to call twice for the same event (e.g. a retried API request) without creating a duplicate row or resetting an already-sent notification back to pending.

---

## 6. WhatsApp Delivery (client-facing)

Outbound half of the same FSM that handles inbound conversation — architecturally simpler, distinct gotchas.

- **Session vs template messages.** Within a 24h customer-initiated session, free-form messages are allowed. Outside it, only pre-approved templates work. Booking confirmations sent right after a client messages you can be free-form; a `reminder_24h` sent a day later must use an approved template.
- **Submit templates ahead of time.** Approval has lead time — budget for it in your rollout schedule, not as a same-day dependency.
- **Rate limits & messaging tiers.** WhatsApp Business accounts have tiered 24h messaging limits (250/1K/10K/unlimited unique users) scaling with quality rating. Configure a Redis-backed sliding window rate limiter to match your current tier — don't hardcode an optimistic number.

```typescript
// apps/workers/notification/src/lib/rateLimiter.ts
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX = 80; // stay under the 80/sec default tier limit

export async function checkWhatsAppRateLimit(jobId: string): Promise<void> {
  const now = Date.now();
  const key = "ratelimit:whatsapp:messages";

  await redis.zadd(key, now, `${jobId}:${now}`);
  await redis.zremrangebyscore(key, 0, now - RATE_LIMIT_WINDOW_MS);
  const count = await redis.zcard(key);
  await redis.expire(key, 5);

  if (count > RATE_LIMIT_MAX) {
    const waitMs = RATE_LIMIT_WINDOW_MS - (now % RATE_LIMIT_WINDOW_MS);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}
```

- **Delivery status webhooks.** `sent → delivered → read → failed` callbacks land on a webhook endpoint that updates `notifications.status`. Verify the HMAC signature on every webhook call — same pattern as the M-Pesa callback validation already in this codebase. Never trust an unsigned webhook body.

```typescript
// apps/workers/notification/src/processors/whatsapp.processor.ts
async function sendWhatsAppNotification(job: Job<NotificationJobData>) {
  const { notificationId, endpoint, template } = job.data;
  const templateConfig = TEMPLATES[template];

  // Apply rate limiting before sending
  await checkWhatsAppRateLimit(job.id!);

  if (templateConfig.requiresApproval) {
    const sessionActive = await isWithinCustomerSession(endpoint.address);
    if (!sessionActive) {
      // must use the approved template path; free-form will be rejected by Meta
    }
  }

  const response = await whatsappClient.sendTemplate({
    to: endpoint.address,
    template: templateConfig.waTemplateName,
    params: await loadRenderedPayload(notificationId),
  });

  await db.notification.update({
    where: { id: notificationId },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      providerMessageId: response.messages[0].id, // needed to correlate the later webhook
    },
  });
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
      .then((newSub) => fetch('/api/v1/push-subscriptions/refresh', {
        method: 'POST',
        body: JSON.stringify(newSub),
      }))
  );
});
```

```typescript
// apps/workers/notification/src/processors/push-sender.ts
async function sendPushNotification(job: Job<NotificationJobData>) {
  const { notificationId, endpoint } = job.data;
  
  // Look up all active subscriptions for this admin user
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: endpoint.address, isActive: true },
  });

  if (subscriptions.length === 0) {
    await db.notification.update({
      where: { id: notificationId },
      data: { status: 'SKIPPED', lastError: 'No active push subscriptions' },
    });
    return;
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(await loadRenderedPayload(notificationId)),
        { TTL: 3600 } // 1-hour TTL: if browser offline, hold it for an hour
      ).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.pushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false },
          });
        }
        throw err; // let BullMQ retry handle transient failures
      })
    )
  );

  const allFailed = results.every((r) => r.status === 'rejected');
  await db.notification.update({
    where: { id: notificationId },
    data: {
      status: allFailed ? 'FAILED' : 'SENT',
      sentAt: new Date(),
    },
  });

  if (allFailed) throw new Error('All push subscriptions failed delivery');
}
```

**Why `TTL: 3600` on the push:** Without a TTL, the push service holds the notification indefinitely. The admin's browser might reconnect 12 hours later and get a stale "new booking" notification for a slot long since handled. One hour is long enough for the admin to come back online; after that, the notification is stale and should be discarded.

**Quiet hours check at dispatch time:** Before enqueuing a push notification for an admin, the dispatcher checks `NotificationPreference.quietHours`. If quiet hours are active, the push is skipped and logged — the admin will see the information when they open the PWA dashboard.

- **VAPID keys**: generate once, store in secrets manager / `.env`, never rotate without re-registering all clients.
- **Fallback fallback:** The admin PWA dashboard itself serves as the fallback for missed push notifications — all push-eligible events are visible in the notification audit panel. Email fallback is reserved for critical events only.

---

## 8. Email Delivery (fallback/receipts)

```typescript
// apps/workers/notification/src/processors/email.processor.ts
async function sendEmailNotification(job: Job<NotificationJobData>) {
  const { notificationId, endpoint, template } = job.data;
  const payload = await loadRenderedPayload(notificationId);

  await emailClient.send({
    to: endpoint.address,
    subject: TEMPLATES[template].subject,
    html: renderEmailTemplate(template, payload),
  });

  await db.notification.update({
    where: { id: notificationId },
    data: { status: 'SENT', sentAt: new Date() },
  });
}
```

- Email has no session-window restriction like WhatsApp — always free-form, but still goes through the same template registry for consistency and auditability.
- Used for: receipts (always, if email on file), and as a **fallback** when a WhatsApp send for a critical event (`BOOKING_CONFIRMED`, `PAYMENT_RECEIVED`) ends up in `dead_letter`.

**Future expansion plan** (when email becomes more central):
1. Add email routing rules to the dispatch config — which events fall back to email, and under what conditions (e.g. "WhatsApp delivery failed after 3 retries").
2. Add email address collection to the WhatsApp conversation flow.
3. Implement bounce/complaint webhook handling with HMAC verification.

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

| Channel | Max Attempts | Backoff | DLQ behaviour |
|---|---|---|---|
| `notificationQueue` (per job) | 5 | Exponential (5s base) | Mark status `dead_letter`; alert if > 5 DLQ entries in 10 min |

**Dead-letter handling** — after final retry failure, BullMQ's failed set is the DLQ. A worker event listener marks the notification row:

```typescript
notificationQueue.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts!) {
    await db.notification.update({
      where: { id: job.data.notificationId },
      data: { status: 'DEAD_LETTER', lastError: err.message },
    });

    // critical-event fallback: if this was a WhatsApp send for a critical event, try email
    if (job.data.channel === 'WHATSAPP' && CRITICAL_EVENTS.includes(job.data.eventType)) {
      await tryEmailFallback(job.data);
    }
  }
});
```

**Retry budget rationale:** WhatsApp gets 5 attempts because Cloud API transient failures (upstream Meta outages) are the most damaging to miss — a client who never receives their booking confirmation may not show up. Dead-letter rows are surfaced on the admin dashboard: "3 reminders failed to send — retry?"

**Reconciliation job** — cron-driven sweep (every 5 min), checks for:
- `PENDING` notifications older than 5 min with no associated job (crash recovery between DB write and enqueue)
- `SENT` WhatsApp messages with no delivery webhook after 10 min (possible API/webhook issue — flag, don't auto-retry blindly)
- Scheduled reminders that should have fired but didn't (clock drift, worker downtime) — compare `scheduledAt` against `now()` for rows still `SCHEDULED`

**Idempotency at delivery, not just enqueue.** The `idempotencyKey` on the `notifications` row prevents duplicate *rows*, but a retried BullMQ job can still hit "first attempt actually succeeded, ack was lost" — pass a client-generated reference to the WhatsApp/email API where the provider supports dedup, so your own backoff retries can't double-send.

**Observability** — structured logs per notification: `notification_id`, `correlation_id` (= `booking_id`), `channel`, `event_type`, `status_transition`. Metrics: `notifications_sent_total{channel,type,status}`, `notifications_failed_total{channel,type,reason}`, `notification_delivery_latency_seconds{channel}`.

---

## 10. Scheduling Reminders

Time-deferred, not event-driven — the trickiest category.

No separate `reminderQueue` or `reminders` table exists. Scheduled/reminder notifications go through the same `notificationQueue` and `notifications` table as all other notifications, using BullMQ's `delay` option for deferred execution.

### Scheduling flow

```typescript
// When booking is confirmed — schedule 24h and 1h reminders
async function scheduleAppointmentReminders(bookingId: string, appointmentAt: Date) {
  const now = new Date();

  const twentyFourHoursBefore = new Date(appointmentAt.getTime() - 24 * 60 * 60 * 1000);
  const oneHourBefore = new Date(appointmentAt.getTime() - 60 * 60 * 1000);

  // Uses the same dispatch path as all other notifications
  if (twentyFourHoursBefore > now) {
    await NotificationService.schedule({
      bookingId,
      eventType: 'APPOINTMENT_REMINDER',
      recipientType: 'CLIENT',
      channel: 'WHATSAPP',
      scheduledAt: twentyFourHoursBefore,
      template: 'reminder_24h',
      context: { /* clientName, serviceName, dateTime */ },
    });
  }

  if (oneHourBefore > now) {
    await NotificationService.schedule({
      bookingId,
      eventType: 'APPOINTMENT_REMINDER',
      recipientType: 'CLIENT',
      channel: 'WHATSAPP',
      scheduledAt: oneHourBefore,
      template: 'reminder_1h',
      context: { /* clientName, serviceName, dateTime */ },
    });
  }
}
```

### The `schedule()` helper

Writes a `Notification` row with `status: SCHEDULED`, then enqueues a delayed job on `notificationQueue`:

```typescript
// Inside NotificationService
async function schedule(params: ScheduleParams) {
  const idempotencyKey = `${params.bookingId}:${params.eventType}:${params.channel}:${params.recipientType}`;
  const delayMs = params.scheduledAt.getTime() - Date.now();

  if (delayMs <= 0) {
    // Already past the scheduled time — dispatch immediately instead
    return dispatch(params.eventType, params.context);
  }

  // Write the Notification row first
  const notification = await db.notification.upsert({
    where: { idempotencyKey },
    create: {
      bookingId: params.bookingId,
      recipientId: params.context.recipientId,
      recipientType: params.recipientType,
      type: params.eventType,
      channel: params.channel,
      payload: renderTemplateForChannel(params.template, params.context),
      idempotencyKey,
      status: 'SCHEDULED',
      scheduledAt: params.scheduledAt,
      correlationId: params.bookingId,
    },
    update: {}, // no-op: if it already exists, don't reset status
  });

  if (notification.status !== 'SCHEDULED') {
    // Already sent or in progress — skip
    return;
  }

  // Enqueue with delay; jobId is deterministic for auto-replacement on reschedule
  await notificationQueue.add(`send-${params.channel.toLowerCase()}`, {
    notificationId: notification.id,
    // ... standard send job data
  }, {
    delay: Math.max(delayMs, 1000),  // minimum 1s delay
    jobId: `scheduled:${notification.id}`, // unique per notification row
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: false,
  });
}
```

### Auto-replacement on reschedule

The `idempotencyKey` on the upsert prevents duplicate `Notification` rows when rescheduling. The old `SCHEDULED` row is left untouched (the upsert finds it and is a no-op). The new delayed job gets a different `jobId` (derived from the notification `id`), and the **old job can be cleaned up by looking up the existing notification row's id**:

```typescript
async function onBookingRescheduled(bookingId: string, newAppointmentAt: Date) {
  // Find any existing SCHEDULED reminders for this booking
  const existingReminders = await db.notification.findMany({
    where: {
      bookingId,
      type: 'APPOINTMENT_REMINDER',
      status: 'SCHEDULED',
    },
  });

  // Remove old delayed jobs from the queue
  for (const reminder of existingReminders) {
    await notificationQueue.remove(`scheduled:${reminder.id}`);
  }

  // Mark old rows as cancelled
  await db.notification.updateMany({
    where: { id: { in: existingReminders.map(r => r.id) } },
    data: { status: 'CANCELLED' },
  });

  // Schedule new reminders at the updated time
  await scheduleAppointmentReminders(bookingId, newAppointmentAt);
}
```

### Mandatory rule: cancel scheduled jobs on cancellation

```typescript
async function onBookingCancelled(bookingId: string) {
  const scheduledReminders = await db.notification.findMany({
    where: {
      bookingId,
      type: 'APPOINTMENT_REMINDER',
      status: 'SCHEDULED',
    },
  });

  for (const reminder of scheduledReminders) {
    await notificationQueue.remove(`scheduled:${reminder.id}`);
  }

  await db.notification.updateMany({
    where: { id: { in: scheduledReminders.map(r => r.id) } },
    data: { status: 'CANCELLED' },
  });
}
```

Forgetting this is the classic bug: client cancels, reminder fires anyway, client is confused or annoyed. Any agent touching the cancellation/reschedule path must check this file for job-id cleanup as part of the change — not just the booking status update.

---
## 11. Preference Management

Clients have no notification preferences — WhatsApp is the only channel and is always on (they can block the business number in WhatsApp, but that's handled at delivery time, not here).

Admins have preferences managed via the PWA settings screen:

### `NotificationPreference` Model

```prisma
model NotificationPreference {
  id              String   @id @default(uuid())
  adminUserId     String   @unique @map("admin_user_id")
  webPush         Boolean  @default(true)
  email           Boolean  @default(true)
  quietHoursStart Int?     @map("quiet_hours_start") // 0-23, Africa/Nairobi hour
  quietHoursEnd   Int?     @map("quiet_hours_end")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("notification_preferences")
}
```

### Admin API Endpoints

```typescript
// GET /api/v1/notification-preferences
router.get("/notification-preferences", requireAdminAuth, async (req, res) => {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { adminUserId: req.admin.id },
  });
  res.json(prefs ?? { webPush: true, email: true, quietHoursStart: null, quietHoursEnd: null });
});

// PATCH /api/v1/notification-preferences
router.patch("/notification-preferences", requireAdminAuth, async (req, res) => {
  const { webPush, email, quietHoursStart, quietHoursEnd } = req.body;
  const prefs = await prisma.notificationPreference.upsert({
    where: { adminUserId: req.admin.id },
    update: { webPush, email, quietHoursStart, quietHoursEnd },
    create: { adminUserId: req.admin.id, webPush, email, quietHoursStart, quietHoursEnd },
  });
  res.json(prefs);
});
```

### Quiet Hours Evaluation

```typescript
export function isQuietHours(prefs: NotificationPreference | null): boolean {
  if (!prefs?.quietHoursStart || !prefs?.quietHoursEnd) return false;

  // Always evaluate in Africa/Nairobi timezone
  const now = new Date();
  const nairobiHour = parseInt(
    now.toLocaleString("en-KE", { timeZone: "Africa/Nairobi", hour: "numeric", hour12: false }),
    10
  );

  if (prefs.quietHoursStart < prefs.quietHoursEnd) {
    return nairobiHour >= prefs.quietHoursStart && nairobiHour < prefs.quietHoursEnd;
  } else {
    // Overnight range (wraps midnight)
    return nairobiHour >= prefs.quietHoursStart || nairobiHour < prefs.quietHoursEnd;
  }
}
```

Quiet hours are checked at dispatch time for push notifications. If quiet hours are active, the notification is logged as `SKIPPED` with reason "quiet hours." The admin will see the information when they next open the PWA dashboard.

---

## 12. Security

- **Webhook signature verification is mandatory** on every inbound webhook (WhatsApp delivery status, any email provider bounce/complaint webhook). Reuse the HMAC verification pattern from the M-Pesa Daraja integration — never process a webhook body before verifying its signature.
- **Secrets**: WhatsApp access token, VAPID private key, email provider API key all live in environment-specific secrets (not committed, not logged). Never log full payloads containing phone numbers or tokens — redact in structured logs.
- **PII minimization**: `notifications.payload` stores rendered template variables for debugging — avoid storing raw payment details or full card/M-Pesa transaction metadata here; reference the source record (`bookingId`, a payment id) instead and join when needed.
- **Rate limit inbound webhook endpoints** separately from outbound sending rate limits — a webhook flood (legitimate or malicious) shouldn't be able to overwhelm the API process.

---

## 13. Testing Strategy

- **Unit**: template rendering (missing vars throw), trigger config resolution (correct recipients for each event, `condition` evaluation), idempotency key generation, quiet hours evaluation.
- **Integration**: `NotificationService.dispatch()` against a test DB — verify row written before job enqueued; verify `upsert` behavior doesn't reset status on duplicate dispatch calls.
- **Worker tests**: each sender (`whatsapp-sender`, `push-sender`, `email-sender`) mocked against the provider SDK — verify status transitions on success, verify `410`/`404` marks subscription inactive, verify thrown errors trigger BullMQ retry (not swallowed).
- **Webhook tests**: signature verification rejects tampered/unsigned payloads; valid payloads correctly update `notifications.status` via `providerMessageId` correlation.
- **Reconciliation job tests**: seed `PENDING` rows with old timestamps, verify sweep re-enqueues; seed `SENT` rows past the delivery-webhook timeout, verify they're flagged not silently retried.
- **Manual/staging-only**: actual WhatsApp template send against Meta's test number before any new approved template goes to production — confirms the approved template name and variable count match exactly.

---

## 14. Rules for Agents Working in This Domain

1. **Never hardcode a message string.** Register it in the template registry (§4) first.
2. **Never add a trigger row without registering its template(s).** Both halves ship together.
3. **Never call a provider SDK (WhatsApp/webpush/email) directly from `apps/api`.** All sends go through `notificationQueue` → worker → sender. The API only dispatches and writes rows.
4. **Never skip the DB-row-before-enqueue ordering** in §5. If you're refactoring `dispatch()`, preserve this.
5. **Never touch booking cancellation/reschedule logic without checking for orphaned reminder jobs** (§10).
6. **Never process a webhook before verifying its signature** (§12).
7. **If adding a new WhatsApp template that requires approval**, flag it explicitly as a deploy blocker — don't assume same-day availability.
8. **If a channel send can fail in a way that matters to the business** (booking confirmation, payment receipt), make sure there's a fallback or DLQ visibility path — don't let it fail silently into `dead_letter` with nothing surfaced.
9. **When in doubt about whether something is a new event type or a variant of an existing one**, check the trigger table (§3) first — extend it before inventing a new `NotificationEventType`.
10. **Always use deterministic `jobId` on BullMQ jobs** to prevent duplicate enqueue on retry. The pattern is `${channel}:${notification.id}` for send jobs, `scheduled:${notification.id}` for delayed/scheduled jobs.

---

## 15. Observability

### Metrics to Alert On

| Metric | Alert condition | Severity |
|---|---|---|
| `notificationQueue` DLQ depth | > 0 | Critical — means a notification type was never sent |
| WhatsApp DLQ (failed after 5 attempts) | > 5 in 10 min | High — clients missing notifications |
| Push DLQ | > 10 in 10 min | Medium — admin has dashboard fallback |
| `Notification` with status `FAILED` rate | > 10% of last-hour volume | High |
| Push subscriptions deactivated (`isActive` flipped false) | > 3 in 1 hour | Medium — may indicate VAPID key issue |

### Admin PWA: Notification Audit Panel

The admin PWA should expose a paginated log of `Notification` entries filterable by channel, status, and date range. Columns: event type, channel, recipient, status, sent time, delivery time, failure reason. This is how you diagnose "customer says they never got a confirmation" without reading server logs.

```typescript
// apps/api/modules/notifications/notifications.controller.ts
router.get("/", requireAdminAuth, async (req, res) => {
  const { channel, status, bookingId, page = "1", pageSize = "50" } = req.query;

  const where: any = {};
  if (channel) where.channel = channel;
  if (status) where.status = status;
  if (bookingId) where.bookingId = bookingId;

  const [notifications, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    }),
    prisma.notification.count({ where }),
  ]);

  res.json({ notifications, total, page: Number(page), pageSize: Number(pageSize) });
});
```

---

## 16. Failure Modes

| Failure | Impact | Recovery |
|---|---|---|
| WhatsApp Cloud API outage | Client notifications queue up; retry budget exhausted after ~10min | BullMQ DLQ preserves jobs; ops can manually re-enqueue after API recovers |
| Admin closes browser without granting push permission | No Web Push delivered | Admin sees notifications in PWA dashboard on next login; in future, email fallback covers this |
| Push subscription expires (browser cleared data) | 410/404 from push service; subscription deactivated | Admin re-subscribes on next PWA visit; automatic re-prompt on login |
| Reminder job lost (Redis flush) | Reminder never sends | **This is the most dangerous silent failure.** Mitigate: nightly reconciliation job that checks `Booking` records with `appointmentAt` in the next 36 hours and re-enqueues missing reminder jobs if `Notification` has no matching `APPOINTMENT_REMINDER` entry |
| Dispatcher job retried after partial fan-out (e.g. WhatsApp enqueued, crash before admin push enqueue) | Admin doesn't get Web Push; client gets WhatsApp twice | `jobId: ${channel}:${notification.id}` dedup on send jobs makes the re-delivered WhatsApp a no-op; admin push gets sent on dispatcher retry |
| Meta template rejection (template not approved or content mismatch) | WhatsApp returns 131009 error; delivery fails | Alert immediately — this blocks all business-initiated messages until template is re-approved. Do not retry; fix the template |
| Dispatch called twice for same event | Safe — upsert with no-op `update: {}` prevents duplicate rows and doesn't reset status | No action needed; idempotency handles it |

---

## 17. Environment Variables

```bash
# VAPID (Web Push) — generate once with npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=           # also exposed to PWA as VITE_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=
VAPID_CONTACT_EMAIL=admin@wannysnails.co.ke

# WhatsApp Cloud API (already used by worker-conversation)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v19.0

# Operational tuning
WEB_PUSH_TTL_SECONDS=3600           # hold duration at push service for offline browsers
WHATSAPP_RATE_LIMIT_PER_SECOND=80   # stay under tier limit; default Meta tier = 80/s
NOTIFICATION_QUIET_HOURS_DEFAULT_START=22
NOTIFICATION_QUIET_HOURS_DEFAULT_END=7

# Worker concurrency (tune per server memory)
NOTIFICATION_WORKER_CONCURRENCY=10
```

---

## 18. WhatsApp Template Approval Checklist

Before go-live, the following templates must be submitted to Meta and approved. Template names must match exactly what is used in the template registry.

| Template Name | Category | Variables |
|---|---|---|
| `booking_confirmation_v2` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` date, `{{4}}` time, `{{5}}` salon address |
| `booking_pending_confirmation_v1` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` date |
| `booking_rejected_v1` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` salon address |
| `booking_cancellation_v1` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` date |
| `booking_rescheduled_v1` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` old date, `{{4}}` new date |
| `appointment_completed_v1` | UTILITY | `{{1}}` client name, `{{2}}` service |
| `missed_appointment_v1` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` date |
| `appointment_reminder_v1` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` date, `{{4}}` time |
| `appointment_reminder_1h_v1` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` time |
| `payment_request_v1` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` amount, `{{4}}` payment link |
| `payment_receipt_v1` | UTILITY | `{{1}}` client name, `{{2}}` amount, `{{3}}` receipt number, `{{4}}` service |
| `payment_failed_v1` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` amount |
| `payment_expired_v1` | UTILITY | `{{1}}` client name, `{{2}}` service |
| `payment_retry_prompt_v1` | UTILITY | `{{1}}` client name, `{{2}}` service, `{{3}}` amount + Retry button |
| `refund_confirmation_v1` | UTILITY | `{{1}}` client name, `{{2}}` amount, `{{3}}` refund reference |
| `thank_you_v1` | UTILITY | `{{1}}` client name |
| `feedback_request_v1` | UTILITY | `{{1}}` client name, `{{2}}` feedback link |
| `review_request_v1` | UTILITY | `{{1}}` client name, `{{2}}` review link |

Use the **UTILITY** category for all transactional templates (booking/payment-related). MARKETING category templates have lower delivery rates and are subject to user-level frequency caps that will suppress reminders if the client has received too many marketing messages from other businesses that day.

---

## 19. Rollout Order

1. Migrate `notifications`, `notification_subscriptions`, `push_subscriptions`, `notification_preferences` tables.
2. Build `NotificationService.dispatch()` core + trigger config + template registry skeleton.
3. Wire `BOOKING_CONFIRMED` → WhatsApp confirmation (reuses existing WhatsApp client from FSM work).
4. Add admin push: VAPID setup, service worker, subscription endpoint, `new_booking_alert`.
5. Reminder scheduling + cancellation-aware job removal.
6. WhatsApp delivery-status webhook handler (with signature verification).
7. Email sender + critical-event fallback path.
8. Admin notification preferences endpoint + PWA settings UI.
9. Reconciliation cron + DLQ dashboard surfacing.
10. Rate limiting tuned to current WhatsApp messaging tier.
11. Observability: structured logs + metrics wired into existing stack.