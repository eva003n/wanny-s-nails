# Product Requirements Document — NailBook

**Version:** 1.0  
**Status:** Reviewing  
**Last Updated:** 2026

---

## Executive Summary

Wanny's Nails is a WhatsApp-first appointment booking and payment platform for a nail salon operating in Kenya. Customers book appointments, pay via M-Pesa, and receive reminders entirely through WhatsApp — no app download required. The salon owner manages operations through a progressive web application.

The platform addresses the salon's core operational pain: manual appointment tracking via phone calls and WhatsApp messages, high rate of clients not seeing remainder emails, clients having to save the Mpesa paybill or remember it off head 

---

## Product Vision

> Enable the nail salon customer to book, and manage their appointment in under 3 minutes — entirely through WhatsApp — while giving the salon owner complete operational visibility from their iPhone or any other device.

---

## Problem Statement

The salon currently operates with:

- Appointments tracked in personal WhatsApp messages
- No automated reminders → high no-show rate (estimated 25–35%), sent manually via email
- Payments collected in-person or manually confirmed via M-Pesa confirmation

- No visibility into revenue trends or repeat customer behavior

The result is revenue loss from no-shows and an inability to grow the business without increasing administrative overhead.

---

## Business Goals

| # | Goal | Metric | Target |
|---|---|---|---|
| G1 | Reduce no-shows | No-show rate | < 15% (from ~30%) |
| G2 | Increase booking completion | Booking funnel completion rate | ≥ 85% |
| G3 | Accelerate payment collection | M-Pesa payment rate at booking | ≥ 90% |
| G4 | Eliminate manual scheduling | % bookings via platform | 100% within 60 days |
| G5 | Improve customer retention | Repeat booking rate | ≥ 60% within 90 days |

---

## Stakeholders

| Stakeholder | Role | Primary Interface |
|---|---|---|
| Salon Owner | Business operator, approves bookings, views reports | PWA |
| Salon Staff | Views daily schedule, manages customer requests | PWA |
| Customer | Books, pays, receives reminders | WhatsApp |
| System Administrator | Manages infrastructure and integrations | Backend / Admin CLI |

---

## User Personas

### Persona 1: Grace — Salon Owner

**Demographics:** 34 years old, Nairobi, runs a 3-chair nail salon in Westlands.

**Goals:**
- Know her full schedule at a glance each morning
- Ensure every booking is approved before the customer arrives
- Reduce time spent on phone calls confirming bookings
- Track which services are most popular and most profitable

**Pain Points:**
- Customers book then don't show up — wasted slots, lost revenue
- Constantly checking personal WhatsApp for booking messages
- Can't tell which month was most profitable without digging through M-Pesa history
- Staff ask her "who's coming today?" multiple times a day

**Behaviours:**
- Uses iPhone 17 Pro
- Checks M-Pesa Safaricom app multiple times a day
- Very comfortable with WhatsApp Business

**Success Criteria:** She can open the PWA each morning and see exactly who is coming, what services they booked, and what revenue is confirmed for the day — without speaking to anyone.

---

### Persona 2: Aisha — Salon Staff

**Demographics:** 22 years old, junior nail technician, 1 year at the salon.

**Goals:**
- Know her assigned appointments for the day without asking the owner
- See customer notes before they arrive (e.g., preferred nail style)
- Handle rescheduling requests without escalating to the owner

**Pain Points:**
- Often doesn't know the day's schedule until she arrives
- Has no way to check if a customer has paid
- Gets confused when two customers claim the same slot

**Behaviours:**
- Uses Android phone personally, can access PWA
- Very comfortable with WhatsApp

**Success Criteria:** She can open the app, see her day, confirm payment status, and handle a reschedule request independently.

---

### Persona 3: Wanjiku — Customer

**Demographics:** 28 years old, marketing executive, Kilimani. Books a nail appointment every 2–3 weeks.

**Goals:**
- Book an appointment quickly without a phone call
- Know her slot is confirmed and nobody else will be given it
- Pay conveniently via M-Pesa without visiting the salon first
- Get a reminder so she doesn't forget

**Pain Points:**
- Hates calling to book — she's often in meetings
- Uncertain whether a WhatsApp message to the salon was actually "received and booked"
- Has shown up before to find her slot was given to someone else

**Behaviours:**
- Very active on WhatsApp — sends and receives 100+ messages/day
- Pays for almost everything via M-Pesa
- Does not want to download another app

**Success Criteria:** She initiates a booking conversation on WhatsApp, selects her service and time, pays via M-Pesa STK Push, and receives a confirmation message — all within 3 minutes.

---

## User Stories

### Booking — Customer

---

**US-001: Book an appointment via WhatsApp**

> As a customer, I want to book a nail appointment through WhatsApp, so that I do not need to call the salon.

**Acceptance Criteria:**
- Customer sends any message to the salon's WhatsApp number to initiate
- Bot greets the customer and presents a numbered service menu
- Customer selects a service by number or name
- Bot presents available dates (next 7 days with open slots)
- Customer selects a date
- Bot presents available time slots for that date
- Customer selects a time
- Bot presents a confirmation summary (service, date, time, price)
- Customer confirms
- System creates a PENDING booking
- Customer receives a confirmation message with booking reference
- Booking appears in the PWA under "Pending Approvals"

---

**US-002: Pay via M-Pesa at booking**

> As a customer, I want to pay for my booking via M-Pesa immediately after confirming, so that my slot is secured.

**Acceptance Criteria:**
- After booking confirmation, bot asks for the customer's M-Pesa phone number
- System initiates an STK Push to that number
- Customer receives and approves the M-Pesa prompt on their phone
- System receives Daraja callback confirming payment
- Booking status updates to PAYMENT_COMPLETED
- Customer receives a WhatsApp message confirming payment and appointment
- Payment recorded against the booking with M-Pesa transaction ID

---

**US-003: Reschedule via WhatsApp**

> As a customer, I want to reschedule my appointment through WhatsApp, so that I can change my time without calling.

**Acceptance Criteria:**
- Customer sends a message containing "reschedule" or "change appointment"
- Bot identifies their active booking by phone number
- Bot presents available dates
- Customer selects new date and time
- Bot confirms the new slot and asks for confirmation
- Booking updated to RESCHEDULED with new date/time
- Original slot made available again
- Customer and staff notified of the change

---

**US-004: Cancel via WhatsApp**

> As a customer, I want to cancel my appointment through WhatsApp, so that I do not have to call.

**Acceptance Criteria:**
- Customer sends "cancel" or similar
- Bot identifies the active booking
- Bot asks for confirmation ("Are you sure you want to cancel?")
- Customer confirms
- Booking status updated to CANCELLED
- Slot made available again
- Customer receives cancellation confirmation
- Staff notified

---

**US-005: Look up upcoming appointment**

> As a customer, I want to ask about my upcoming appointment through WhatsApp, so that I can confirm the details.

**Acceptance Criteria:**
- Customer sends "my appointment" or "when is my booking"
- System looks up bookings by customer phone number
- Bot replies with the next confirmed appointment details (service, date, time)
- If no upcoming booking, bot offers to create a new one

---

### Booking — Salon Owner

---

**US-006: Approve a pending booking**

> As a salon owner, I want to approve a pending booking from the PWA app, so that my schedule remains under my control.

**Acceptance Criteria:**
- Pending bookings shown with a badge count on the app icon and dashboard
- Tapping a booking shows full details (customer, service, time, payment status)
- "Approve" button visible; one tap approves
- Booking status changes to APPROVED
- Customer notified via WhatsApp ("Your appointment has been confirmed")
- Booking moves from Pending to Upcoming in the app

---

**US-007: Reschedule a booking from the app**

> As a salon owner, I want to reschedule a booking from the PWA app, so that I can manage slot conflicts.

**Acceptance Criteria:**
- Owner opens a booking, taps "Reschedule"
- Date/time picker shown with only available slots
- Owner selects new slot and confirms
- Booking updated
- Customer notified of the change via WhatsApp

---

**US-008: View today's schedule**

> As a salon owner, I want to see all of today's appointments in one view, so that I can plan the day.

**Acceptance Criteria:**
- Dashboard shows today's bookings in chronological order
- Each booking shows: customer name, service, time, payment status badge
- Tapping a booking opens the detail view
- List updates in real-time (or on pull-to-refresh)

---

**US-009: View revenue summary**

> As a salon owner, I want to see a revenue summary in the app, so that I can track financial performance.

**Acceptance Criteria:**
- Dashboard shows: today's confirmed revenue, this week's revenue, this month's revenue
- Payments tab shows itemised transaction list with date, customer, service, amount
- Can filter by date range

---

### Notifications

---

**US-010: Receive appointment reminders**

> As a customer, I want to receive reminders before my appointment, so that I do not forget.

**Acceptance Criteria:**
- Reminder sent via WhatsApp 24 hours before the appointment
- Second reminder sent via WhatsApp 1 hour before
- Reminder includes: service, date, time, salon location
- Customer can reply to reminder to cancel or reschedule

---

## Functional Requirements

### FR-BK: Booking Management

| ID | Requirement |
|---|---|
| FR-BK-01 | System must create a booking with status PENDING when a customer completes the WhatsApp booking flow |
| FR-BK-02 | System must prevent double-booking of the same slot |
| FR-BK-03 | Owner must be able to approve, reject, reschedule, or cancel any booking from the PWA app |
| FR-BK-04 | System must release a slot back to availability when a booking is cancelled or rejected |
| FR-BK-05 | Bookings must have a unique human-readable reference (e.g., WN-2026-00123) |
| FR-BK-06 | System must support configurable slot duration per service |
| FR-BK-07 | System must respect business hours in slot generation |
| FR-BK-08 | System must support blocking slots (e.g., lunch breaks, holidays) |
| FR-BK-09 | All booking state changes must be recorded in a status history table |
| FR-BK-10 | Bookings must be soft-deleted, not hard-deleted |

### FR-PM: Payment Management

| ID | Requirement |
|---|---|
| FR-PM-01 | System must initiate an M-Pesa STK Push after booking confirmation |
| FR-PM-02 | System must expose a Daraja callback endpoint for payment status |
| FR-PM-03 | System must verify payment amounts match booking amounts |
| FR-PM-04 | System must handle duplicate callbacks idempotently |
| FR-PM-05 | System must store M-Pesa transaction ID (MpesaReceiptNumber) against each payment |
| FR-PM-06 | System must support manual payment marking by owner (for in-person cash) |
| FR-PM-07 | Payment history must be searchable by date, customer, and status |
| FR-PM-08 | System must retry STK Push if the first attempt fails (up to 2 retries) |

### FR-WA: WhatsApp Automation

| ID | Requirement |
|---|---|
| FR-WA-01 | System must handle all customer interactions via WhatsApp Cloud API |
| FR-WA-02 | WhatsApp workflow must be implemented as a finite state machine and a human agent as a fallback |
| FR-WA-03 | Session state must be stored in Redis with a 30-minute TTL |
| FR-WA-04 | System must handle invalid/unrecognized inputs gracefully |
| FR-WA-05 | System must timeout stalled sessions after 30 minutes and send a friendly message |
| FR-WA-06 | System must support human escalation (transfer to owner's WhatsApp) |
| FR-WA-07 | System must verify incoming webhook messages with the Meta webhook signature |
| FR-WA-08 | Outbound messages must be rate-limited to comply with WhatsApp API limits |
| FR-WA-09 | System must support WhatsApp message templates for reminders and notifications |
| FR-WA-010 | System must store a record of each conversation for future improvements eg Rule based chatbot -> Ai chatbot -> Ai agent |
### FR-NT: Notifications

| ID | Requirement |
|---|---|
| FR-NT-01 | System must send a booking confirmation WhatsApp message immediately after PENDING creation |
| FR-NT-02 | System must send a confirmation WhatsApp message when a booking is APPROVED |
| FR-NT-03 | System must send a 24-hour reminder via WhatsApp before each APPROVED booking |
| FR-NT-04 | System must send a 1-hour reminder via WhatsApp before each APPROVED booking |
| FR-NT-05 | System must send a cancellation notice via WhatsApp when a booking is cancelled |
| FR-NT-06 | System must send a rescheduling notice via WhatsApp when an appointment is moved |
| FR-NT-07 | System must push a notification to the PWA app when a new booking is created |
| FR-NT-08 | All notification jobs must be queued via BullMQ and retried on failure |
---

## Non-Functional Requirements

### Performance
- API response time: p95 < 300ms under normal load
- WhatsApp message processing: < 2 seconds end-to-end
- STK Push initiation: < 5 seconds from booking confirmation
- PWA app: first meaningful paint < 1.5 seconds on LTE

### Scalability
- System must handle 500 concurrent WhatsApp conversations
- Database must support 100,000 bookings without performance degradation
- Queue system must process 1,000 notification jobs per minute

### Availability
- Backend API uptime: ≥ 99.5% monthly
- Planned maintenance windows: Sundays 02:00–04:00 EAT

### Security
- All API endpoints require JWT authentication (except webhooks)
- Webhook endpoints must validate signatures
- No PII stored in logs
- M-Pesa credentials stored in environment variables / secrets manager
- All data in transit encrypted via TLS 1.2+
- Passwords hashed with bcrypt (cost factor 12)

### Reliability
- All critical jobs (reminders, STK Push) must be persisted to Redis before acknowledgement
- Failed jobs must retry with exponential backoff (3 attempts max)
- Dead-letter queue for jobs that exhaust retries

### Auditability
- All booking state changes must be logged with actor, timestamp, and reason
- All payment transactions must be immutable (no updates, only new records)
- Admin actions (approve, cancel, reschedule) must be logged with staff ID

### Compliance
- Kenya Data Protection Act (KDPA) 2019 compliance required
- WhatsApp Business Policy compliance required
- Customer consent to messaging must be captured at first interaction
- Data retention: booking data 7 years (Kenya financial regulations), conversation logs 90 days

---

## Success Metrics

| Metric | Measurement Method | Target | Review Cadence |
|---|---|---|---|
| Booking completion rate | Completed bookings / initiated conversations | ≥ 85% | Weekly |
| Payment completion rate | Paid bookings / approved bookings | ≥ 90% | Weekly |
| No-show rate | No-shows / confirmed bookings | < 15% | Monthly |
| Reminder delivery rate | Delivered reminders / scheduled reminders | ≥ 98% | Weekly |
| API uptime | Uptime monitoring | ≥ 99.5% | Monthly |
| WhatsApp session timeout rate | Timed-out sessions / initiated sessions | < 10% | Weekly |
| Customer re-booking rate | Customers with 2+ bookings / total customers | ≥ 60% | Monthly |

---

## Future Roadmap

### Phase 2
- Multi-staff scheduling (assign bookings to specific technicians)
- Waitlist management
- Loyalty points system
- Google Calendar integration for staff

### Phase 3
- Customer-facing web booking portal
- Automated upsell messages (e.g., "Your gel nails are due for a fill — book now")
- Analytics dashboard with revenue forecasting


