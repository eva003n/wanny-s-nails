# Domain Rules — Bookings & Payments

## Bookings

### Slot availability
```
available slots = business hours − blocked slots − non-cancelled bookings
```
- Slot boundaries: 30-minute intervals (configurable in settings).
- All slot generation uses EAT (`Africa/Nairobi`). Convert to UTC before storing.
- Re-validate availability server-side at the moment of booking creation — never trust client-sent slot data alone.

### Double-booking prevention (two layers)
1. Application: raw SQL overlap check before INSERT.
2. Database: partial unique index on `appointment_at` where status not in `('CANCELLED', 'NO_SHOW')`.

Both must remain in place. Removing either layer creates a race condition.

### Booking state changes
- Every transition writes a row to `booking_status_history` and `audit_logs` in the same transaction.
- Cancelling or rescheduling must cancel all `SCHEDULED` reminder jobs (fetch BullMQ job IDs from `reminders` table, call `reminderQueue.remove(jobId)`).
- Rescheduling schedules new reminder jobs after cancelling the old ones.

## Payments

### STK Push
- Initiate async via BullMQ — never inline.
- After Daraja responds, update `payments.checkoutRequestId`.
- Max 2 retries with 30s backoff before marking `PAYMENT_FAILED`.

### Callback processing
- Idempotency check on `mpesaReceiptNumber` before any DB write.
- Verify `callbackAmount === booking.priceKes`. Amount mismatch → mark `DISPUTED`, alert owner, do not confirm booking.
- All processing inside a single Prisma transaction: `PaymentTransaction` INSERT + `Payment` UPDATE + `Booking` UPDATE.

### payment_transactions
Append-only. Never UPDATE a row. Each STK Push attempt creates a new row with an incremented `attemptNumber`.

### Manual payment (cash)
Owner can mark a booking as paid via `POST /bookings/:id/mark-paid` with `{ method: "CASH" }`. Creates a `Payment` record with `mpesaReceiptNumber: null`.
