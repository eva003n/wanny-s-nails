# Notification System Implementation

This document captures the actual implementation decisions made while building the notification system according to `docs/NOTIFICATION.md`.

## What Was Built

### 1. Prisma Schema Changes (`apps/packages/prisma/schema.prisma`)
- **Fixed** `idempotency_key` leading space typo
- **Enhanced** `Notification` model: added `sentAt`, `deliveredAt`, `readAt`, `failedAt`, `lastError`, `providerMessageId`, `correlationId`, `status` enum expanded to include `QUEUED``
- **Added** `NotificationStatus` values: `PENDING`, `QUEUED`, `DEAD_LETTER`
- **Added** `Reminder` model (standalone table for scheduled reminders)
- **Added** `InAppNotification` model (dashboard bell)
- **Added** `NotificationSubscription` → `Customer` relation
- **Added** `PushSubscription` → `User` relation
- **Added** `InAppNotification` → `User` relation

### 2. Core Notification Engine (`apps/api/src/modules/notifications/`)

**`notification-triggers.ts`** — Maps every domain event to recipients, channels, templates:
- All 18 event types from the spec table are registered
- `evaluateCondition()` helper handles `hasEmail`/`isOptedIn` predicates
- Uses inline string literals for `NotificationRecipient`/`NotificationChannel` to avoid Prisma client coupling before regeneration

**`templates/registry.ts`** — Template registry:
- All 17 WhatsApp templates (with `waTemplateName`, `requiresApproval: true`, `vars`)
- 12 admin push templates (with `pushTitle`)
- 1 email template (payment receipt)
- `renderTemplate()` validates required vars exist, throws if missing

**`notifications.service.ts`** — `dispatch()` orchestration:
- Enforces non-negotiable ordering: DB row first → enqueue job → update to QUEUED
- `upsert` by `idempotencyKey` with no-op `update: {}` — safe for double-calls
- Resolves endpoints: WhatsApp → phone, Email → address, Push → userId
- Creates `InAppNotification` rows for admin push events
- Logs structured events with `notification_id`, `booking_id`, `channel`, `event_type`, `status_transition`

**`notifications.controller.ts`** — Admin endpoints:
- `GET /` — paginated/filtered notification list
- `GET /dead-letters` — dead-letter queue
- `POST /:id/retry` — retry a dead-letter
- `GET /in-app` — list in-app notifications
- `GET /in-app/unread-count`
- `PATCH /in-app/:id/read`
- `PATCH /in-app/read-all`

**`notifications.routes.ts`** — Route definitions with correct ordering (in-app before `/:id`)

### 3. Push Subscription Module (`apps/api/src/modules/push-subscriptions/`)
- `POST /` — save subscription (upsert by endpoint)
- `POST /refresh` — update on `pushsubscriptionchange`
- `GET /` — list active subscriptions
- `DELETE /:id` — deactivate

### 4. Notification Worker (`apps/workers/notification/src/`)

**`worker.ts`** — Three worker instances on the same queue:
1. `whatsapp` worker — existing FSM + WhatsApp sends
2. `email` worker — existing email sends
3. `notification-dispatch` — processes `send-whatsapp`, `send-email`, `send-push` jobs from `dispatch()`

**`push-sender.ts`** — Web Push with VAPID:
- Dynamic import of `web-push` (doesn't require it at startup)
- Iterates all active `PushSubscription` rows for a user
- Marks subscriptions inactive on GP 410/404
- Updates `Notification` status to `SENT` or `FAILED`

**`processors/whatsapp.processor.ts`** and **`processors/email.processor.ts`** — existing, unchanged (the dispatch worker routes to them)

### 5. Service Worker (`apps/web/public/sw.js`)
- Push notification display with `notificationclick` → deep link
- `pushsubscriptionchange` → auto-refresh via `/api/v1/push-subscriptions/refresh`
- Offline fallback for navigation requests
- VAPID key placeholder (`self.__VAPID_PUBLIC_KEY__`)

### 6. App Wiring (`apps/api/src/app.ts`)
- Push subscription routes registered at `/api/v1/push-subscriptions`

### 7. Booking Controller Integration (`apps/api/src/modules/bookings/bookings.controller.ts`)
- `approveBooking` → dispatches `BOOKING_CONFIRMED`
- `cancelBooking` → cancels reminder jobs + dispatches `BOOKING_CANCELLED`
- `rescheduleBooking` → cancels old reminder jobs
- `markBookingPaid` → dispatches `PAYMENT_RECEIVED`

### 8. Types Export (`apps/packages/src/types.ts`)
- Added `NotificationJobData` interface

## Not Yet Completed (requires Prisma regeneration + module wiring)

These pieces are scaffolded but will have TypeScript errors until `pnpm prisma generate` is run:

1. **WhatsApp delivery status webhook** (`webhooks.controller.ts`):
   - `handleWhatsAppStatus` needs to be added to update `notifications` rows by `providerMessageId`
   - Route needs to be added to `webhooks.routes.ts`
   - HMAC signature verification must be added

2. **Dead-letter fallback for critical events** (`dead-letter.processor.ts`):
   - Check `CRITICAL_EVENTS.includes(eventType)` on failed jobs
   - Enqueue email fallback if `hasEmail`
   - This should be in the notification worker's failed event handler

3. **Reconciliation job** (cron every 5 min):
   - Sweep `pending` notifications older than 5 min with no job
   - Flag `sent` WhatsApp messages without delivery webhook after 10 min

4. **VAPID environment config**:
   - Generate VAPID keys: `npx web-push generate-vapid-keys`
   - Add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` to `apps/api/.env.development`
   - Add to worker notification config if needed

5. **`web-push` dependency**: Add to `apps/workers/notification/package.json`

## Deployment Order (per spec §14)

1. Run `pnpm prisma migrate dev` — generates client, creates new tables
2. Restart API + workers — now types are resolved
3. Deploy approved WhatsApp templates to WhatsApp Business Manager
4. Configure VAPID keys and environment variables
5. Test push subscription flow from PWA
6. Add reconciliation cron job
7. Tune WhatsApp rate limits to current messaging tier

## Key Design Decisions

| Decision | Rationale |
|---|---|
| `notificationQueue.add()` names: `send-{channel}` | Keeps senders decoupled, one queue handles all channels |
| `idempotencyKey` includes bookingId + eventType + channel + type | Prevents duplicate sends across retries |
| `update: {}` no-op on upsert | Dispatch is idempotent — safe to call twice |
| Push uses `adminUserIds[]` from context, first user | Single-salon: one owner; multi-user would broadcast |
| InAppNotification is created during dispatch (not in worker) | Dashboard bell updates immediately without waiting for push deliverability |
| Reminder cancellation happens in controller via `reminderQueue.remove()` | Spec §10 requirement: never let reminders fire after cancel/reschedule |