# Architecture — Wanny's Nails

**Version:** 1.1

---

## C4 Level 1: System Context Diagram

```mermaid
C4Context
    title System Context for Wanny's Nails

    Person(customer, "Customer", "Kenyan nail salon customer. Books and pays via WhatsApp.")
    Person(owner, "Salon Owner", "Manages appointments and business using PWA.")
    Person(staff, "Salon Staff", "Views schedule and manages daily bookings using PWA.")

    System(wannys, "Wanny's Nails Platform", "Booking management, WhatsApp automation, and M-Pesa payments.")

    System_Ext(whatsapp, "WhatsApp Cloud API", "Meta's messaging API. Receives and sends WhatsApp messages.")
    System_Ext(daraja, "Daraja M-Pesa API", "Safaricom's payment API. Processes STK Push payments.")
    System_Ext(email, "Resend Email", "Email notifications.")

    Rel(customer, whatsapp, "Books appointments, pays, receives reminders", "WhatsApp")
    Rel(owner, wannys, "Manages bookings, views reports", "PWA")
    Rel(staff, wannys, "Views schedule, handles requests", "PWA")
    Rel(whatsapp, wannys, "Delivers incoming messages", "HTTPS Webhook")
    Rel(wannys, whatsapp, "Sends messages to customers", "HTTPS REST API")
    Rel(wannys, daraja, "Initiates STK Push payments", "HTTPS REST API")
    Rel(daraja, wannys, "Delivers payment results", "HTTPS Callback")
    Rel(wannys, email, "Sends email notifications", "HTTPS REST API")
```

---

## C4 Level 2: Container Diagram

```mermaid
C4Container
    title Container Diagram — Wanny's Nails

    Person(customer, "Customer", "WhatsApp user")
    Person(owner, "Salon Owner / Staff", "PWA user")

    Container(web, "PWA", "React / Vite / vite-plugin-pwa", "Progressive web app for salon management. Installable on any device. Displays bookings, payments, customer data.")
    Container(api, "Backend API", "Node.js / Express / TypeScript", "REST API. Handles business logic, authentication, booking engine, payment workflows.")
    Container(worker, "Background Worker", "BullMQ / Node.js", "Processes async jobs: reminders, STK Push, notifications.")
    ContainerDb(postgres, "PostgreSQL", "Relational Database", "Primary data store: bookings, customers, payments, audit logs.")
    ContainerDb(redis, "Redis", "Cache + Queue", "WhatsApp session state (TTL 30min), BullMQ job queues, auth token cache.")

    System_Ext(whatsapp, "WhatsApp Cloud API")
    System_Ext(daraja, "Daraja M-Pesa API")
    System_Ext(email, "Resend Email")

    Rel(customer, whatsapp, "Sends/receives messages")
    Rel(owner, web, "Uses", "Browser / Installed PWA")
    Rel(web, api, "REST API calls", "HTTPS/JSON")
    Rel(web, api, "Real-time updates", "WebSocket / SSE")
    Rel(whatsapp, api, "Webhook POSTs", "HTTPS")
    Rel(api, whatsapp, "Send messages", "HTTPS REST")
    Rel(api, postgres, "Read/write data", "TCP / Prisma")
    Rel(api, redis, "Session read/write, queue jobs", "TCP")
    Rel(worker, redis, "Dequeues jobs", "TCP")
    Rel(worker, postgres, "Read/write data", "TCP / Prisma")
    Rel(worker, daraja, "STK Push", "HTTPS")
    Rel(daraja, api, "Payment callback", "HTTPS")
    Rel(worker, whatsapp, "Send reminder messages", "HTTPS REST")
    Rel(worker, email, "Send email", "HTTPS REST")
```

---

## C4 Level 3: Component Diagram — Backend API

```mermaid
C4Component
    title Component Diagram — Backend API

    Container_Boundary(api, "Backend API") {
        Component(authMod, "Auth Module", "Express Router", "Login, token refresh, logout.")
        Component(bookingMod, "Bookings Module", "Express Router + Service", "Full booking lifecycle.")
        Component(slotEngine, "Slot Engine", "Pure TypeScript", "Computes available slots from business hours, service duration, and existing bookings.")
        Component(paymentMod, "Payments Module", "Express Router + Service", "STK Push initiation and callback handling.")
        Component(customerMod, "Customers Module", "Express Router + Service", "Customer CRUD and history.")
        Component(webhookMod, "Webhook Handler", "Express Router", "Receives and validates WhatsApp and Daraja webhooks.")
        Component(fsmEngine, "WhatsApp FSM Engine", "TypeScript", "Stateless finite state machine. Loads session from Redis, processes input, returns output messages.")
        Component(notifMod, "Notifications Module", "Service", "Queues notification jobs for BullMQ.")
        Component(sseHandler, "SSE Handler", "Express Router", "Server-Sent Events stream. Pushes real-time booking and payment events to connected PWA clients.")
        Component(authMw, "Auth Middleware", "Express Middleware", "Validates JWT tokens.")
        Component(errorHandler, "Error Handler", "Express Middleware", "Maps domain errors to HTTP responses.")
    }

    ContainerDb(postgres, "PostgreSQL")
    ContainerDb(redis, "Redis")
    System_Ext(whatsapp, "WhatsApp Cloud API")
    Container(web, "PWA")

    Rel(authMod, postgres, "Validates credentials, stores tokens")
    Rel(bookingMod, slotEngine, "Calls to check availability")
    Rel(bookingMod, postgres, "Persists bookings")
    Rel(bookingMod, notifMod, "Queues notifications on state change")
    Rel(bookingMod, sseHandler, "Emits booking events")
    Rel(paymentMod, redis, "Queues STK Push jobs")
    Rel(paymentMod, sseHandler, "Emits payment events")
    Rel(webhookMod, fsmEngine, "Delegates message processing")
    Rel(fsmEngine, redis, "Loads/saves conversation session")
    Rel(fsmEngine, bookingMod, "Creates bookings")
    Rel(fsmEngine, whatsapp, "Sends outbound messages")
    Rel(notifMod, redis, "Enqueues notification jobs")
    Rel(sseHandler, web, "Streams events", "SSE")
```

---

## Sequence Diagram: Booking Creation (WhatsApp)

```mermaid
sequenceDiagram
    actor Customer
    participant WA as WhatsApp Cloud API
    participant API as Wanny's Nails API
    participant FSM as WhatsApp FSM
    participant Redis
    participant DB as PostgreSQL
    participant Queue as BullMQ

    Customer->>WA: "Hi" (initiates chat)
    WA->>API: POST /webhooks/whatsapp (message)
    API->>API: Validate Meta signature
    API->>FSM: Process message (phone, "Hi")
    FSM->>Redis: Load session (MISS → new session, state=IDLE)
    FSM->>Redis: Save session (state=GREETING)
    FSM->>WA: Send greeting + menu options
    WA->>Customer: Greeting message

    Customer->>WA: "1" (Book appointment)
    WA->>API: POST /webhooks/whatsapp
    API->>FSM: Process ("1")
    FSM->>Redis: Load session (state=GREETING)
    FSM->>DB: Fetch services list
    FSM->>Redis: Save session (state=SERVICE_SELECTION)
    FSM->>WA: Send service list
    WA->>Customer: Service options

    Note over Customer,Queue: Customer selects service, date, time (omitted for brevity)

    Customer->>WA: "YES" (confirms booking)
    WA->>API: POST /webhooks/whatsapp
    API->>FSM: Process ("YES")
    FSM->>DB: Create booking (status=PENDING)
    FSM->>Queue: Enqueue approval notification job
    FSM->>Redis: Save session (state=PAYMENT_PENDING)
    FSM->>WA: Ask for M-Pesa number
    WA->>Customer: "What M-Pesa number?"

    Customer->>WA: "0712345678"
    WA->>API: POST /webhooks/whatsapp
    API->>FSM: Process phone number
    FSM->>Queue: Enqueue STK Push job
    FSM->>Redis: Save session (state=AWAITING_PAYMENT)
    FSM->>WA: "Payment request sent — check your phone"
    WA->>Customer: Payment prompt message

    Queue->>API: Process STK Push job
    API->>+Daraja: POST /stkpush/v3/processrequest
    Daraja-->>-API: CheckoutRequestID
    Note over Customer: M-Pesa prompt appears on phone
    Customer->>Daraja: Enters M-Pesa PIN
    Daraja->>API: POST /payments/mpesa-callback
    API->>DB: Update payment (COMPLETED) + booking (PAYMENT_COMPLETED)
    API->>Queue: Enqueue confirmation WhatsApp message
    Queue->>WA: Send payment confirmation message
    WA->>Customer: "Payment received! ✅ Booking confirmed."
```

---

## Sequence Diagram: Booking Approval (PWA)

```mermaid
sequenceDiagram
    actor Owner
    participant PWA as PWA (React)
    participant SSE as SSE Handler
    participant API as Wanny's Nails API
    participant DB as PostgreSQL
    participant Queue as BullMQ
    participant WA as WhatsApp Cloud API
    actor Customer

    PWA->>API: GET /bookings?status=PENDING (on dashboard load)
    API->>DB: Query pending bookings
    DB-->>API: Bookings list
    API-->>PWA: 200 OK, bookings array
    PWA->>SSE: Open SSE stream (GET /events)
    PWA->>Owner: Displays pending bookings with badge

    Note over SSE,PWA: New booking arrives via WhatsApp
    SSE->>PWA: event: booking.created {bookingId, customer, service}
    PWA->>Owner: Badge increments, toast notification shown

    Owner->>PWA: Clicks booking → clicks "Approve"
    PWA->>Owner: Shows confirmation dialog
    Owner->>PWA: Confirms approval
    PWA->>API: POST /bookings/:id/approve
    API->>API: Validate JWT, check booking exists and is PENDING
    API->>DB: UPDATE booking SET status=APPROVED
    API->>DB: INSERT booking_status_history
    API->>Queue: Enqueue WhatsApp confirmation job
    API->>Queue: Schedule 24h reminder job (delayed)
    API->>Queue: Schedule 1h reminder job (delayed)
    API->>SSE: Emit booking.approved event
    API-->>PWA: 200 OK, updated booking
    SSE->>PWA: event: booking.approved {bookingId}
    PWA->>Owner: Status badge updates to CONFIRMED, toast shown

    Queue->>WA: POST /messages (booking confirmed template)
    WA->>Customer: "Your appointment has been confirmed ✅"
```

---

## Sequence Diagram: Payment Processing (STK Push)

```mermaid
sequenceDiagram
    participant API as Wanny's Nails API
    participant DB as PostgreSQL
    participant Queue as BullMQ
    participant Daraja as Daraja M-Pesa

    Queue->>API: Dequeue STK Push job
    API->>Daraja: POST /stkpush/v3/processrequest
    alt Success
        Daraja-->>API: 200 OK, CheckoutRequestID
        API->>DB: INSERT payment_transaction (status=PENDING, checkoutRequestId)
    else Daraja Error
        Daraja-->>API: 4xx/5xx
        API->>Queue: Re-enqueue with backoff (attempt 2)
    end

    Note over Daraja: Customer enters PIN on phone

    Daraja->>API: POST /payments/mpesa-callback
    API->>API: Validate callback authenticity
    API->>DB: Check for existing transaction with MpesaReceiptNumber (idempotency)

    alt Payment Successful (ResultCode=0)
        API->>DB: UPDATE payment_transaction SET status=COMPLETED
        API->>DB: UPDATE booking SET paymentStatus=PAID
        API->>Queue: Enqueue WhatsApp confirmation
    else Payment Failed (ResultCode≠0)
        API->>DB: UPDATE payment_transaction SET status=FAILED, failureReason
        API->>Queue: Enqueue WhatsApp failure message + retry offer
    end
```

---

## Sequence Diagram: WhatsApp Conversation Session Management

```mermaid
sequenceDiagram
    participant WA as WhatsApp Cloud API
    participant API as Wanny's Nails API
    participant FSM as FSM Engine
    participant Redis

    WA->>API: POST /webhooks/whatsapp (message)
    API->>API: Validate X-Hub-Signature-256
    API-->>WA: 200 OK (immediate, async processing)

    API->>Redis: GET session:+254712345678
    alt Session exists
        Redis-->>API: Session JSON {state, context, lastActivity}
        API->>FSM: process(session, incomingMessage)
    else Session expired or new
        Redis-->>API: null
        API->>FSM: process({state:'IDLE'}, incomingMessage)
    end

    FSM->>FSM: Execute transition function for current state
    FSM-->>API: {newState, outboundMessages, updatedContext}

    API->>Redis: SET session:+254712345678 {newState, ...} EX 1800

    loop For each outbound message
        API->>WA: POST /messages
        WA-->>API: 200 OK, message_id
    end

    Note over Redis: After 30 min inactivity, key expires automatically
    Note over API: On expiry: next message starts fresh IDLE session
```
