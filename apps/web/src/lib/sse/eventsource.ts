import type { SSEEventName, Listener } from "./mock";

let eventSource: EventSource | null = null;

export function connect(
  setBannerVisible: (vistble: boolean) => void,
){
  if (eventSource) return undefined;

  eventSource = new EventSource(
    `${import.meta.env.VITE_API_URL}/events`,
    {
      withCredentials: true, // send with auth token in cookie
    },
  );

  eventSource.onopen = () => {
    setBannerVisible(false);
  };

  eventSource.onerror = () => {
    setBannerVisible(true);
    // close previous connection
    // eventSource?.close();

  // reconnects automatically via server sent retry field
  };
}

export function disconnect() {
  eventSource?.close();
  eventSource = null;
}

export function subscribe(event: SSEEventName, listener: Listener) {
  if (!eventSource) {
    throw "SSE not connected";
  }
  eventSource.addEventListener(event, listener);

  return () => {
    eventSource?.removeEventListener(event, listener);
  };
}
