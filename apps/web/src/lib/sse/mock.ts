// Simulates the SSE event stream described in frontend.md's useSSE hook.
// In the real backend this connects to `${VITE_API_URL}/events?token=...`.
// Here, a lightweight in-memory emitter periodically fires the same event
// names so the rest of the app (cache invalidation, badges, toasts) behaves
// identically to the production wiring.

export type SSEEventName =
  | "booking.created"
  | "booking.deleted"
  | "booking.approved"
  | "booking.cancelled"
  | "payment.completed"
  | "booking.rescheduled"
  | "notification.new";

export type Listener = () => void;

const listeners = new Map<SSEEventName, Set<Listener>>();

export function subscribe(event: SSEEventName, listener: Listener): () => void {
  // new event create storage for listeners 
  if (!listeners.has(event)) listeners.set(event, new Set());
  // existing event add listener to the listener collection
  listeners.get(event)!.add(listener);
  // clean up function for when the component unmounts(remoce old listeners)
  return () => listeners.get(event)?.delete(listener);
}

// trigger all listeners for a particular event(simulates server sending an event)
export function emit(event: SSEEventName) {
  listeners.get(event)?.forEach((l) => l());
}
