# DESIGN.md — Wanny's Nails PWA
## Design System, Tokens & Product Guidelines v2.0

---

## 0. North Star

Build a tool that feels like it was made by Apple for a Kenyan salon owner — not a startup trying to impress investors, and not a generic SaaS dashboard skinned with pastel colors. Every screen must pass the "one-thumb, mid-service" test: a stylist with gloves on and a client in the chair should be able to complete any critical action in under 3 taps.

**Three words this product must feel:** Fast. Trustworthy. Mine.

---

## 1. Design Philosophy

### 1.1 Competitive Benchmarks

| Benchmark | What We Steal |
|---|---|
| Apple Wallet | Card stacks, bottom sheets, haptic confirmation patterns |
| Stripe Mobile Dashboard | Information density, financial data hierarchy |
| iOS Clock / Reminders | Native input patterns, list row anatomy |
| WhatsApp Business | Speed, practical communication flow |

### 1.2 Core Alignment Matrix

| Prioritize | Strictly Avoid |
|---|---|
| Single-column, single-thumb execution | Any multi-column grid on mobile |
| High density with breathing room at section breaks | Low-contrast "airy" Dribbble aesthetics |
| Sophisticated, understated feminine editorial tone | Cutesy icons, playful gradients, neon |
| 44–56px touch targets on every interactive element | Tiny inline links, checkbox-heavy forms |
| Flat premium surfaces with precise micro-shadows | Heavy drop shadows, aggressive blurs |
| Kenyan currency, locale, and naming conventions | Generic Western placeholders (USD, "John Doe") |
| Skeleton loading, optimistic UI | Blank screens, full-page spinners |

---

## 2. Design Tokens

### 2.1 Color System

All colors must pass **WCAG AA** for their intended text/background pairing. Never use color as the sole indicator of state — always pair with an icon, label, or shape change.

#### Base Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-canvas` | `#FAF7F2` | App background, page canvas |
| `--color-surface` | `#FFFFFF` | Cards, modals, input fields |
| `--color-surface-raised` | `#F5F2ED` | Nested cards, tray backgrounds |
| `--color-border` | `#E5E5E5` | Hairline dividers, card outlines |
| `--color-border-strong` | `#C9C9C9` | Active input borders, focused states |

#### Brand Accent

| Token | Hex | Usage |
|---|---|---|
| `--color-accent` | `#B76E79` | Rose Gold — active tab, CTAs, selection state |
| `--color-accent-light` | `#F5E6E8` | Accent tint for badge backgrounds, hover fills |
| `--color-accent-dark` | `#8E4F58` | Pressed states, high-contrast accent text |

#### Typography

| Token | Hex | Usage |
|---|---|---|
| `--color-text-primary` | `#1C1C1E` | Headers, body, primary data |
| `--color-text-secondary` | `#636366` | Captions, labels, metadata |
| `--color-text-tertiary` | `#AEAEB2` | Placeholder text, disabled states |
| `--color-text-inverse` | `#FFFFFF` | Text on dark/accent surfaces |

#### Semantic States

| Token | Hex | Light Tint (badge bg) | Usage |
|---|---|---|---|
| `--color-success` | `#34C759` | `#E6F9EC` | Confirmed, paid, completed |
| `--color-warning` | `#FF9F0A` | `#FFF3E0` | Pending, action required |
| `--color-error` | `#FF3B30` | `#FFEEED` | Cancelled, failed, overdue |
| `--color-info` | `#007AFF` | `#E5F1FF` | Informational notices |

#### Usage Rules

```
Text on --color-canvas    → --color-text-primary    ✓ (contrast 13.2:1)
Text on --color-accent    → --color-text-inverse     ✓ (contrast 4.8:1)
Caption on --color-surface → --color-text-secondary  ✓ (contrast 5.9:1)
```

---

### 2.2 Typography

Use the native iOS/macOS system font stack. No web font downloads — this preserves rendering fidelity, offline resilience, and 0 font load latency.

```css
font-family: -apple-system, "SF Pro Text", "SF Pro Display",
             "Helvetica Neue", Arial, sans-serif;
```

#### Type Scale

| Role | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `--type-display` | 34px | 700 Bold | 41px | -0.5px | Greeting, hero number |
| `--type-h1` | 28px | 700 Bold | 34px | -0.3px | Page titles |
| `--type-h2` | 20px | 600 SemiBold | 24px | -0.2px | Section headers, card titles |
| `--type-h3` | 17px | 600 SemiBold | 22px | -0.1px | Row titles, modal headers |
| `--type-body` | 16px | 400 Regular | 22px | 0px | Client names, service names |
| `--type-body-medium` | 16px | 500 Medium | 22px | 0px | Emphasized body, amounts |
| `--type-caption` | 13px | 400 Regular | 18px | 0.1px | Timestamps, metadata |
| `--type-caption-medium` | 13px | 500 Medium | 18px | 0.1px | Status labels, badge text |
| `--type-micro` | 11px | 500 Medium | 14px | 0.5px | Tab bar labels |

**Rules:**
- Never go below 13px for any readable text.
- Never use font-weight below 400 (no thin/ultralight weights — unreadable under salon lighting).
- Monetary amounts always use `--type-body-medium` or heavier. KES amounts should always be prefixed `KES` with a non-breaking space: `KES 18,500`.
- Use `font-variant-numeric: tabular-nums` on all numeric data to prevent layout shifts.

---

### 2.3 Spacing Scale

All layout decisions derive from this 8pt base grid. Never use arbitrary pixel values outside this scale.

```
--space-2:   2px   // Micro: icon-to-label tight coupling
--space-4:   4px   // XS: badge internal padding, icon micro-gap  
--space-8:   8px   // SM: label-to-input gap, internal card row gap
--space-12:  12px  // MD-: compact list rows
--space-16:  16px  // MD: standard page margins, card inner padding
--space-20:  20px  // MD+: form field vertical gap
--space-24:  24px  // LG: inter-card spacing, section gap
--space-32:  32px  // XL: major section isolation
--space-48:  48px  // XXL: bottom nav + safe area clearance buffer
```

**Page margin rule:** `--space-16` left/right on all screens. Never reduce below this.

---

### 2.4 Elevation & Shadow

Shadows simulate native iOS layer depth. Never use heavy drop shadows.

```css
/* Cards sitting on canvas */
--shadow-card:    0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);

/* Modals, bottom sheets */
--shadow-sheet:   0 -2px 20px rgba(0,0,0,0.08);

/* Floating action elements */
--shadow-float:   0 4px 16px rgba(0,0,0,0.10);

/* Pressed/inset state */
--shadow-inset:   inset 0 1px 3px rgba(0,0,0,0.06);
```

---

### 2.5 Border Radius

```
--radius-sm:   8px   // Badges, chips, small inputs
--radius-md:   12px  // Cards, standard modals
--radius-lg:   16px  // Large cards, bottom sheets
--radius-xl:   20px  // Hero cards, appointment ribbon cards
--radius-full: 9999px // Pills, avatar circles, toggle tracks
```

---

### 2.6 Motion & Animation

Keep animations sub-250ms. Never block user interaction for animation.

```
--duration-instant:  100ms  // Pressed state feedback
--duration-fast:     150ms  // Tab switch, badge update
--duration-standard: 220ms  // Modal open, card expand
--duration-slow:     300ms  // Bottom sheet slide-up (max allowed)

--ease-out:  cubic-bezier(0.25, 0.46, 0.45, 0.94)  // Default for entrances
--ease-in:   cubic-bezier(0.55, 0.06, 0.68, 0.19)  // Exits
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)   // One-time use: success confirmation only
```

**Prohibited:** Bouncy multi-axis transitions, looping pulse animations on data, slow fades over 300ms, rotation/flip card effects.

**Preferred motion patterns:**
- Modals/sheets: `translateY(100%) → translateY(0)` with `--ease-out`
- Cards on load: `opacity 0 → 1` + `translateY(8px) → 0`
- Tab switch: instant icon/label color change, 150ms underline/fill
- Button press: `scale(0.97)` at `--duration-instant`

---

## 3. Layout System

### 3.1 Global Structural Rules

```
Max content width:  480px (centered on wider viewports)
Page left/right:    --space-16 padding
```

```css
/* iOS Safe Area injection — required on all screens */
.page {
  padding-top: env(safe-area-inset-top);
  padding-bottom: calc(env(safe-area-inset-bottom) + 72px); /* 72px = bottom nav height */
}
```

**Touch target law:** Every tappable element must be at minimum `44px` tall. Preferred height for primary list rows and buttons: `52px–56px`. Form inputs: `48px`.

**Scroll rule:** Only one scrollable axis per screen. Horizontal scroll is permitted only inside the appointment ribbon (section 4.2). Never have two nested scroll containers.

### 3.2 Card Anatomy

Cards are the universal container. All cards share:

```
Background:  --color-surface
Border:      1px solid --color-border
Radius:      --radius-md (12px) or --radius-lg (16px) for hero cards
Shadow:      --shadow-card
Padding:     --space-16 all sides
```

**Card variants:**

| Variant | Radius | Shadow | Use |
|---|---|---|---|
| Standard | 12px | `--shadow-card` | List groups, info blocks |
| Hero | 16px | `--shadow-card` | Financial pulse, Action Center |
| Appointment (ribbon) | 20px | `--shadow-card` | Horizontal scroll ribbon |
| Modal Sheet | 20px top-only | `--shadow-sheet` | Bottom sheet modals |

**Card group rule:** When stacking multiple cards in the same section, use `--space-12` gap between them and `--space-24` between section groups.

---

## 4. Screen Architecture

### 4.1 Home — The 4-Question Dashboard

The landing screen answers four operational questions before the owner has finished reading the greeting:

1. **What needs my attention right now?** → Action Center
2. **Who am I seeing today?** → Schedule Ribbon
3. **How is money moving?** → Financial Pulse
4. **Who is trying to reach me?** → Communications

```
┌─────────────────────────────────────┐
│ [safe-area-top]                     │
│                                     │
│  Good morning, Amina  ·  Tue 16 Jun │  ← H1 + caption date (--type-h1, --type-caption)
│                                     │
│ ╔═══════════════════════════════╗   │
│ ║  ACTION CENTER                ║   │  ← Hero card (--radius-lg)
│ ║  ─────────────────────────    ║   │
│ ║  ⚠  3 Pending Bookings        ║   │  ← Warning icon + --color-warning
│ ║  💳 2 Unpaid Appointments     ║   │
│ ║  ─────────────────────────    ║   │
│ ║  🔴 1 Client Waiting In-Salon ║   │  ← Live/urgent — red dot pulse (1 loop only)
│ ╚═══════════════════════════════╝   │
│                                     │
│  TODAY'S SCHEDULE                   │  ← --type-caption-medium uppercase section label
│  ← ─────────────────────────── →   │  ← Horizontal scroll, no scrollbar visible
│  ┌────────────┐  ┌────────────┐     │
│  │ 9:00 AM    │  │ 10:30 AM   │     │
│  │ Gel Polish │  │ Acrylics   │     │
│  │ Jane W.    │  │ Sarah N.   │     │
│  │ ✅ Paid    │  │ ⚠ Unpaid  │     │
│  └────────────┘  └────────────┘     │
│                                     │
│ ╔═══════════════════════════════╗   │
│ ║  FINANCIAL PULSE              ║   │
│ ║  KES 18,500   Today's Revenue ║   │  ← --type-display for the amount
│ ║  ▲ 15% vs yesterday           ║   │
│ ║  ─────────────────────────    ║   │
│ ║  ⚠ KES 4,200 pending          ║   │
│ ╚═══════════════════════════════╝   │
│                                     │
│ ╔═══════════════════════════════╗   │
│ ║  💬 4 Unread Messages         ║   │
│ ║                  Open WhatsApp→║   │
│ ╚═══════════════════════════════╝   │
│                                     │
│ [bottom nav]                        │
│ [safe-area-bottom]                  │
└─────────────────────────────────────┘
```

**Section label treatment:**
```
font-size: 13px (--type-caption-medium)
font-weight: 500
letter-spacing: 0.6px
text-transform: uppercase
color: --color-text-secondary
margin-bottom: --space-8
```

---

### 4.2 Appointment Card (Ribbon)

Used in the horizontal scroll ribbon on Home and as a list row in the Bookings screen.

```
┌───────────────────────────┐
│ 9:00 AM          [Confirmed] │  ← time (body-medium) + status pill (right-aligned)
│ Jane Wanjiku                 │  ← client name (body regular)
│ Gel Polish · Amina           │  ← service · technician (caption muted)
│ KES 1,500                    │  ← amount (body-medium, right side)
└───────────────────────────┘
```

**Ribbon card dimensions:** `min-width: 200px`, `max-width: 220px`, height: auto (min 104px). Snap to nearest card on scroll: `scroll-snap-type: x mandatory`.

#### Status Badge Specification

| State | Background | Text Color | Icon | Label |
|---|---|---|---|---|
| Confirmed | `--color-success` light `#E6F9EC` | `#1A7A38` | ✓ | Confirmed |
| Pending | `--color-warning` light `#FFF3E0` | `#7A4A00` | ⏳ | Pending |
| Completed | `#F2F2F7` | `#636366` | — | Done |
| Cancelled | `--color-error` light `#FFEEED` | `#8A1A1A` | ✗ | Cancelled |
| In Progress | `#E5F1FF` | `#003F8A` | ● | In Salon |

Badge anatomy:
```
padding: 3px 10px
border-radius: --radius-full
font: --type-caption-medium
```

---

## 5. Navigation

### 5.1 Bottom Tab Bar

```
┌─────────────────────────────────────────┐
│  🏠        📅        💳       👥       ⚙️  │
│ Dashboard    Bookings  Payments Clients  Settings│
└─────────────────────────────────────────┘
```

```css
.tab-bar {
  position: fixed;
  bottom: 0;
  width: 100%;
  height: 72px;
  padding-bottom: env(safe-area-inset-bottom);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid var(--color-border);
}
```

**Active state:** Icon + label tint to `--color-accent`. Transition: `color 150ms --ease-out`. No animated underlines or sliding pills — instant color swap only.

**Tab icon sizes:** 24×24px SVG, 1.5px stroke weight, rounded line caps.

**Labels:** `--type-micro` (11px, 500 weight). Always visible — never hide labels to save space.

---

### 5.2 Screen Header

Each screen (except Home) uses a consistent header:

```
┌─────────────────────────────┐
│  [safe-area-top]            │
│  < Back    [Screen Title]   + │  ← back chevron (left) + primary action (right)
└─────────────────────────────┘
```

```
Height: 44px (navigation bar) + safe area
Title: --type-h3, centered
Back: "‹ Back" — --type-body, --color-accent
Primary action: text button or icon in --color-accent
```

---

## 6. Form System

### 6.1 Input Anatomy

```
[Label — always above input]
┌─────────────────────────────┐
│  placeholder / value        │  ← 48px min-height
└─────────────────────────────┘
[Inline error message if invalid]
```

```css
.form-input {
  height: 48px;
  padding: 0 var(--space-16);
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);        /* 8px */
  font-size: 16px;                        /* Prevents iOS auto-zoom */
  transition: border-color 150ms ease-out;
}
.form-input:focus {
  border-color: var(--color-accent);
  outline: none;
}
.form-input.error {
  border-color: var(--color-error);
}
```

**Label:**
```
font: --type-caption-medium
color: --color-text-secondary
margin-bottom: --space-4
```

**Error message:**
```
font: --type-caption
color: --color-error
margin-top: --space-4
```

**Never:** Clear field content on validation error. Never use placeholder text as the only label.

### 6.2 Keyboard Triggers

| Field Type | Attribute |
|---|---|
| Phone number | `inputmode="tel"` |
| Amount / KES | `inputmode="decimal"` |
| Date | Native `<input type="date">` or rolling picker sheet |
| Time | Native `<input type="time">` or time scroll wheel |
| Client search | `inputmode="search"` `autocomplete="off"` |

### 6.3 Primary Button

```css
.btn-primary {
  width: 100%;
  height: 52px;
  background: var(--color-accent);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: none;
  transition: transform 100ms ease-out, opacity 100ms ease-out;
}
.btn-primary:active {
  transform: scale(0.97);
  opacity: 0.88;
}
.btn-primary:disabled {
  background: var(--color-border);
  color: var(--color-text-tertiary);
  pointer-events: none;
}
```

**Loading state:** Replace label text with a single inline spinner (16px, white). Lock `pointer-events: none` to prevent double-submit.

### 6.4 Secondary / Destructive Buttons

| Variant | Background | Border | Text |
|---|---|---|---|
| Secondary | `--color-surface` | `1.5px --color-border` | `--color-text-primary` |
| Destructive | `#FFEEED` | `1.5px #FF3B30` | `#FF3B30` |
| Ghost | transparent | none | `--color-accent` |

---

## 7. System States

### 7.1 Loading — Skeletons

Every list row and card must have a skeleton counterpart. Skeletons use static fills (no shimmer animation — too distracting in a busy salon).

```css
.skeleton {
  background: #EBEBEB;
  border-radius: var(--radius-sm);
  /* Static — no animation */
}
```

Skeleton blocks should match the exact height and width of the content they replace. Do not use generic grey rectangles that don't match the layout.

### 7.2 Empty States

Every screen with a list must have an empty state.

```
         [ monochrome icon — 48×48px ]
         
         No appointments today
         
         Your schedule is clear. Book a client
         to get started.
         
         [ Book Appointment ] ← --btn-primary, full width
```

Rules:
- Icon: monochrome, line-style, 48px, `--color-text-tertiary`
- Heading: `--type-h3`, `--color-text-primary`
- Body: `--type-body`, `--color-text-secondary`, max 2 lines
- CTA always present and actionable

### 7.3 Error States

```
         [ ! icon — red, 48px ]
         
         Couldn't load your schedule
         
         Check your connection and try again.
         
         [ Try Again ] ← --btn-primary
```

Errors explain what happened in plain terms. Never say "An error occurred" with no path forward.

### 7.4 Toast Notifications

Non-blocking feedback anchored above the bottom nav.

```
┌─────────────────────────────┐
│  ✓  Booking confirmed       │  ← success
└─────────────────────────────┘
```

```
Position: fixed, bottom: 84px (above nav), centered, max-width: calc(100% - 32px)
Background: #1C1C1E (dark), text: white
Border-radius: --radius-md
Padding: 12px 16px
Font: --type-body-medium
Auto-dismiss: 3000ms
Animation: slide up from bottom 220ms, fade out 200ms
```

---

## 8. Data Display Conventions

### 8.1 Currency

- Always prefix: `KES` with a non-breaking space (`&nbsp;` or `\u00A0`)
- Always use comma-separated thousands: `KES 18,500` not `KES 18500`
- Amounts at rest: `--type-body-medium`
- Hero revenue figures: `--type-display` (34px bold)
- Negative / deductions: `--color-error` tint
- `font-variant-numeric: tabular-nums` on all monetary values

### 8.2 Timestamps & Dates

- Time: 12-hour format — `9:00 AM`, `2:30 PM` (no leading zero)
- Date: `Tue, 16 Jun` for short form; `Tuesday, 16 June 2026` for full form
- Relative time (for recent activity): `2 min ago`, `Just now`, `Yesterday`

### 8.3 Client Names

Display full names: first + last. Never truncate with an ellipsis inside a card. If a name would overflow (rare), reduce font to `--type-caption-medium` before truncating.

---

## 9. PWA Configuration

### 9.1 Manifest

```json
{
  "name": "Wannys Nails",
  "short_name": "Wanny's",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FAF7F2",
  "theme_color": "#FAF7F2",
  "start_url": "/",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 9.2 Viewport & Browser Behavior

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
```

Block pull-to-refresh on scroll containers where it would conflict:
```css
.scroll-container {
  overscroll-behavior-y: contain;
}
```

### 9.3 Service Worker Caching Strategy

| Resource | Strategy |
|---|---|
| App shell (HTML, CSS, JS) | Cache-first with background revalidation |
| API data (bookings, payments) | Network-first, fallback to stale cache |
| Static assets (icons, fonts) | Cache-first, long TTL |
| Client photos / avatars | Stale-while-revalidate |

Offline state: Serve cached shell with a non-intrusive offline banner at the top: `"You're offline — showing last synced data"`.

---

## 10. Accessibility

- All interactive elements: `role`, `aria-label`, or visible label. Never icon-only buttons without an `aria-label`.
- Color contrast: minimum AA on all text. Test `--color-text-secondary` (#636366) on `--color-surface` (#FFF) — passes at 5.9:1.
- Focus indicators: `outline: 2px solid var(--color-accent); outline-offset: 2px` on all focusable elements. Never `outline: none` without a replacement.
- VoiceOver: Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<section>`) — no `div` soup.
- Reduced motion: wrap all non-essential animations in `@media (prefers-reduced-motion: no-preference)`.
- Minimum touch target: 44×44px. Use padding to extend tap area without affecting visual size.

---

## 11. Design Anti-Patterns (Never Do)

| Anti-Pattern | Why |
|---|---|
| Removing field labels on focus | User loses context mid-input |
| Auto-clearing inputs on error | Forces re-entry, causes frustration |
| Gradient backgrounds | Feels cheap, reduces text legibility |
| Looping shimmer skeletons | Distracting in a busy work environment |
| Multi-column layouts on mobile | Breaks single-thumb operation |
| Bouncy / spring animations on data | Undermines professionalism |
| Spinner replacing entire screen | Breaks perceived continuity |
| KES amounts without comma separators | Misread at a glance |
| Toast banners that require dismissal | Blocks content, interrupts workflow |
| "An error occurred. Please try again." | Tells user nothing useful |

---

*End of DESIGN.md v2.0*
