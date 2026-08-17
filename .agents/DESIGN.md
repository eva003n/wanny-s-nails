# Design Rules — Wanny's Nails PWA

**Source of truth:** `UI_UX_SPECIFICATION.md`  
Read it before implementing any screen, component, or interaction.

---

## Table of Contents
1. [Design Principles](#1-design-principles)
2. [Tokens — Colours](#2-tokens--colours)
3. [Tokens — Typography](#3-tokens--typography)
4. [Tokens — Spacing](#4-tokens--spacing)
5. [Tokens — Radius & Shadows](#5-tokens--radius--shadows)
6. [Component Specifications](#6-component-specifications)
7. [Layout & Navigation](#7-layout--navigation)
8. [Screen Patterns](#8-screen-patterns)
9. [Motion & Animation](#9-motion--animation)
10. [Responsive Design](#10-responsive-design)
11. [Loading States](#11-loading-states)
12. [Empty States](#12-empty-states)
13. [Error States](#13-error-states)
14. [Iconography](#14-iconography)
15. [Dos and Don'ts](#15-dos-and-donts)

---

## 1. Design Principles

These are decision filters. When two solutions seem equally valid, use these to choose.

| Principle | What it means in practice |
|---|---|
| **Clarity first** | One primary action per screen. If you're adding a second primary button, reconsider the screen's purpose. |
| **Speed over features** | Approve a booking in 2 taps from the dashboard. Never make the owner navigate 3+ levels for a common action. |
| **Status at a glance** | Booking status, payment status, and appointment time visible on the list item — never require a tap to see these. |
| **Graceful loading** | Skeleton screens always. No blank white screens, no layout shift on load. |
| **Forgiving** | Every destructive action (cancel, delete) requires a confirmation dialog. One-tap undo is never sufficient for permanent actions. |
| **Offline-first** | Today's schedule readable from cache when network is unavailable. Degraded state communicated clearly — never silence. |

---

## 2. Tokens — Colours

All colours are CSS custom properties defined in `index.css` via Tailwind's `@theme` directive. **Never use hardcoded hex values or Tailwind's default colour palette** (`gray-*`, `pink-*`, `red-*`, etc.) in components.

### Palette

```
Brand
  primary:        #C084A8   bg-primary / text-primary / border-primary
  primary-dark:   #9B5E82   hover states, pressed states
  primary-light:  #EDD9EA   tinted backgrounds, highlights

Backgrounds
  bg:             #FAFAFA   page background — never pure white
  surface:        #FFFFFF   cards, modals, nav
  surface-raised: #F4F4F4   inputs, inactive tabs

Text
  text-primary:   #1A1A1A   headings, primary labels
  text-secondary: #6B7280   supporting text, metadata
  text-disabled:  #BDBDBD   disabled states, placeholder

Semantic
  success:        #22C55E   confirmed, paid, completed
  success-bg:     #F0FDF4   success badge background
  warning:        #F59E0B   pending, awaiting payment
  warning-bg:     #FFFBEB   warning badge background
  error:          #EF4444   cancelled, failed, destructive
  error-bg:       #FEF2F2   error badge background
  info:           #3B82F6   approved/confirmed status
  info-bg:        #EFF6FF   info badge background

Structure
  border:         #E5E7EB   input borders, card borders, dividers
  divider:        #F3F4F6   subtle section separators
```

### Usage rules

```tsx
// ✅ Always use tokens
<div className="bg-surface border border-border rounded-[--radius-md]">
<p className="text-text-secondary text-sm">
<button className="bg-primary text-white hover:bg-primary-dark">
<span className="bg-success-bg text-success">Paid</span>

// ❌ Never hardcode or use default Tailwind colours
<div className="bg-white border border-gray-200">
<p className="text-gray-500">
<button style={{ backgroundColor: '#C084A8' }}>
<span className="bg-green-100 text-green-600">
```

### Colour semantics — never swap

| Colour | Always means | Never use for |
|---|---|---|
| `primary` | Brand action, CTA | Errors, success, info |
| `success` | Completed, paid, confirmed | Progress, loading |
| `warning` | Pending, attention needed | Low severity info |
| `error` | Failed, cancelled, destructive | Warnings |
| `info` | Neutral status, approved | Errors |

### Contrast

All text/background combinations must meet **WCAG AA** (4.5:1 for normal text, 3:1 for large text). Never put `text-primary` on `bg-primary` — use `text-white` instead. Never put `text-text-disabled` on `bg-surface-raised` for meaningful content.

---

## 3. Tokens — Typography

Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
Renders as SF Pro (iOS/macOS), Segoe UI (Windows), Roboto (Android). No external font dependency.

### Scale

| Token | rem | px equiv | Weight | Tailwind class | Usage |
|---|---|---|---|---|---|
| `2xl` | 2rem | 32px | 700 | `text-2xl font-bold` | Screen titles |
| `xl` | 1.5rem | 24px | 700 | `text-xl font-bold` | Section headers |
| `lg` | 1.25rem | 20px | 600 | `text-lg font-semibold` | Card titles |
| `md` | 1.0625rem | 17px | 600 | `text-[1.0625rem] font-semibold` | List item primary text |
| `base` | 1rem | 16px | 400 | `text-base` | Body copy |
| `sm` | 0.9375rem | 15px | 400 | `text-[0.9375rem]` | Secondary labels |
| `xs` | 0.8125rem | 13px | 400 | `text-[0.8125rem]` | Metadata, timestamps |
| `2xs` | 0.75rem | 12px | 400 | `text-xs` | Badges, small labels |

### Rules

- **All font sizes in `rem`** — never `px`. Respects browser/OS font size preferences.
- **Line height:** `leading-normal` (1.5) for body text, `leading-tight` (1.25) for headings.
- **Letter spacing:** default for all sizes except `2xs` badges where `tracking-wide` improves legibility.
- **Font weight** follows the scale above — never use 400 for primary labels, never use 700 for body copy.
- **Truncation** on single-line list items with `truncate`. Never let customer names or service names overflow their container.

```tsx
// ✅ Correct typography
<h1 className="text-2xl font-bold text-text-primary leading-tight">Dashboard</h1>
<p className="text-base text-text-primary leading-normal">Body text</p>
<span className="text-xs text-text-secondary tracking-wide uppercase">Badge</span>

// ❌ Wrong
<h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>
<p className="text-[14px]">       // px value
<p className="text-gray-900">     // hardcoded colour
```

---

## 4. Tokens — Spacing

All spacing uses Tailwind's 4px base scale. Only use values from the scale — never arbitrary spacing.

```
space-1  →  4px   →  p-1,  m-1,  gap-1
space-2  →  8px   →  p-2,  m-2,  gap-2
space-3  →  12px  →  p-3,  m-3,  gap-3
space-4  →  16px  →  p-4,  m-4,  gap-4   ← standard component padding
space-5  →  20px  →  p-5,  m-5,  gap-5
space-6  →  24px  →  p-6,  m-6,  gap-6   ← section spacing
space-8  →  32px  →  p-8,  m-8,  gap-8   ← screen top padding
space-10 →  40px  →  p-10, m-10, gap-10
space-12 →  48px  →  p-12, m-12, gap-12
```

### Spacing conventions

| Context | Value | Class |
|---|---|---|
| Icon internal padding | 4px | `p-1` |
| Tight element grouping | 8px | `gap-2` |
| Standard card padding | 16px | `p-4` |
| Between card sections | 24px | `gap-6` |
| Screen horizontal padding | 16px | `px-4` |
| Screen top padding | 32px | `pt-8` |
| Bottom nav height | 64px | `h-16` |

---

## 5. Tokens — Radius & Shadows

### Border radius

```
radius-sm  →  8px   →  rounded-[--radius-sm]   badges, chips, small tags
radius-md  →  12px  →  rounded-[--radius-md]   cards, inputs, dropdowns
radius-lg  →  16px  →  rounded-[--radius-lg]   buttons, modals
radius-xl  →  24px  →  rounded-[--radius-xl]   bottom sheets
```

Never use Tailwind's default `rounded-*` values (`rounded-lg` = 8px in Tailwind, but our `radius-lg` = 16px). Always use the `--radius-*` token.

### Shadows

```
shadow-card   →  shadow-[--shadow-card]    cards, list items, stat blocks
shadow-raised →  shadow-[--shadow-raised]  dropdowns, popovers, hover states
shadow-modal  →  shadow-[--shadow-modal]   modals, bottom sheets, dialogs
```

Rules:
- Cards always use `shadow-card` — never `shadow-md` or `drop-shadow-*`.
- Do not apply shadow to elements that already sit on a coloured or raised background.
- Never stack shadows (two nested elements both with `shadow-card`).

---

## 6. Component Specifications

### Button

Three variants. Never create a fourth.

```tsx
// Primary — one per screen section maximum
<button className="
  bg-primary hover:bg-primary-dark active:scale-[0.98]
  text-white font-semibold text-[1.0625rem]
  min-h-11 px-6 w-full
  rounded-[--radius-lg]
  transition-colors duration-150
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Approve Booking
</button>

// Secondary — supporting action
<button className="
  bg-surface hover:bg-surface-raised
  border border-border
  text-primary font-semibold text-[1.0625rem]
  min-h-11 px-6
  rounded-[--radius-lg]
  transition-colors duration-150
">
  Reschedule
</button>

// Destructive — irreversible actions only, always behind confirmation
<button className="
  bg-error hover:bg-red-600 active:scale-[0.98]
  text-white font-semibold text-[1.0625rem]
  min-h-11 px-6 w-full
  rounded-[--radius-lg]
  transition-colors duration-150
">
  Cancel Booking
</button>
```

**Loading state:** Replace label with a spinner (`animate-spin` SVG). Keep button dimensions identical — never resize on load.

**Icon buttons** (close, back, menu): minimum `min-h-11 min-w-11`, centered icon, no visible background unless hovered.

### Booking Status Badge

Pill-shaped. Background is always the `*-bg` tint of the status colour. Text is the status colour. Never background = status colour (too harsh).

```tsx
const badgeConfig = {
  PENDING:            { bg: "bg-warning-bg",  text: "text-warning", label: "Pending" },
  APPROVED:           { bg: "bg-info-bg",     text: "text-info",    label: "Confirmed" },
  PAYMENT_PENDING:    { bg: "bg-warning-bg",  text: "text-warning", label: "Awaiting Payment" },
  PAYMENT_COMPLETED:  { bg: "bg-success-bg",  text: "text-success", label: "Paid" },
  CANCELLED:          { bg: "bg-error-bg",    text: "text-error",   label: "Cancelled" },
  COMPLETED:          { bg: "bg-success-bg",  text: "text-success", label: "Completed" },
  RESCHEDULED:        { bg: "bg-info-bg",     text: "text-info",    label: "Rescheduled" },
};

// Always include aria-label — colour is not the only indicator
<span
  className={`${config.bg} ${config.text} text-xs font-medium px-2 py-1 rounded-[--radius-sm]`}
  aria-label={`Status: ${config.label}`}
>
  {config.label}
</span>
```

### Booking Card

List item. Fixed height on mobile. Swipe-left reveals contextual actions.

```
┌─────────────────────────────────────┐
│ [Avatar]  Wanjiku Kamau     [PAID] │  ← avatar 36px circle, initials
│           Gel Manicure             │  ← text-sm text-text-secondary
│           2:00 PM                  │  ← text-sm text-text-secondary
└─────────────────────────────────────┘
```

Rules:
- Customer name: `truncate` — never wraps.
- Avatar: generated from initials, background colour deterministic from name (hash → pick from 6 brand-adjacent colours).
- Time always formatted in EAT 12-hour format: "2:00 PM" not "14:00".
- Swipe actions revealed contextually: only show actions valid for the current booking status.

### Stat Card

```
┌──────────────────────────┐
│ [icon circle]            │
│ 6                        │  ← text-2xl font-bold
│ Today's Bookings         │  ← text-sm text-text-secondary
│ ↑ 2 from yesterday       │  ← text-xs, green/red
└──────────────────────────┘
```

Icon circle: 40×40px, `bg-primary-light`, `rounded-full`, icon in `text-primary`.  
Trend indicator: `text-success` for positive, `text-error` for negative, `text-text-secondary` for neutral.

### Text Input

```tsx
<div className="relative">
  <label className="
    absolute left-3 transition-all duration-150 pointer-events-none
    text-text-secondary
    peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base
    top-1.5 text-xs                          // floated state
  ">
    Customer name
  </label>
  <input
    className="
      peer w-full bg-surface-raised
      border border-border focus:border-primary
      rounded-[--radius-md]
      pt-6 pb-2 px-3
      text-base text-text-primary
      outline-none transition-colors duration-150
      aria-[invalid=true]:border-error
    "
    placeholder=" "
  />
  {error && (
    <p className="mt-1 text-xs text-error">{error.message}</p>
  )}
</div>
```

### Toast Notification

Fixed position, bottom of viewport, above bottom nav. Slides up on enter, slides down on exit.

```tsx
// Position
<div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+8px)] left-4 right-4 z-50">

// Variants
const toastConfig = {
  success: "bg-success-bg border-success text-success",
  error:   "bg-error-bg border-error text-error",
  info:    "bg-info-bg border-info text-info",
};

// Shape
<div className={`
  ${config} border rounded-[--radius-md]
  shadow-[--shadow-raised]
  px-4 py-3 flex items-center gap-3
  animate-slide-up
`}
  role="status"        // "alert" for errors
  aria-live="polite"   // "assertive" for errors
>
  <Icon size={16} />
  <p className="text-sm font-medium">{message}</p>
</div>
```

Auto-dismisses after 3 seconds. Error toasts require manual dismiss.

### Confirmation Dialog

Use native `<dialog>` element. Never use a custom div-based modal for confirmations.

```tsx
// Always focus the non-destructive action on open
// Destructive action is always on the right
<dialog className="rounded-[--radius-lg] shadow-[--shadow-modal] p-6 max-w-sm w-full">
  <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
  <p className="text-base text-text-secondary mb-6">{description}</p>
  <div className="flex gap-3">
    <button autofocus className="flex-1 /* secondary styles */">Keep Appointment</button>
    <button className="flex-1 /* destructive styles */">Cancel Appointment</button>
  </div>
</dialog>
```

### Bottom Sheet

Mobile modal. Slides up from bottom edge.

```tsx
<div className="
  fixed inset-x-0 bottom-0 z-50
  bg-surface
  rounded-t-[--radius-xl]
  shadow-[--shadow-modal]
  pb-[env(safe-area-inset-bottom)]
  max-h-[90vh] overflow-y-auto
">
  {/* Drag handle */}
  <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4" aria-hidden="true" />
  {children}
</div>
```

Backdrop: `fixed inset-0 bg-black/40 backdrop-blur-sm z-40`  
Drag-to-dismiss: `touchstart`/`touchmove`/`touchend` tracking 80px downward drag threshold.  
Focus trap: active while sheet is open.

### Skeleton

Match the exact shape of the content it replaces. Use `animate-pulse` with `bg-surface-raised`.

```tsx
// Booking card skeleton
<div className="flex items-center gap-3 p-4">
  <div className="w-9 h-9 rounded-full bg-surface-raised animate-pulse" />
  <div className="flex-1 space-y-2">
    <div className="h-4 w-32 bg-surface-raised rounded animate-pulse" />
    <div className="h-3 w-24 bg-surface-raised rounded animate-pulse" />
  </div>
  <div className="h-6 w-16 bg-surface-raised rounded-[--radius-sm] animate-pulse" />
</div>
```

Never use a generic full-page spinner as a loading state. Always skeleton the actual content shape.

---

## 7. Layout & Navigation

### Bottom navigation (mobile, < 768px)

```
Fixed at bottom. Height 64px. 5 tabs.
padding-bottom: env(safe-area-inset-bottom)
Background: bg-surface
Border top: 1px border-border
```

Active tab: icon + label in `text-primary`.  
Inactive tab: icon + label in `text-text-disabled`.  
Badge: absolute-positioned red pill on Bookings tab when `pendingCount > 0`.

### Sidebar (desktop, ≥ 768px)

```
Fixed left. Width 240px expanded, 64px collapsed.
Background: bg-surface
Border right: 1px border-border
```

Same 5 items as bottom nav. Hover state: `bg-surface-raised`. Active: `bg-primary-light text-primary`.

### Page layout

```tsx
// Mobile
<div className="min-h-screen bg-bg pb-16">   // pb-16 = bottom nav height
  <header className="sticky top-0 bg-surface border-b border-border px-4 py-3 z-10">
    <h1 className="text-xl font-bold text-text-primary">{title}</h1>
  </header>
  <main className="px-4 pt-4 pb-6">
    {children}
  </main>
</div>

// Desktop
<div className="flex min-h-screen bg-bg">
  <Sidebar />
  <div className="flex-1 ml-64">
    <main className="p-8 max-w-5xl mx-auto">
      {children}
    </main>
  </div>
</div>
```

### Z-index scale

```
Base content:      z-0
Sticky headers:    z-10
Dropdowns:         z-20
Bottom nav:        z-30
Backdrop:          z-40
Sheets / Modals:   z-50
Toasts:            z-60
```

Never use arbitrary z-index values outside this scale.

---

## 8. Screen Patterns

### Dashboard

Grid layout for stat cards. 2 columns on mobile, 4 on desktop.

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
  <StatCard label="Today's Bookings" value={6} icon={Calendar} />
  <StatCard label="Pending" value={2} icon={Clock} badge />
  <StatCard label="Revenue" value="KES 8,500" icon={TrendingUp} />
  <StatCard label="Unpaid" value="KES 1,500" icon={AlertCircle} />
</div>
```

Section headers use `text-xs font-semibold text-text-secondary uppercase tracking-wide` — a visual hierarchy separator, not a heading level.

### List screens (Bookings, Customers, Payments)

```
Sticky search bar below sticky header.
Grouped list with date section headers.
Pull-to-refresh on mobile (touch overscroll).
Infinite scroll or "Load more" button for pagination.
```

Date section headers: `text-xs font-semibold text-text-secondary uppercase tracking-wide py-2 px-4 bg-bg sticky top-[104px]`

### Detail screens

Back button in header, action buttons at the bottom in a fixed footer (not inline):

```tsx
// Content scrolls, actions are fixed
<div className="flex flex-col min-h-screen">
  <Header back title="Booking Detail" />
  <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32">
    {/* booking details */}
  </main>
  <footer className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] space-y-2">
    <PrimaryButton>Approve Booking</PrimaryButton>
    <SecondaryButton>Reschedule</SecondaryButton>
    <DestructiveButton>Cancel Booking</DestructiveButton>
  </footer>
</div>
```

---

## 9. Motion & Animation

### Principles
- Motion must have **purpose** — it communicates state change, not decoration.
- All durations under 300ms. Anything longer feels sluggish on mobile.
- Always respect `prefers-reduced-motion`.

### Duration scale

```
instant:    0ms    state changes that need no transition (badge count)
fast:       100ms  icon swaps, colour changes
normal:     150ms  button hover, focus rings
moderate:   200ms  dropdown appear, toast slide
slow:       250ms  bottom sheet, modal enter
```

### Standard transitions

```css
/* Button colour change */
transition-colors duration-150

/* Bottom sheet slide up */
@keyframes slide-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.animate-slide-up { animation: slide-up 250ms cubic-bezier(0.32, 0.72, 0, 1); }

/* Toast slide up */
@keyframes toast-in {
  from { transform: translateY(calc(100% + 16px)); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
.animate-toast-in { animation: toast-in 200ms ease-out; }

/* Skeleton pulse — use Tailwind's animate-pulse */
```

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

This is in `index.css`. Do not add it per-component.

---

## 10. Responsive Design

### Breakpoints

```
mobile:   < 768px    single column, bottom nav, bottom sheets
tablet:   768–1024px sidebar (icon only), modals as overlays
desktop:  > 1024px   sidebar (icon + label), master-detail layouts
```

### Mobile-first rule

Write mobile styles first, add `md:` and `lg:` prefixes for larger screens:

```tsx
// ✅ Mobile first
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

// ❌ Desktop first
<div className="grid grid-cols-4 sm:grid-cols-2 xs:grid-cols-1 gap-3">
```

### Touch targets

44×44px minimum on all interactive elements — enforced with `min-h-11 min-w-11`.

### Safe areas

```tsx
// Bottom nav
<nav className="pb-[env(safe-area-inset-bottom)]">

// Fixed footer on detail screens
<footer className="pb-[calc(env(safe-area-inset-bottom)+12px)]">

// Toast
<div className="bottom-[calc(64px+env(safe-area-inset-bottom)+8px)]">
```

---

## 11. Loading States

### Rules
- **Never use a full-page spinner.** Always skeleton the exact shape of the content.
- **Skeleton screens appear immediately** — no delay, no fade-in threshold.
- **Skeleton width is approximate, not exact.** Use `w-32`, `w-24`, `w-full` — not pixel-perfect.
- **Multiple skeletons** when a list is loading — show 3–5 skeleton items.

### Pattern per screen

| Screen | Skeleton |
|---|---|
| Dashboard | 4 stat card skeletons + 3 booking card skeletons |
| Bookings list | 5 booking card skeletons |
| Booking detail | Full-page skeleton matching the detail layout |
| Customers list | 5 customer row skeletons |
| Payments list | 4 transaction row skeletons |

---

## 12. Empty States

Centred vertically and horizontally in the content area. Never flush to the top.

```tsx
<div className="flex flex-col items-center justify-center py-16 px-8 text-center">
  <Icon size={48} className="text-text-disabled mb-4" strokeWidth={1.5} />
  <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
  <p className="text-base text-text-secondary mb-6 max-w-xs">{description}</p>
  {cta && <PrimaryButton>{cta}</PrimaryButton>}
</div>
```

| Screen | Icon | Title | Description | CTA |
|---|---|---|---|---|
| Dashboard (no bookings) | `CalendarX` | "No appointments today" | — | — |
| Bookings list | `Calendar` | "No bookings found" | "Customers book via WhatsApp" | "+ New Booking" |
| Customers | `Users` | "No customers yet" | "Customers appear after their first WhatsApp booking" | — |
| Payments | `CreditCard` | "No transactions" | "No payments in this period" | — |
| Customer history | `Clock` | "No past bookings" | — | — |
| Search (no results) | `SearchX` | "No results for '…'" | "Try a different name or phone number" | — |

---

## 13. Error States

### Full-screen error (page load failure)

```tsx
<div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
  <WifiOff size={48} className="text-text-disabled mb-4" />
  <h3 className="text-lg font-semibold text-text-primary mb-2">Couldn't load data</h3>
  <p className="text-base text-text-secondary mb-6">Check your connection and try again</p>
  <SecondaryButton onClick={refetch}>Retry</SecondaryButton>
</div>
```

### Inline error (form field)

```tsx
<p className="mt-1 text-xs text-error flex items-center gap-1">
  <AlertCircle size={12} />
  {error.message}
</p>
```

### Toast error (mutation failure)

```tsx
showToast({ type: "error", message: "Failed to approve booking. Try again." });
```

Rules:
- Never show raw API error codes to users.
- Never show stack traces or technical details.
- Always give the user a next action (Retry, Go back, Contact support).
- Offline errors show `WifiOff` icon — distinguish from server errors.

---

## 14. Iconography

Use **Lucide React** exclusively. No other icon libraries. No custom SVGs unless a required icon is genuinely missing from Lucide.

### Size conventions

| Context | Size | Stroke width |
|---|---|---|
| Navigation icons | 22px | 2 |
| Action button icons | 18px | 2 |
| Inline text icons | 16px | 2 |
| Empty state illustrations | 48px | 1.5 |
| Badge/chip icons | 12px | 2 |
| Stat card icons | 20px | 2 |

### Icon + text alignment

Always use `flex items-center gap-2` — never manual margin adjustments:

```tsx
// ✅
<span className="flex items-center gap-2 text-sm text-text-secondary">
  <Clock size={16} />
  2:00 PM
</span>

// ❌
<span><Clock size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> 2:00 PM</span>
```

### Standard icon assignments

| Icon | Usage |
|---|---|
| `Calendar` | Bookings, dates |
| `Clock` | Time, pending status |
| `CheckCircle` | Approved, confirmed |
| `XCircle` | Cancelled |
| `CreditCard` | Payments |
| `BadgeCheck` | Paid |
| `Users` | Customers |
| `Settings` | Settings |
| `ChevronRight` | Navigation, list items |
| `ChevronLeft` | Back navigation |
| `Plus` | Create actions |
| `RefreshCw` | Rescheduled, retry |
| `WifiOff` | Offline state |
| `AlertCircle` | Warning, error |
| `Star` | Completed |

---

## 15. Dos and Don'ts

### ✅ Do

- Read `UI_UX_SPECIFICATION.md` before implementing any screen.
- Use token classes — `bg-primary`, `text-text-secondary`, `border-border`.
- Skeleton every loading state to match content shape.
- Confirm every destructive action with a dialog.
- Test on a real mobile device or iOS Simulator before marking complete.
- Use `min-h-11` on every interactive element.
- Include `aria-label` on every icon-only button.
- Show WhatsApp link (`wa.me/254...`) on customer detail screens.
- Format all times in EAT 12-hour format ("2:00 PM").
- Format all amounts as "KES 1,500" (not "KES1500", not "1,500 KES").

### ❌ Don't

- Hardcode any colour (`#C084A8`, `gray-500`, `bg-pink-400`).
- Use `px` for font sizes.
- Show two primary buttons on the same screen.
- Add motion without checking `prefers-reduced-motion`.
- Show a blank white screen while loading.
- Use placeholder text as the only label on an input.
- Show raw error codes or stack traces to users.
- Put action buttons inline mid-page on detail screens — fix them to the footer.
- Use Tailwind's default `rounded-lg` — use `rounded-[--radius-lg]`.
- Use emoji as UI icons — use Lucide icons instead.
- Render lists without `key` props.
- Leave empty states blank — always explain why it's empty and what to do.
