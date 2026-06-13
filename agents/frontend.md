# Frontend (PWA) Rules

## Styling
- **CSS custom properties only.** Use design tokens from `UI_UX_SPECIFICATION.md`. No hardcoded hex values or `px` sizes in components.
- **`rem` for all text.** Never `px` for font sizes — must respect browser font preferences.
- **44px minimum tap targets.** Every interactive element: `min-height: 44px; min-width: 44px`.
- **`safe-area-inset` on bottom UI.** Bottom nav and toast notifications must include `padding-bottom: env(safe-area-inset-bottom)` for iPhone home bar.

## Auth tokens
- Store JWT **access token in memory** (React context) — never `localStorage`.
- Store **refresh token in an `httpOnly` cookie** set by the API, not readable from JS.
- On 401 response: attempt silent refresh via `/auth/refresh`. If that fails, redirect to `/login`.

## Routing
- **Route-based modals.** Create Booking → `/bookings/new`, Reschedule → `/bookings/:id/reschedule`. Never model these as component-level boolean state. Browser back button and swipe-back must dismiss them correctly.
- Each tab is a top-level route: `/dashboard`, `/bookings`, `/customers`, `/payments`, `/settings`.

## Real-time (SSE)
- Open `EventSource('/api/v1/events')` when the dashboard mounts. Close it on unmount (`useEffect` cleanup).
- Events to handle: `booking.created`, `booking.approved`, `booking.cancelled`, `payment.completed`.
- On SSE disconnect: attempt reconnect every 5 seconds silently. Show a banner after 30 seconds.

## Service worker
- Never write to the Workbox cache from React code — Workbox manages it.
- Use `navigator.serviceWorker` only for Web Push subscription.
- Offline fallback: today's schedule is readable from cache. Write actions (approve, cancel) show a disabled state with tooltip when offline.

## PWA role-based UI
Hide OWNER-only UI elements by reading the `role` field from the decoded JWT in React context. Do not make a separate API call to check permissions.
