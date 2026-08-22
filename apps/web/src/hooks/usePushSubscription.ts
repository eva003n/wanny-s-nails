// src/hooks/usePushSubscription.ts
import api, { unwrap } from "@/lib/api";
import { useCallback } from "react";
import { useServiceWorkerContext } from "@/hooks/useServiceWorkerContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type PushStatus =
  | "unsupported"
  | "default"
  | "granted"
  | "denied"
  | "subscribed"
  | "unsubscribed";

interface SubscriptionInfo {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
}

const PUSH_SUBSCRIPTIONS_KEY = ["push-subscriptions"] as const;

function getInitialStatus(): PushStatus {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  if (!("PushManager" in window)) {
    return "unsupported";
  }
  return Notification.permission as PushStatus;
}

async function fetchSubscriptions(): Promise<SubscriptionInfo[]> {
  const res = await api.get("/push-subscriptions");
  const { data } = unwrap<SubscriptionInfo[]>(res);
  return data;
}

// subscribe user to push notifications
export function usePushSubscription() {
  const { registration, registrationError } = useServiceWorkerContext();
  const queryClient = useQueryClient();

  const browserStatus = getInitialStatus();

  // ── Server-side truth via TanStack Query ───────────────────────
  const {
    data: subscriptions = [],
    isLoading: initializing,
    isError: queryError,
  } = useQuery({
    queryKey: PUSH_SUBSCRIPTIONS_KEY,
    queryFn: fetchSubscriptions,
    enabled: browserStatus !== "unsupported",
    staleTime: 30_000,
    retry: 1,
  });

  const latestSubscription = subscriptions.length > 0 ? subscriptions[0] : null;
  const isSubscribed = subscriptions.length > 0;

  const status: PushStatus = (() => {
    if (browserStatus === "unsupported") return "unsupported";
    if (browserStatus === "denied") return "denied";
    if (isSubscribed) return "subscribed";
    if (browserStatus === "granted") return "unsubscribed";
    return browserStatus;
  })();

  // ── Subscribe mutation ─────────────────────────────────────────
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (registrationError) {
        throw new Error(
          registrationError.message || "Service worker registration failed",
        );
      }

      if (!registration) {
        throw new Error("Service worker not ready yet. Try again.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // Permission denied — no need to throw, just bail
        return null;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY,
        ),
      });

      const sub = subscription.toJSON();

      await api.post("/push-subscriptions", {
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh ?? "",
        auth: sub.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });

      return true;
    },
    onSuccess: (result) => {
      if (result !== null) {
        queryClient.invalidateQueries({ queryKey: PUSH_SUBSCRIPTIONS_KEY });
      }
    },
  });

  // ── Unsubscribe mutation ───────────────────────────────────────
  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const subscription = await registration?.pushManager.getSubscription();

      if (!subscription) {
        // Nothing to unsubscribe from locally — server may still have it
        // Invalidate to sync
        return;
      }

      const endpoint = subscription.endpoint;

      await api.delete("/push-subscriptions/unsubscribe", {
        data: { endpoint },
      });

      await subscription.unsubscribe();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PUSH_SUBSCRIPTIONS_KEY });
    },
  });

  const subscribe = useCallback(() => {
    subscribeMutation.mutate();
  }, [subscribeMutation]);

  const unSubscribe = useCallback(() => {
    unsubscribeMutation.mutate();
  }, [unsubscribeMutation]);

  const loading = subscribeMutation.isPending || unsubscribeMutation.isPending;
  const error =
    subscribeMutation.error?.message ??
    unsubscribeMutation.error?.message ??
    (queryError ? "Failed to check subscription status" : null) ??
    null;

  return {
    status,
    loading,
    initializing,
    error,
    isSubscribed,
    subscriptionInfo: latestSubscription,
    subscribe,
    unSubscribe,
  };
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))).buffer;
}