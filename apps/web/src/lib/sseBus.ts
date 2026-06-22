// Simulates the SSE event stream described in frontend.md's useSSE hook.
// In the real backend this connects to `${VITE_API_URL}/events?token=...`.
// Here, a lightweight in-memory emitter periodically fires the same event
// names so the rest of the app (cache invalidation, badges, toasts) behaves
// identically to the production wiring.

export type SSEEventName =
  | "booking.created"
  | "booking.approved"
  | "booking.cancelled"
  | "payment.completed"
  | "booking.rescheduled";

type Listener = () => void;

const listeners = new Map<SSEEventName, Set<Listener>>();

export function subscribeSSE(event: SSEEventName, listener: Listener): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(listener);
  return () => listeners.get(event)?.delete(listener);
}

export function emitSSE(event: SSEEventName) {
  listeners.get(event)?.forEach((l) => l());
}
