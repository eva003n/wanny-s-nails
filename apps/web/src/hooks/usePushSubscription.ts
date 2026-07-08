// src/hooks/usePushSubscription.ts
import api from "@/lib/api";
import { useState, useCallback } from "react";
import { useServiceWorkerContext } from "@/hooks/useServiceWorkerContext";

type PushStatus =
  | "unsupported"
  | "default"
  | "granted"
  | "denied"
  | "subscribed";

// subscribe user to push notifications
export function usePushSubscription() {
  const { registration, registrationError } = useServiceWorkerContext();

  // check browser supports push notifications
  const [status, setStatus] = useState<PushStatus>(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return "unsupported";
    }
    if (!("PushManager" in window)) {
      return "unsupported";
    }
    return Notification.permission as PushStatus;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // If SW registration failed, bail immediately
      if (registrationError) {
        throw new Error(
          registrationError.message || "Service worker registration failed",
        );
      }

      // If registration hasn't completed yet, bail
      if (!registration) {
        throw new Error("Service worker not ready yet. Try again.");
      }

      // ask user for permission to send then push notifications
      const permission = await Notification.requestPermission();
      setStatus(permission as PushStatus);

      if (permission !== "granted") {
        setLoading(false);
        return;
      }
// sub scribe user on current user agent to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // no silent push
        applicationServerKey: urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY, // identifies the app server messaging the user
        ),
      });

      const sub = subscription.toJSON();
      await api.post("/push-subscriptions", {
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh ?? "",
        auth: sub.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });

      setStatus("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed");
    } finally {
      setLoading(false);
    }
  }, [registration, registrationError]);

  return { status, loading, error, subscribe };
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))).buffer;
}

