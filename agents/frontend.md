# Frontend (PWA) Rules

## Table of Contents
1. [Project Structure](#1-project-structure)
2. [Styling](#2-styling)
3. [Component Rules](#3-component-rules)
4. [State Management](#4-state-management)
5. [Data Fetching & API](#5-data-fetching--api)
6. [Runtime Validation](#6-runtime-validation)
7. [Auth & Tokens](#7-auth--tokens)
8. [Routing](#8-routing)
9. [Real-time (SSE)](#9-real-time-sse)
10. [Forms](#10-forms)
11. [Error Handling](#11-error-handling)
12. [Performance](#12-performance)
13. [Accessibility](#13-accessibility)
14. [Service Worker & PWA](#14-service-worker--pwa)
15. [Security](#15-security)
16. [Build, Environments & Config](#16-build-environments--config)
17. [Observability](#17-observability)
18. [Internationalization](#18-internationalization)
19. [Browser Support](#19-browser-support)
20. [Testing](#20-testing)

---

## 1. Project Structure
```
# apps/web/src/

src/
├── main.tsx              # Entry point
├── App.tsx               # Router + providers
├── PWABadge.tsx          # "Update available" prompt
├── index.css             # Global styles + CSS tokens
│
├── components/
│   ├── layout/           # App shell, nav, guards, offline banner
│   └── ui/               # Dumb reusable components (no API calls)
│
├── pages/                # Feature modules
│   ├── dashboard/        #   page + hooks
│   ├── bookings/         #   page + hooks + feature components
│   ├── payments/         #   page + hooks
│   ├── customers/        #   page + hooks
│   ├── settings/         #   page + hooks + sections
│   └── admin/            #   page + hooks
│
├── hooks/                # Global hooks (online status, SSE, shared)
├── lib/                  # Pure utils (api, auth, formats, schemas, IndexedDB)
├── store/                # Zustand (auth state, UI/toasts)
└── types/                # Shared TS types
```

**Rules:**
- Page components are route entry points only — no business logic inside them.
- Business logic lives in hooks. Components only call hooks and render.
- Never import from a sibling page's folder. Shared code goes in `components/` or `hooks/`.
- One component per file. File name matches the exported component name exactly.

---

## 2. Styling

### Tailwind v4 + CSS custom properties

Use **Tailwind v4 utility classes** for layout and spacing. Use **CSS custom property tokens** for colours, shadows, and radii. Tokens are defined in `UI_UX_SPECIFICATION.md` and registered in `index.css` via Tailwind's `@theme` directive.

```css
/* index.css */
@import "tailwindcss";

@theme {
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

  --shadow-card:  0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-raised: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-modal: 0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05);

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}
```

### Rules

```tsx
// ✅ Correct
<div className="flex flex-col gap-4 p-4 bg-surface rounded-[--radius-md] shadow-[--shadow-card]">
  <p className="text-text-secondary text-sm">Supporting text</p>
  <button className="bg-primary text-white min-h-11 rounded-[--radius-lg]">
    Approve
  </button>
</div>

// ❌ Never — hardcoded values
<div style={{ backgroundColor: '#C084A8' }}>
<div className="bg-pink-400">
<div className="text-gray-500">
<div className="border-gray-200">
<p style={{ fontSize: '14px' }}>    // px for font sizes
```

### Typography

Use `rem` for all font sizes. Never `px`. Reference Tailwind's text scale (`text-sm`, `text-base`, `text-lg`, etc.) which outputs `rem` by default.

```tsx
// ✅
<h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
<p className="text-sm text-text-secondary">Last updated 2 min ago</p>

// ❌
<h1 style={{ fontSize: '32px' }}>Dashboard</h1>
```

### Tap targets

Every interactive element must meet the 44×44px minimum:

```tsx
// ✅
<button className="min-h-11 min-w-11 px-4">Approve</button>
<a className="min-h-11 flex items-center px-3">Link</a>

// ❌ — too small, inaccessible on mobile
<button className="h-8 px-2">X</button>
```

### Safe area insets

Bottom nav and toast notifications must account for iPhone home bar:

```tsx
// Bottom nav
<nav className="fixed bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] bg-surface border-t border-border">

// Toast container
<div className="fixed bottom-4 left-4 right-4 pb-[env(safe-area-inset-bottom)]">
```

### Elevation / shadows

```tsx
// ✅
<div className="shadow-[--shadow-card]">     // cards
<div className="shadow-[--shadow-raised]">   // dropdowns, popovers
<div className="shadow-[--shadow-modal]">    // modals, bottom sheets
```

---

## 3. Component Rules

### Structure of every component

```tsx
// BookingCard.tsx
import type { Booking } from "@/types";

// 1. Types at the top
interface BookingCardProps {
  booking: Booking;
  onApprove: (id: string) => void;
}

// 2. One default export, named to match the file
export default function BookingCard({ booking, onApprove }: BookingCardProps) {
  // 3. Hooks first
  // 4. Derived state / computed values
  // 5. Handlers
  // 6. Return JSX
}
```

### Rules
- **No business logic in components.** If a handler does more than call a hook function, extract it to a hook.
- **No direct API calls in components.** All data fetching goes through TanStack Query hooks.
- **No `useEffect` for data fetching.** Use TanStack Query. `useEffect` is for: SSE connections, scroll listeners, focus management, and third-party integrations only.
- **Props interfaces** always explicitly typed — never `any`, never inlined object types for non-trivial shapes.
- **Early returns** for loading and error states before the main render:

```tsx
export default function BookingDetailPage() {
  const { data: booking, isLoading, error } = useBooking(id);

  if (isLoading) return <BookingDetailSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!booking) return <NotFound />;

  // happy path — no nested conditionals needed
  return <BookingDetail booking={booking} />;
}
```

### Shared UI primitives

Always use components from `components/ui/` for:
`Button`, `Badge`, `Card`, `Input`, `Select`, `Toast`, `Dialog`, `BottomSheet`, `Skeleton`, `EmptyState`, `ErrorState`

Never re-implement these inline. If a variant is missing, extend the existing component.

---

## 4. State Management

### What goes where

| State type | Where |
|---|---|
| Server data (bookings, customers, payments) | TanStack Query cache |
| Auth (access token, user, role) | Zustand `auth.store.ts` |
| UI state (toast queue, sidebar open) | Zustand `ui.store.ts` |
| Form state | React Hook Form (local to the form component) |
| Ephemeral UI (dropdown open, hover) | `useState` (local) |

### Rules

- **Arrays always initialised as `[]`** — never `undefined` for collections.
- **Objects always initialised as valid object or `null`** — never `undefined`.
- **Never store derived data in state.** Compute it from existing state/query data:

```tsx
// ✅ Derived — compute from query data
const pendingCount = bookings?.filter(b => b.status === "PENDING").length ?? 0;

// ❌ Redundant state
const [pendingCount, setPendingCount] = useState(0);
```

- **Never put server data in Zustand.** TanStack Query owns all server state. Zustand is for client-only state.

### Zustand store pattern

```typescript
// store/auth.store.ts
import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;      // in memory only — never localStorage
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true }),

  clearAuth: () =>
    set({ user: null, accessToken: null, isAuthenticated: false }),
}));
```

---

## 5. Data Fetching & API

### Axios instance

```typescript
// lib/api.ts
import axios from "axios";
import { useAuthStore } from "@/store/auth.store";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,   // sends httpOnly refresh token cookie
  headers: { "Content-Type": "application/json" },
});

// Attach access token from Zustand on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Silent refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await api.post("/auth/refresh");
        useAuthStore.getState().setAuth(
          useAuthStore.getState().user!,
          data.data.accessToken,
        );
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
```

### API versioning

- The API base URL includes an explicit version segment (e.g. `VITE_API_URL=https://api.example.com/v1`). Never assume backwards compatibility across versions.
- If the backend returns a `Deprecation` or `Sunset` header, log it once per session and surface a non-blocking toast pointing to the changelog — never silently ignore it.
- Breaking API changes are handled behind a feature flag (see below) so the frontend can roll forward independently of the backend deploy.

### Feature flags

- Feature flags are read from a single typed source (`lib/flags.ts`), backed by the API or a config service — never scattered `if (import.meta.env.VITE_SOME_FLAG)` checks across components.
- Flags gate UI, not data shape. Schemas in `lib/schemas.ts` must handle both flag states (e.g. an optional field) rather than branching validation logic.

### TanStack Query hooks pattern

```typescript
// pages/bookings/hooks/useBookings.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { validateOrThrow, BookingListSchema, BookingSchema } from "@/lib";

export const bookingKeys = {
  all: ["bookings"] as const,
  list: (filters: BookingFilters) => ["bookings", "list", filters] as const,
  detail: (id: string) => ["bookings", "detail", id] as const,
};

export function useBookings(filters: BookingFilters) {
  return useQuery({
    queryKey: bookingKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get("/bookings", { params: filters });
      return validateOrThrow(BookingListSchema, data.data, "GET /bookings");
    },
    staleTime: 30_000,
  });
}

export function useApproveBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data } = await api.post(`/bookings/${bookingId}/approve`);
      return validateOrThrow(BookingSchema, data.data, "POST /bookings/:id/approve");
    },
    onSuccess: (updatedBooking) => {
      // Update the detail cache immediately
      queryClient.setQueryData(
        bookingKeys.detail(updatedBooking.id),
        updatedBooking,
      );
      // Invalidate list so it refetches
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
}
```

### Rules
- Every query has an explicit `queryKey` using the key factory pattern above.
- Every mutation invalidates or updates the relevant query cache on success.
- `staleTime` must be set explicitly — never rely on the default `0` for data that doesn't change every second.
- Never call `api.*` directly inside a component — always through a hook.

---

## 6. Runtime Validation

### Where validation lives
lib/

schemas.ts     # All Zod schemas — one per API resource

guards.ts      # validateOrThrow helper + type guards

### `validateOrThrow`

```typescript
// lib/guards.ts
import { z, type ZodType } from "zod";

export function validateOrThrow<T>(
  schema: ZodType<T>,
  data: unknown,
  label: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Fail loud in development
    if (import.meta.env.DEV) {
      console.error(`[validateOrThrow] ${label} failed:`, result.error.issues);
      throw new Error(`Runtime validation failed: ${label}`);
    }
    // In production: log to Sentry and return a safe fallback
    // (add Sentry.captureException here — see §17 Observability)
    throw new Error(`Data shape error: ${label}`);
  }
  return result.data;
}
```

### Rules

- **Every API response** passes through `validateOrThrow` before entering React state or the Query cache.
- **Every URL param** read via `useParams()` is validated before use.
- **Schemas live in `lib/schemas.ts`** — never define schemas inline in components or hooks.
- **Types are inferred from schemas** — never write duplicate TypeScript interfaces for data that already has a Zod schema:

```typescript
// lib/schemas.ts
export const BookingSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  status: z.enum(["PENDING", "APPROVED", "CANCELLED", "COMPLETED", "NO_SHOW", "RESCHEDULED"]),
  paymentStatus: z.enum(["UNPAID", "PAYMENT_PENDING", "PAID", "PAYMENT_FAILED", "REFUNDED"]),
  appointmentAt: z.string().datetime(),
  priceKes: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  customer: z.object({ id: z.string(), name: z.string(), phone: z.string() }),
  service: z.object({ id: z.string(), name: z.string() }),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const BookingListSchema = z.array(BookingSchema);

// ✅ Type inferred from schema — single source of truth
export type Booking = z.infer<typeof BookingSchema>;

// ❌ Never — duplicate interface that can drift out of sync
interface Booking {
  id: string;
  reference: string;
  ...
}
```

- **No defensive guards in render code.** Fix the type at the boundary:

```tsx
// ✅ Validated at entry — safe to use directly
bookings.map(b => <BookingCard key={b.id} booking={b} />)

// ❌ Defensive guard that signals broken validation upstream
Array.isArray(bookings) && bookings.map(...)
bookings?.map(...)   // only acceptable for nullable fields defined as such in schema
```

---

## 7. Auth & Tokens

- **Access token:** stored in Zustand memory only — never `localStorage`, never `sessionStorage`.
- **Refresh token:** `httpOnly` `Secure` `SameSite=Strict` cookie set by the API — never readable from JS.
- **Silent refresh:** handled automatically by the Axios response interceptor in `lib/api.ts`. Never implement manual token refresh logic in components.
- **Role-based UI:** read `role` from `useAuthStore()`. Never make a separate API call to check permissions. Never show OWNER-only UI to STAFF:

```tsx
// ✅
const { user } = useAuthStore();
{user?.role === "OWNER" && <DeleteButton />}

// ❌ — extra API call, race condition risk
const { data: permissions } = usePermissions();
```

- **Client-side role checks are UX only, not a security boundary.** The API must independently enforce authorization on every endpoint — the frontend hiding a button is never the only thing standing between STAFF and an OWNER-only action.
- **Logout:** call `clearAuth()` on the store + redirect to `/login`. The `httpOnly` cookie is cleared by the API response to `POST /auth/logout`.
- **Multi-tab logout:** broadcast logout across tabs via a `BroadcastChannel` (or `storage` event on a non-sensitive sentinel key) so that logging out in one tab clears auth state in all open tabs.

---

## 8. Routing

### Route structure
/login                          public

/dashboard                      protected

/bookings                       protected

/bookings/new                   protected — modal over /bookings

/bookings/:id                   protected

/bookings/:id/reschedule        protected — modal over /bookings/:id

/customers                      protected

/customers/:id                  protected

/payments                       protected

/payments/:id                   protected

/settings                       protected — OWNER only

/settings/services              protected — OWNER only

/settings/team                  protected — OWNER only

### Rules

- **Route-based modals** — `/bookings/new`, `/bookings/:id/reschedule` are real routes rendered as bottom sheets/modals over the parent route. Never use component boolean state for modals that have their own URL. Browser back button and swipe-back dismiss them automatically.
- **Protected routes** wrapped in a single `<ProtectedRoute>` layout component that checks `isAuthenticated` from the auth store.
- **Params validated immediately:**

```tsx
// ✅
const { id } = useParams<{ id: string }>();
if (!id) throw new Error("Missing booking ID");   // caught by error boundary
```

---

## 9. Real-time (SSE)

```typescript
// hooks/useSSE.ts
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { bookingKeys } from "@/pages/bookings/hooks/useBookings";

export function useSSE() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!accessToken) return;

    const connect = () => {
      const es = new EventSource(
        `${import.meta.env.VITE_API_URL}/events?token=${accessToken}`,
      );
      esRef.current = es;

      es.addEventListener("booking.created", () => {
        queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      });

      es.addEventListener("booking.approved", () => {
        queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      });

      es.addEventListener("booking.cancelled", () => {
        queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      });

      es.addEventListener("payment.completed", () => {
        queryClient.invalidateQueries({ queryKey: ["payments"] });
        queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      });

      es.onerror = () => {
        es.close();
        // Silent reconnect after 5s
        reconnectTimer.current = setTimeout(connect, 5_000);
        // Show banner after 30s of failed reconnects
        bannerTimer.current = setTimeout(() => {
          // dispatch to ui.store: showSSEBanner = true
        }, 30_000);
      };

      es.onopen = () => {
        clearTimeout(bannerTimer.current);
        // dispatch to ui.store: showSSEBanner = false
      };
    };

    connect();

    return () => {
      esRef.current?.close();
      clearTimeout(reconnectTimer.current);
      clearTimeout(bannerTimer.current);
    };
  }, [accessToken, queryClient]);
}
```

**Rules:**
- `useSSE` is called once, in `DashboardPage` only.
- SSE events **invalidate TanStack Query cache** — they never write directly to Zustand or component state.
- Always clean up `EventSource` and timers in the `useEffect` return function.
- The browser tab limits concurrent `EventSource` connections per origin (6 in most browsers). Never open a second `EventSource` elsewhere in the app — all real-time concerns route through this single connection and fan out via query invalidation.
- When the tab is backgrounded (`document.visibilityState === "hidden"`), do not force-close the connection — let the browser/OS manage it — but on `visibilitychange` back to `"visible"`, proactively call `refetch()` on the dashboard's primary queries in case events were missed while suspended.

---

## 10. Forms

Use **React Hook Form + Zod resolver** for all forms.

```typescript
// pages/bookings/components/CreateBookingForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const CreateBookingSchema = z.object({
  customerId: z.string().uuid("Select a customer"),
  serviceId: z.string().uuid("Select a service"),
  appointmentAt: z.string().datetime("Select a valid date and time"),
  notes: z.string().max(500).optional(),
});

type CreateBookingData = z.infer<typeof CreateBookingSchema>;

export default function CreateBookingForm({ onSuccess }: { onSuccess: () => void }) {
  const { mutate: createBooking, isPending } = useCreateBooking();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBookingData>({
    resolver: zodResolver(CreateBookingSchema),
  });

  const onSubmit = (data: CreateBookingData) => {
    createBooking(data, { onSuccess });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* fields */}
    </form>
  );
}
```

**Rules:**
- Form schema defined in the form file (not `lib/schemas.ts` — form schemas include UI-specific messages).
- `noValidate` on `<form>` — disable browser native validation, use RHF/Zod.
- Never use `useState` to track form field values — React Hook Form manages them.
- Show field errors inline below the input, not in a toast.
- Disable the submit button (`disabled={isPending}`) and show a loading state on it during submission — never allow a double-submit by leaving the button clickable.

---

## 11. Error Handling

### Three levels

| Level | Tool | What it catches |
|---|---|---|
| Route level | `<ErrorBoundary>` per route | Render errors, thrown validation errors |
| Query level | `error` from `useQuery` | Network errors, API errors |
| Mutation level | `onError` in `useMutation` | Failed writes |

### Pattern

```tsx
// Queries — show inline error state
const { data, error, refetch } = useBookings(filters);
if (error) return <ErrorState message={error.message} onRetry={refetch} />;

// Mutations — show toast on error
const { mutate } = useApproveBooking({
  onError: (error) => {
    showToast({ type: "error", message: "Failed to approve booking. Try again." });
  },
});
```

### Rules
- **Never swallow errors silently.** Every catch block either shows a toast, renders an error state, or re-throws.
- **Network errors show a toast.** Render errors are caught by `<ErrorBoundary>`.
- **Error messages shown to users** are plain English, never raw API error codes or stack traces.
- **`validateOrThrow` failures in production** are reported to Sentry and show a generic error state — never expose schema details to the user.
- **Every uncaught error reported to Sentry includes**: the route, the user's role (never PII beyond that), and a request ID if the failing call was a network request — see §17 Observability for the required breadcrumb/context setup.

---

## 12. Performance

### Rules
- **Lazy load all pages** with `React.lazy` + `<Suspense>`:

```tsx
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
```

- **Images** use `loading="lazy"` and explicit `width`/`height` to prevent layout shift.
- **Lists over 50 items** use virtual scrolling (`@tanstack/react-virtual`).
- **Expensive computations** wrapped in `useMemo`. Dependency arrays must be exact — no missing or unnecessary deps.
- **Callbacks passed as props** wrapped in `useCallback` only if the child is wrapped in `React.memo`. Don't over-memoize.
- **Query `staleTime`** tuned per resource:

| Resource | staleTime |
|---|---|
| Dashboard stats | 30s |
| Booking list | 30s |
| Booking detail | 60s |
| Services | 5 min |
| Customers | 60s |

### Bundle budgets

- Initial JS payload (everything loaded before first interaction) must stay under **200KB gzipped**. CI fails the build if this is exceeded.
- Run `vite-bundle-visualizer` (or equivalent) before merging any PR that adds a new dependency over 20KB gzipped.
- Lighthouse CI runs on every PR against a fixed set of routes (`/login`, `/dashboard`, `/bookings`). Minimum scores to merge: **Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, PWA ✅ installable**.
- Core Web Vitals targets (measured on a throttled mid-tier Android profile, matching the primary user base): **LCP < 2.5s, INP < 200ms, CLS < 0.1**.

---

## 13. Accessibility

- Every interactive element has an `aria-label` when the visible label is absent or ambiguous.
- Status badges use `aria-label` with full text — not just colour/icon:

```tsx
<span
  className="bg-warning-bg text-warning rounded-[--radius-sm] px-2 py-1 text-xs"
  aria-label="Status: Pending approval"
>
  Pending
</span>
```

- Focus visible ring on all interactive elements:

```css
/* index.css */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

- All modals and bottom sheets trap focus and return focus to the trigger on close.
- `prefers-reduced-motion` — wrap all transitions:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- All `<img>` elements have descriptive `alt` text. Decorative images use `alt=""`.
- Skip-to-content link at the top of the app for keyboard users.
- Form inputs always have an associated `<label>` — never use `placeholder` as the only label.
- Minimum colour contrast: **4.5:1 for body text, 3:1 for large text (≥24px) and icons** — verified against the token palette in §2, not assumed.
- Toasts and SSE reconnect banners use `aria-live="polite"`; do not use `role="alert"` for non-critical, non-blocking updates — reserve `role="alert"` for failed mutations the user must act on.

---

## 14. Service Worker & PWA

### Manifest

Every deploy ships a `manifest.webmanifest` with, at minimum:

```json
{
  "name": "Wanny's Nails",
  "short_name": "Wanny's",
  "description": "Booking, customer, and payment management.",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FAFAFA",
  "theme_color": "#C084A8",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- `start_url` points to the most useful authenticated screen, not `/`, so a returning installed-app launch doesn't bounce through a redirect.
- Maskable icon required — Android adaptive icon shapes will clip a non-maskable icon.
- `theme_color` matches `--color-primary` from §2 — never drifts out of sync with the design tokens.

### Service worker registration & caching strategy

Use `vite-plugin-pwa` (Workbox under the hood). Configure per-resource caching strategy explicitly — never accept the default catch-all:

```typescript
// vite.config.ts
VitePWA({
  registerType: "prompt",      // never "autoUpdate" — see update rule below
  workbox: {
    runtimeCaching: [
      {
        // API calls: always try network first, fall back to cache when offline
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkFirst",
        options: { cacheName: "api-cache", networkTimeoutSeconds: 5 },
      },
      {
        // Static assets: cache-first, they're content-hashed by the build
        urlPattern: ({ request }) => ["style", "script", "font"].includes(request.destination),
        handler: "CacheFirst",
        options: { cacheName: "static-assets" },
      },
      {
        // Images: stale-while-revalidate — show cached instantly, refresh in background
        urlPattern: ({ request }) => request.destination === "image",
        handler: "StaleWhileRevalidate",
        options: { cacheName: "images", expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 } },
      },
    ],
  },
});
```

### Update flow

- `registerType: "prompt"` — **never** silently auto-update and reload underneath the user. A booking owner mid-action must not lose state to an unannounced reload.
- On `onNeedRefresh`, dispatch to `ui.store`: show a non-dismissible-but-deferrable banner: *"Update available — tap to reload."* Reload only on explicit tap (`updateSW(true)`).
- On `onOfflineReady`, show a one-time, dismissible toast confirming the app works offline — shown once per install, not every load (track via a flag in IndexedDB, not localStorage — see §7 on storage discipline).

### Installability

- Intercept `beforeinstallprompt`, store the event, and surface a custom "Install app" affordance in `Settings` rather than relying on the browser's native mini-infobar — owners installing this as their primary work tool benefit from a deliberate, branded prompt.
- Never prompt for install on first visit. Trigger the custom install affordance only after the user has completed at least one meaningful action (e.g. viewed the dashboard twice, or approved a booking) — this materially improves install acceptance rate and avoids training users to dismiss prompts reflexively.
- iOS Safari has no `beforeinstallprompt`. Detect iOS Safari and show static "Add to Home Screen" instructions instead of a fake install button.

### Offline behaviour

- **Offline detection:** `navigator.onLine` + `online`/`offline` events, exposed through `useOnline()` (below).
- **Read paths:** TanStack Query's persisted cache (via `@tanstack/query-sync-storage-persister` backed by IndexedDB, not localStorage) serves last-known-good data offline. Stale-while-offline data is visually marked — a small "showing cached data" tag — never presented as live.
- **Write actions while offline** (approve, cancel, reschedule): the button is disabled with a tooltip — *"No connection — try again when online."* This app does **not** implement an offline write queue/background sync for v1; if that requirement changes, it must be scoped as its own RFC (conflict resolution, idempotency keys, and replay-ordering all need design before implementation) — do not bolt on optimistic offline writes without that design.
- **Push notifications:** subscription registration happens through `navigator.serviceWorker.ready.pushManager.subscribe(...)`, gated behind an explicit in-app permission primer (never the bare browser permission prompt on load — that pattern has near-zero opt-in and burns the one-shot permission request). Push payloads are validated with a dedicated Zod schema before being used to construct a notification, same as any other untrusted input.

```typescript
// hooks/useOnline.ts
import { useState, useEffect } from "react";

export function useOnline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  return isOnline;
}
```

### Rules
- **Never write to the Workbox cache from React.** Workbox manages cache strategy automatically.
- **`navigator.serviceWorker`** used only for Web Push subscription registration and the update-prompt flow above.
- Cache version bumps automatically on every deploy via Workbox's content-hash precaching — never manually manage a cache name/version string in application code.

---

## 15. Security

- **Content Security Policy:** served via response header (not `<meta>` tag) by the hosting layer, minimum: `default-src 'self'; connect-src 'self' <API origin> <SSE origin>; img-src 'self' data: <CDN origin>; script-src 'self'; style-src 'self' 'unsafe-inline'` (the `style-src unsafe-inline` is a Tailwind/CSS-in-JS concession — tighten with nonces if a future build supports it). No inline `<script>` tags anywhere in `index.html`.
- **No `dangerouslySetInnerHTML`** unless the content has passed through a sanitizer (e.g. DOMPurify) immediately before render, with the sanitizer call colocated with the render — never sanitize "upstream and trust it later."
- **No `eval`, `new Function()`, or dynamic `import()` of a URL built from user input.**
- **CSRF:** since refresh tokens are `httpOnly`/`SameSite=Strict` cookies (§7), CSRF risk is already substantially mitigated; state-changing requests (`POST`/`PATCH`/`DELETE`) still require the `Authorization: Bearer` header to succeed, which a cross-site form post cannot forge.
- **Dependency hygiene:** `npm audit` (or equivalent) runs in CI on every PR; builds fail on new **high/critical** advisories. Renovate/Dependabot kept on auto-merge for patch-level security updates only.
- **No secrets in client bundles.** Anything under `import.meta.env.VITE_*` is public by definition — never put an API key with write/billing scope there. Server-only secrets stay server-only.
- **Source maps:** generated on every production build for error-tracking (§17), but uploaded directly to the error-tracking provider and **not** publicly served alongside the deployed bundle.

---

## 16. Build, Environments & Config

- **Environment files:** `.env.development`, `.env.staging`, `.env.production` — never a single `.env` shared across environments, and never committed to the repo (each is provided by the deploy pipeline; `.env.example` is committed with placeholder values and is the only source of truth for "which variables exist").
- **Every `import.meta.env.VITE_*` variable** referenced in code must have a corresponding entry in `.env.example` — CI greps for drift between the two.
- **No environment-conditional business logic** (`if (import.meta.env.MODE === "production")` deciding what a booking flow does) — environment variables configure *endpoints and flags*, never *behaviour branches*. Behaviour differences belong behind the feature-flag system in §5.
- **Build provenance:** every production build is tagged with the git SHA (injected via `VITE_BUILD_SHA` at build time) and surfaced in a hidden `Settings` debug panel — this is the first thing support asks for when triaging a bug report.

---

## 17. Observability

- **Error tracking (Sentry or equivalent):** initialised once in `main.tsx`, before the app renders. Every release upload includes the source maps from §15 and is tagged with the build SHA from §16.
- **Breadcrumbs:** route changes, mutation attempts (name only, never payload contents), and SSE connect/disconnect events are recorded as breadcrumbs automatically — this is what makes a stack trace useful six steps into a flow instead of useless.
- **User context attached to error reports:** user ID and role only. Never name, phone, email, or any field that appears in `CustomerSchema`/`BookingSchema` — this is a salon booking app handling real client PII, and error reports are not an exemption from that.
- **Performance monitoring:** Core Web Vitals (§12) are sent to the same provider as error tracking, segmented by route, so a regression on `/bookings` doesn't hide inside an aggregate app-wide number.
- **Logging in code:** no `console.log` left in committed code outside of the explicit `import.meta.env.DEV` branches already established in §6's `validateOrThrow`. ESLint rule `no-console` enforced with `warn`/`error` allowed.

---

## 18. Internationalization

- All user-facing strings go through an i18n catalog (`locales/en.json` at minimum) from day one, even for a single-locale launch — retrofitting i18n into components that interpolate strings inline is far more expensive than starting clean.
- **Never concatenate translated strings.** Use ICU message format placeholders for variables and pluralization (`"{count, plural, one {1 booking} other {{count} bookings}}"`), since word order and pluralization rules differ across locales.
- **Dates, times, and currency** are already centralized per §2/§12's design-token approach — extend that centralization to use `Intl.DateTimeFormat` / `Intl.NumberFormat` with the active locale, never a hand-rolled formatter, so a future locale addition doesn't require hunting down every date string in the codebase.
- **KES currency formatting** (`Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" })` or equivalent) lives in one shared `formatCurrency` helper — never inlined `KES ${amount}` string templates scattered across components.

---

## 19. Browser Support

- **Target matrix:** last 2 versions of Chrome, Safari, and Firefox; current Safari and Chrome on iOS/Android. No IE11, no legacy Edge.
- Evegry feature relying on a newer Web API (`EventSource`, `env(safe-area-inset-bottom)`, `BroadcastChannel` from §7, the Push API from §14) is checked against this matrix before use — if a target browser lacks support, the feature degrades gracefully (e.g. SSE reconnect banner still renders correctly; a missing `BroadcastChannel` simply means multi-tab logout sync is skipped, not a crash).
- Polyfills are not bundled by default. If a target browser genuinely lacks a required API, add the polyfill explicitly and note why in a code comment — never reach for a blanket `core-js` import "just in case."

---

## 20. Testing

### What to test

| Type | Tool | What |
|---|---|---|
| Unit | Vitest | Pure functions, Zod schemas, `validateOrThrow`, utility hooks |
| Component | React Testing Library | User interactions, conditional rendering, form submission |
| Integration | RTL + MSW | Full page flows with mocked API |
| End-to-end | Playwright | Critical paths only: login → approve booking → see it reflected; install prompt flow; offline-then-online recovery |

### Rules

- Test **behaviour, not implementation.** Query by role/label, not by class name or component internals.
- **Never test component state directly.** Test what the user sees.
- **Mock at the network layer** using MSW — never mock modules like `axios` or `api.ts`.
- Every `useMutation` success and error path has a test.
- Snapshot tests are **banned** — they catch nothing useful and break constantly.
- **CI gate:** PRs cannot merge below **80% line coverage** on `lib/` and `hooks/` (the highest-leverage, least-UI-noisy code); component coverage is not gated by percentage but every page must have at least one RTL test covering its primary happy path and its error state.
- **PWA-specific E2E coverage:** at least one Playwright test asserts the manifest is valid and installable (`page.evaluate` checking `window.matchMedia('(display-mode: standalone)')` support is present, or using Playwright's Lighthouse integration), and one test simulates `context.setOffline(true)` to verify cached reads still render and write actions correctly disable.

```tsx
// ✅ Tests user behaviour
it("approves a booking when the owner clicks Approve", async () => {
  render(<BookingDetailPage />);
  await userEvent.click(screen.getByRole("button", { name: /approve booking/i }));
  await userEvent.click(screen.getByRole("button", { name: /approve/i })); // confirm dialog
  expect(await screen.findByText("Confirmed")).toBeInTheDocument();
});

// ❌ Tests implementation
it("sets isLoading to true", () => {
  const { result } = renderHook(() => useApproveBooking());
  expect(result.current.isPending).toBe(false);
});
```

### File naming
- Component tests: `BookingCard.test.tsx` colocated with `BookingCard.tsx`
- Hook tests: `useBookings.test.ts` colocated with `useBookings.ts`
- Schema tests: `schemas.test.ts` in `lib/`
- E2E tests: `e2e/<flow-name>.spec.ts` at the repo root, separate from the `apps/web/src` tree since they exercise the deployed build, not source.