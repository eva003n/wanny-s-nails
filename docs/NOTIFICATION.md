# Notifications system - Wannys nails

## Channels
- Whatsapp
- Email
- Push notification

## Database design
Tables: notifications, notification_subscriptions
```

```

## Event Sources → Notification Triggers

| Event | Client (WhatsApp) | Admin (PWA Push) |
| :----- | :---------------- | :--------------- |
| `BOOKING_CREATED` | — | **New booking received** |
| `BOOKING_PENDING_CONFIRMATION` | **Booking pending confirmation** | **Booking awaiting confirmation** |
| `BOOKING_CONFIRMED` | **Booking confirmation** | **Booking confirmed** |
| `BOOKING_REJECTED` | **Booking rejected** | **Booking rejected** |
| `BOOKING_CANCELLED` | **Booking cancellation** | **Booking cancelled** |
| `BOOKING_RESCHEDULED` | **Booking rescheduled** | **Booking rescheduled** |
| `BOOKING_COMPLETED` | **Appointment completed** | **Appointment completed** |
| `BOOKING_NO_SHOW` | **Missed appointment** | **Customer marked as no-show** |
| `APPOINTMENT_REMINDER` | **Appointment reminder** | — |
| `PAYMENT_REQUEST` | **Payment request** | — |
| `PAYMENT_RECEIVED` | **Payment received confirmation** | **Customer payment received** |
| `PAYMENT_REFUNDED` | **Refund confirmation** | **Refund processed** |
| `PAYMENT_FAILED` | **Payment failed** | **Customer payment failed** |
| `PAYMENT_EXPIRED` | **Payment request expired** | **Payment request expired** |
| `THANK_YOU` | **Thank you message** | — |
| `FEEDBACK_REQUEST` | **Feedback request** | — |
| `REVIEW_REQUEST` | **Review request** | — |

Each row becomes a notification trigger — ideally defined declaratively rather than scattered through your codebase:

``` typescript
// apps/api/modules/notifications/notification-triggers.ts
export const NOTIFICATION_TRIGGERS = {
  BOOKING_CREATED: {
    recipients: [
      { type: 'client', channel: 'whatsapp', template: 'booking_confirmation' },
      { type: 'admin', channel: 'push', template: 'new_booking_alert' },
    ],
  },
  APPOINTMENT_REMINDER: {
    recipients: [
      { type: 'client', channel: 'whatsapp', template: 'reminder_24h' },
    ],
  },
  // ...
} as const;
```
This keeps the "who gets told what" logic in one auditable place instead of buried in route handlers.

## The orchestration layer
```
apps/api → emits domain event (e.g. via internal event emitter or DB row insert)
        ↓
NotificationService.dispatch(eventType, context)
        ↓
  - Looks up trigger config
  - Resolves recipients (client phone, admin push subs)
  - Renders templates with context data
  - Writes notification record (status: pending)
  - Enqueues BullMQ job per (recipient, channel)
```
Key design choice: write the notification row before enqueueing the job, not after. If the process crashes between DB write and enqueue, you can have a reconciliation job sweep pending notifications older than N minutes and re-enqueue them. If you enqueue first and the DB write fails, you've sent something you can't track.

## WhatsApp delivery (client-facing)
FSM for inbound conversation flow — notifications are the outbound half, which is architecturally simpler but has its own gotchas:

- Session vs template messages: WhatsApp Business API distinguishes between messages sent within a 24h customer-initiated session (free-form allowed) and outside it (must use pre-approved message templates). Booking confirmations sent right after a client messages you can be free-form; a reminder sent 24h later almost certainly needs a pre-approved template with the Meta/WhatsApp Business platform.

- This means your reminder templates need to be submitted and approved in the WhatsApp Business Manager ahead of time — budget for that lead time.

- Rate limits & messaging tiers: WhatsApp Business accounts have tiered messaging limits (250/1K/10K/unlimited unique users per 24h) that scale with quality rating. Your BullMQ worker needs a rate limiter (e.g. bullmq's built-in rate limiting per queue) tuned to your current tier.

- Delivery status webhooks: WhatsApp sends webhook callbacks for sent → delivered → read → failed. Your api needs a webhook endpoint that updates the notifications.status field, with HMAC signature verification (same pattern you used for M-Pesa callbacks).

``` ts
// whatsapp-sender.ts (inside notification-worker)
async function sendWhatsAppNotification(job: Job<NotificationJobData>) {
  const { phone, templateName, templateParams, notificationId } = job.data;
  
  const response = await whatsappClient.sendTemplate({
    to: phone,
    template: templateName,
    params: templateParams,
  });

  await db.notifications.update(notificationId, {
    status: 'sent',
    sent_at: new Date(),
    provider_message_id: response.messages[0].id, // needed to correlate webhook later
  });
}
```

## PWA push delivery (admin-facing)
This is standard Web Push but production-grade means handling its edge cases properly:

Service worker receives the push event and shows the notification:

```
javascript// sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      data: { url: data.url }, // for click-through
      tag: data.notificationId, // collapses duplicate notifications
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

- Subscription lifecycle: push subscriptions expire/rotate. Your admin app needs to detect pushsubscriptionchange and re-register, and your backend needs to prune dead subscriptions when the push service returns 410 Gone.
- VAPID keys for authenticating your server to push services (Chrome's FCM, etc.) — generate once, store in env/secrets, never rotate without re-registering all clients.
- Fallback to in-app: PWA push requires the app to have been opened at least once and permission granted. Always also write to an in_app_notifications table so the admin dashboard shows a notification bell with unread count, independent of whether push actually delivered. Push is a nice-to-have nudge; in-app is the source of truth.
```
typescript
// push-sender.ts (inside notification-worker)
async function sendPushNotification(job: Job<NotificationJobData>) {
  const { subscriptionId, title, body, url, notificationId } = job.data;
  const sub = await db.pushSubscriptions.findById(subscriptionId);

  try {
    await webpush.sendNotification(sub.toPushSubscriptionObject(), JSON.stringify({ title, body, url, notificationId }));
    await db.notifications.update(notificationId, { status: 'sent', sent_at: new Date() });
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await db.pushSubscriptions.markInactive(subscriptionId);
    }
    throw err; // let BullMQ retry policy handle it
  }
}
```

## Reliability layer (this is what makes it "prod-grade")

- Retry strategy — exponential backoff, capped attempts, dead-letter queue:
```
typescript
await notificationQueue.add('send-whatsapp', jobData, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86400 },
  removeOnFail: false, // keep failed jobs for inspection
});
```
- Dead letter handling — after final retry failure, move to a notifications_dlq table or BullMQ's failed set, and surface it on the admin dashboard ("3 reminders failed to send — retry?").

- Reconciliation job — a cron-driven worker that sweeps for:

  - pending notifications older than 5 min with no job (crash recovery)
  - sent WhatsApp messages with no delivery webhook after 10 min (possible API issue)
  - Scheduled reminders that should have fired but didn't (clock drift / worker downtime)

**Idempotency** at delivery, not just enqueue — WhatsApp API calls should be made with a client-generated idempotency reference where supported, so retries from your own backoff don't double-send if the first attempt actually succeeded but your ack was lost.
**Observability** — given you already wrote a frontend rules README covering observability, mirror that here: structured logs per notification with notification_id, correlation_id (tie back to booking_id), and metrics (notifications_sent_total{channel,type,status}) exported for Grafana/whatever you're using.

## Scheduling reminders specifically
Reminders (24h, 1h before) are the trickiest because they're time-deferred, not event-driven:
``` 
typescript// When booking is created/confirmed

await reminderQueue.add(
  'reminder-24h',
  { bookingId, notificationType: 'REMINDER_24H' },
  { delay: msUntil(appointmentTime - 24 * 60 * 60 * 1000) }
);
```

But — if the booking gets rescheduled or cancelled, you must cancel the previously scheduled job. Store the BullMQ job ID against the booking so you can remove it:

```typescript
await db.bookings.update(bookingId, { reminder24hJobId: job.id });
// on cancellation/reschedule:
await reminderQueue.remove(booking.reminder24hJobId);
```

Forgetting this is the classic bug — client cancels, reminder fires anyway, client is confused/annoyed.

## Suggested rollout order

Notification + subscription tables + Prisma migration

NotificationService.dispatch() core in apps/api with trigger config

Wire BOOKING_CREATED → WhatsApp confirmation (you likely have most of the WhatsApp client already from the FSM work)

Add admin push: VAPID setup, service worker, subscription endpoint, new_booking_alert push

Reminder scheduling + cancellation-aware job removal

Webhook handlers for WhatsApp delivery status

Reconciliation cron + DLQ + dashboard surfacing

Rate limiting tuned to your WhatsApp tier