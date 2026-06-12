# UI/UX Specification — Wanny's Nails PWA

**Version:** 1.1  
**Platform:** React / Vite / vite-plugin-pwa — runs in any browser, installable on iOS/Android  
**Status:** Approved

---

## Design Principles

| Principle | Description |
|---|---|
| **Clarity first** | Every screen has one primary action. Labels are plain English, not jargon. |
| **Speed over features** | The owner must be able to approve a booking in under 2 taps from the home screen. |
| **Status at a glance** | Payment status, booking status, and appointment time always visible without drilling in. |
| **Graceful loading** | Skeleton screens during data fetch. No blank white screens. |
| **Forgiving** | Destructive actions (cancel, delete) always require confirmation. |
| **Accessible** | WCAG AA contrast ratios. Respects `prefers-reduced-motion`. Focus management on all interactive elements. |
| **Offline-first** | Today's schedule readable from service worker cache when network is unavailable. |

---

## PWA Configuration

```
manifest.json
  name:             "Wanny's Nails"
  short_name:       "WannyNails"
  display:          "standalone"          ← hides browser chrome when installed
  orientation:      "portrait"
  theme_color:      "#C084A8"
  background_color: "#FAFAFA"
  start_url:        "/dashboard"
  icons:            192×192, 512×512 PNG

Service Worker (vite-plugin-pwa / Workbox)
  Cache strategy:   NetworkFirst for API calls
                    CacheFirst for static assets
  Offline fallback: /offline.html shown when network unavailable
```

**Install prompt:** Custom "Add to Home Screen" banner shown after 2nd visit. Dismissed state persisted in localStorage. Not shown again if already installed (`navigator.standalone === true` on iOS Safari).

---

## Design System

### Color Tokens (CSS custom properties)

```css
--color-primary:        #C084A8;
--color-primary-dark:   #9B5E82;
--color-primary-light:  #EDD9EA;

--color-bg:             #FAFAFA;
--color-surface:        #FFFFFF;
--color-surface-raised: #F4F4F4;

--color-text-primary:   #1A1A1A;
--color-text-secondary: #6B7280;
--color-text-disabled:  #BDBDBD;

--color-success:        #22C55E;
--color-success-bg:     #F0FDF4;
--color-warning:        #F59E0B;
--color-warning-bg:     #FFFBEB;
--color-error:          #EF4444;
--color-error-bg:       #FEF2F2;
--color-info:           #3B82F6;
--color-info-bg:        #EFF6FF;

--color-border:         #E5E7EB;
--color-divider:        #F3F4F6;
```

### Typography

System font stack — renders as SF Pro on iOS/macOS, Segoe UI on Windows, Roboto on Android.

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--text-2xl` | 2rem (32px) | 700 | Screen titles |
| `--text-xl` | 1.5rem (24px) | 700 | Section headers |
| `--text-lg` | 1.25rem (20px) | 600 | Card titles |
| `--text-md` | 1.0625rem (17px) | 600 | List item primary text |
| `--text-base` | 1rem (16px) | 400 | Body copy |
| `--text-sm` | 0.9375rem (15px) | 400 | Secondary labels |
| `--text-xs` | 0.8125rem (13px) | 400 | Metadata, timestamps |
| `--text-2xs` | 0.75rem (12px) | 400 | Badges, small labels |

All sizes in `rem`. Do not use `px` for text — allows browser font size preferences to be respected.

### Spacing Scale

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
```

### Corner Radius

```css
--radius-sm: 8px;   /* Badges, chips */
--radius-md: 12px;  /* Cards */
--radius-lg: 16px;  /* Modals, drawers */
--radius-xl: 24px;  /* Bottom sheets */
```

### Shadows

```css
--shadow-card:    0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
--shadow-raised:  0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
--shadow-modal:   0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05);
```

---

## Components

### Booking Status Badge

Pill-shaped `<span>` with icon and text. Background is a light tint of the status colour.

| Status | CSS var | Icon (Lucide) | Label |
|---|---|---|---|
| PENDING | `--color-warning` | `Clock` | Pending |
| APPROVED | `--color-info` | `CheckCircle` | Confirmed |
| PAYMENT_PENDING | `--color-warning` | `CreditCard` | Awaiting Payment |
| PAYMENT_COMPLETED | `--color-success` | `BadgeCheck` | Paid |
| CANCELLED | `--color-error` | `XCircle` | Cancelled |
| COMPLETED | `--color-success` | `Star` | Completed |
| RESCHEDULED | `--color-info` | `RefreshCw` | Rescheduled |

### Booking Card

Used in lists. Shows:
- Customer avatar (initials in coloured circle, generated from name)
- Customer name (`--text-md`, semibold)
- Service name (`--text-sm`, `--color-text-secondary`)
- Time (`--text-base`, formatted as "2:30 PM")
- Status badge (right-aligned)

Clicking opens Booking Detail. On mobile, swipe-left (touch event) reveals action buttons: Approve (green), Reschedule (blue), Cancel (red). Actions shown conditionally based on booking status.

### Stat Card

White `<div>` with `--shadow-card`:
- Lucide icon in a tinted circle (`--color-primary-light` background)
- Metric value (`--text-2xl`, bold)
- Label (`--text-sm`, `--color-text-secondary`)
- Optional trend indicator (↑/↓ with % change, coloured success/error)

### Primary Button

```css
background:    var(--color-primary);
color:         white;
font-size:     var(--text-md);
font-weight:   600;
height:        52px;
border-radius: var(--radius-lg);
width:         100% in forms; auto in toolbars;

&:disabled  { opacity: 0.5; cursor: not-allowed; }
&[data-loading] { /* spinner replaces label */ }
```

### Secondary Button

```css
background:    var(--color-surface);
border:        1px solid var(--color-border);
color:         var(--color-primary);
/* Same height/radius as Primary */
```

### Destructive Button

```css
background: var(--color-error);
color:      white;
/* Always preceded by a confirmation dialog */
```

### Text Input

```css
background:    var(--color-surface-raised);
border:        1px solid var(--color-border);
border-radius: var(--radius-md);

&:focus        { border-color: var(--color-primary); outline: none; }
&[aria-invalid] { border-color: var(--color-error); }
/* Floating label via CSS :placeholder-shown trick */
```

### Empty State

Centred `<div>`:
- Lucide icon (48px, `--color-text-disabled`)
- Heading (`--text-lg`)
- Supporting text (`--text-base`, `--color-text-secondary`)
- Optional CTA button

### Toast Notification

Fixed-position at bottom of viewport (`bottom: calc(env(safe-area-inset-bottom) + 16px)`), slides up via CSS `transform` transition:
- Lucide icon + message text
- Colours: success / error / info backgrounds
- Auto-dismisses after 3 seconds
- Announced to screen readers via `role="status"` or `role="alert"`

### Bottom Sheet (mobile modal)

`position: fixed; bottom: 0` with `border-radius: var(--radius-xl) var(--radius-xl) 0 0`. Drag-to-dismiss via touch events. Backdrop overlay with `backdrop-filter: blur(2px)`. Focus trapped while open.

### Confirmation Dialog

Native `<dialog>` element with custom styling. Backdrop via `::backdrop`. Keyboard: `Escape` cancels, `Enter` confirms. Focus moves to destructive action button on open.

---

## Information Architecture

### Bottom Navigation Bar (mobile)

Fixed at bottom, `padding-bottom: env(safe-area-inset-bottom)` for iPhone notch/home bar:

```
[ Dashboard ]  [ Bookings ]  [ Customers ]  [ Payments ]  [ Settings ]
  house icon    calendar       people         credit card    gear
```

Badge on Bookings tab showing pending approval count.

### Top Navigation Bar (desktop ≥ 768px)

Sidebar navigation replaces bottom bar on wider screens. Same 5 items, with labels. Collapsible to icon-only on medium widths.

### Navigation Pattern

- React Router v6 with nested routes
- Each tab is a top-level route: `/dashboard`, `/bookings`, `/customers`, `/payments`, `/settings`
- Detail views: `/bookings/:id`, `/customers/:id`, `/payments/:id`
- Modals / bottom sheets: rendered as route-based overlays (URL changes to `/bookings/new`, `/bookings/:id/reschedule`) — supports back-button dismiss
- Browser back button and swipe-back gesture both close modals correctly

---

## Screen Specifications

---

### Screen: Dashboard

**Purpose:** Morning at-a-glance view. Owner sees the day's schedule and key metrics on app open.

**Layout:**
```
┌──────────────────────────────┐
│ Good morning, Grace 👋        │
│ Thursday, 5 June 2025        │
├──────────────────────────────┤
│ [Stat: Today's Bookings: 6]  │  [Stat: Pending: 2 🔴]
│ [Stat: Revenue: KES 8,500]   │  [Stat: Unpaid: KES 1,500]
├──────────────────────────────┤
│ UPCOMING TODAY               │
│  [BookingCard] 10:00 AM      │
│  [BookingCard] 11:30 AM      │
│  [BookingCard] 2:00 PM       │
│  [See all →]                 │
├──────────────────────────────┤
│ PENDING APPROVALS (2)        │
│  [BookingCard] Akinyi M.     │
│  [BookingCard] Zawadi K.     │
└──────────────────────────────┘
```

**Real-time updates:** SSE connection open on this screen. New bookings appear at the top of Pending Approvals without refresh. Badge on bottom nav updates live.

**States:**
- Loading: CSS skeleton screens (animated gradient) for stat cards and list items
- Empty today: empty state with calendar icon, "No appointments today"
- No pending: Pending Approvals section hidden entirely
- Offline: banner "You're offline — showing cached data"
- SSE disconnected: silent reconnect attempt every 5s; banner after 30s

**User Actions:**
- Click stat card → navigates to filtered list
- Click booking card → `/bookings/:id`
- Pull-to-refresh (touch) or refresh button (desktop) → reload

---

### Screen: Bookings List

**Route:** `/bookings`

**Layout:**
```
┌──────────────────────────────┐
│ Bookings              [+ New]│
│ [Today] [Upcoming] [All]     │  ← segmented control
├──────────────────────────────┤
│ 🔍 Search name or service... │
├──────────────────────────────┤
│ THURSDAY, 5 JUNE             │
│  [BookingCard]               │
│  [BookingCard]               │
│ FRIDAY, 6 JUNE               │
│  [BookingCard]               │
└──────────────────────────────┘
```

**User Actions:**
- Click `+ New` → navigate to `/bookings/new` (bottom sheet on mobile, modal on desktop)
- Click booking → `/bookings/:id`
- Swipe left (mobile) → inline action buttons
- Search input → client-side filter with 300ms debounce; falls back to API search for All tab

**Empty State:** "No bookings found. Customers book via WhatsApp."

---

### Screen: Booking Detail

**Route:** `/bookings/:id`

**Layout:**
```
┌──────────────────────────────┐
│ ←  Booking Detail    [⋯]     │
│                              │
│  [Avatar]  Wanjiku Kamau     │
│            +254 712 345 678  │
│            [WhatsApp button] │
│                              │
│  ┌────────────────────────┐  │
│  │ Service  Gel Manicure  │  │
│  │ Date     Thu 5 Jun     │  │
│  │ Time     2:00 PM       │  │
│  │ Duration 60 min        │  │
│  │ Price    KES 1,500     │  │
│  │ Status   [PENDING]     │  │
│  │ Payment  [AWAITING]    │  │
│  └────────────────────────┘  │
│                              │
│  REF: NB-2025-00123          │
│                              │
│  [Approve Booking]           │
│  [Reschedule]                │
│  [Cancel Booking]            │
└──────────────────────────────┘
```

**WhatsApp button:** `href="https://wa.me/254712345678"` — opens WhatsApp web/app directly.

**Action states by booking status:**
- PENDING: Approve (primary) + Reschedule (secondary) + Cancel (destructive)
- APPROVED, UNPAID: Send Payment Request + Reschedule + Cancel
- APPROVED, PAID: Mark Complete + Reschedule + Cancel
- COMPLETED: read-only, no action buttons
- CANCELLED: read-only banner "Cancelled"

---

### Screen: Create Booking

**Route:** `/bookings/new`  
**Presentation:** Bottom sheet (mobile) / centred modal (desktop)

Step 1 — Customer: search input with live results dropdown; "New customer" option captures name + phone  
Step 2 — Service: radio-button card list (name, duration, price per card)  
Step 3 — Date & Time: `<input type="date">` or custom calendar; time slot grid below  
Step 4 — Confirm: summary card + "Confirm Booking" button  

Progress indicator (step 1 of 4) at top of sheet. Back button between steps. Closing the sheet at any step prompts "Discard booking?" confirmation.

---

### Screen: Customers List

**Route:** `/customers`

Alphabetical grouping with sticky section headers. Search filters in real time. Each row shows avatar, name, last booking date.

---

### Screen: Customer Detail

**Route:** `/customers/:id`

Shows profile stats (total bookings, total spent), full booking history, and payment history in collapsible sections.

---

### Screen: Payments Dashboard

**Route:** `/payments`

Period segmented control (Today / Week / Month / Custom date range). Stats row. Scrollable transaction list. Each row: customer name, amount, service, time, status badge.

---

### Screen: Transaction Detail

**Route:** `/payments/:id`

Full M-Pesa transaction details: receipt number, phone, amount, timestamp, status. "View Booking" link.

---

### Screen: Settings

**Route:** `/settings`

Grouped list rendered as `<section>` blocks with headings:

1. **Business** — name, address, phone, logo upload
2. **Hours** — day-of-week toggles with open/close time pickers
3. **Services** — CRUD list, drag-to-reorder
4. **Reminders** — toggles for 24h / 1h, editable message preview
5. **WhatsApp** — read-only config display, template approval status
6. **M-Pesa** — shortcode, test mode toggle
7. **Team** — invite by email, active staff list, deactivate button
8. **Account** — change password, logout (clears tokens + service worker cache)

---

## User Flows

### Flow: Approve a Booking

```
Dashboard → Pending Approvals section
  → Click booking card → /bookings/:id
  → Click "Approve Booking"
  → <dialog>: "Approve booking for Wanjiku at 2:00 PM?" [Cancel] [Approve]
  → Click "Approve"
  → Button shows spinner
  → Success: status badge updates inline, action buttons re-render for APPROVED state
  → Toast slides up: "Booking approved. Wanjiku has been notified."
  → Dashboard badge decrements via SSE event (no refresh needed)
```

### Flow: Create Booking (Manual)

```
Bookings tab → Click [+ New] → /bookings/new
  → Bottom sheet opens
  → Step 1: Type "Wanjiku" → select from dropdown
  → Step 2: Click "Gel Manicure"
  → Step 3: Pick Thu 5 Jun → click "2:00 PM"
  → Step 4: Review → click "Confirm Booking"
  → Spinner → success state: "Booking created! NB-2025-00123"
  → Click "Done" → sheet closes → booking appears at top of list
```

### Flow: Reschedule a Booking

```
/bookings/:id → Click "Reschedule" → /bookings/:id/reschedule
  → Bottom sheet: calendar + available dates
  → Pick new date → time slot grid updates
  → Pick new time → "Confirm Reschedule"
  → Dialog: "Reschedule to Fri 6 Jun at 3:00 PM?" [Cancel] [Confirm]
  → Confirm → booking updates → toast → sheet closes
```

### Flow: Cancel a Booking

```
/bookings/:id → Click "Cancel Booking"
  → Dialog: "Cancel this appointment?" [Keep] [Cancel Appointment]
  → Click "Cancel Appointment"
  → Booking status → CANCELLED
  → Toast: "Booking cancelled. Wanjiku has been notified."
  → Action buttons removed, cancelled banner shown
```

---

## Responsive Layout

| Breakpoint | Layout |
|---|---|
| < 768px (mobile) | Bottom nav bar, full-screen routes, bottom sheets for modals |
| 768px–1024px (tablet) | Sidebar nav (icon only), modals as centred overlays |
| > 1024px (desktop) | Sidebar nav (icon + label), master-detail layout on bookings/customers |

---

## Accessibility

- All interactive elements have `aria-label` where text label is absent
- Status badges use `aria-label` with full text (not just colour/icon)
- Colour never the only way to convey status — always paired with text or icon
- Minimum touch target: 44×44px (`min-height: 44px; min-width: 44px`)
- Focus visible: custom `:focus-visible` ring using `--color-primary`
- Skip-to-content link at top of page for keyboard users
- All modals/dialogs trap focus and return focus on close
- `prefers-reduced-motion`: all transitions set to `duration: 0` when enabled
- `prefers-color-scheme`: dark mode token overrides (planned Phase 2)
- Form inputs have associated `<label>` elements (not just placeholders)

---

## Offline Behaviour

| Scenario | Behaviour |
|---|---|
| Dashboard loaded, network drops | Cached schedule remains visible; banner: "You're offline" |
| User tries to approve while offline | Button disabled; tooltip: "No connection — action unavailable offline" |
| Network restores | Banner dismisses automatically; data refreshes silently |
| First load with no cache | Full offline fallback page with salon contact number |

---

## Empty States

| Screen | Icon (Lucide) | Message | CTA |
|---|---|---|---|
| Dashboard (no bookings today) | `CalendarX` | "No appointments today" | — |
| Bookings list (no results) | `Calendar` | "No bookings found" | "+ New Booking" |
| Customers (none yet) | `Users` | "No customers yet — they appear after their first WhatsApp booking" | — |
| Payments (no transactions) | `CreditCard` | "No transactions in this period" | — |
| Customer booking history | `Clock` | "No past bookings" | — |

---

## Error States

| Scenario | Treatment |
|---|---|
| Network error on load | Full-screen error: Lucide `WifiOff` icon, "Couldn't load data", "Retry" button |
| Network error on action | Toast (error): "Action failed — check your connection and try again" |
| Session expired (401) | Redirect to `/login` with toast: "Session expired. Please log in again." |
| Slot taken during create/reschedule | Inline error on time grid: "This slot was just taken — please choose another" |
| STK Push failed | Toast: "Payment request failed. Retry from the booking detail." |
| SSE connection lost | Silent reconnect; banner after 30s: "Live updates paused — reconnecting…" |

---

## Notifications

**In-app (SSE-driven):** Badge updates and toast alerts while the PWA tab is open.

**Web Push (via Web Push API):** Shown when PWA is installed and tab is closed. Requires user permission grant. Used for new booking alerts to the owner.

```
Notification title: "New booking — Wanjiku Kamau"
Notification body:  "Gel Manicure · Thu 5 Jun · 2:00 PM"
Notification icon:  /icons/192.png
Notification data:  { url: "/bookings/:id" }  ← click opens booking detail
```

**Fallback:** If web push permission denied or unavailable, a WhatsApp message is sent to the owner's number via the existing notification queue (already in the backend spec).

---

## WhatsApp Conversational UX

See [WHATSAPP_AUTOMATION.md](./WHATSAPP_AUTOMATION.md) for the full state machine and message scripts.

The human escalation path now sends a browser notification (web push) to the owner's installed PWA instead of an APNs push, with the same payload structure.
