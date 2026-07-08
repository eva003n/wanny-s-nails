/// <reference lib="webworker"/>

import api from "./lib/api";

declare let self: ServiceWorkerGlobalScope

/**
 * Wanny's Nails — Service Worker
 *
 * Handles:
 *  - Push notification display and click handling
 *  - Push subscription change refresh
 *  - Basic offline fallback
 */

const CACHE_NAME = "wannys-nails-v1";
const OFFLINE_URL = "/offline.html";

// ─── Install: cache offline fallback ───────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(OFFLINE_URL);
    }),
  );
  // Activate immediately — don't wait for existing pages to close
  self.skipWaiting();
});

// ─── Activate: clean old caches ────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
    }),
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ─── Push: display notification ────────────────────────────────

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {
    title: "Wanny's Nails",
    body: "You have a new notification.",
    icon: "/icons/icon-192.png",
    data: { url: "/", notificationId: "" },
    tag: Date.now().toString(),
  };

  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: data.data,
    tag: data.tag || `notification-${Date.now()}`,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    // Collapse duplicate notifications with the same tag
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));

  //  Attempt to resubscribe after receiving a notification
  // event.waitUntil(resubscribeToPush());
});

// resubscribe the user to push
// function resubscribeToPush() {
//   return self.registration.pushManager
//     .getSubscription()
//     .then(function (subscription) {
//       if (subscription) {
//         return subscription.unsubscribe();
//       }
//     })
//     .then(function () {
//       return self.registration.pushManager.subscribe({
//         userVisibleOnly: true,
//         applicationServerKey: urlBase64ToUint8Array(
//           import.meta.env.VITE_VAPID_PUBLIC_KEY,
//         ),
//       });
//     })
//     .then(function (subscription) {
//       if (import.meta.env.DEV) {
//         console.log("Resubscribed to push notifications:", subscription);
//       }

//       // send new subscription details to your server
//       const sub = subscription.toJSON();
//       api
//         .post("/push-subscriptions", {
//           endpoint: sub.endpoint,
//           p256dh: sub.keys?.p256dh ?? "",
//           auth: sub.keys?.auth ?? "",
//           userAgent: navigator.userAgent,
//         })
//         .then((response) => {
//           {
//             import.meta.env.DEV && console.log(response.data)
//           }
//         })
//     })
//     .catch(function (error) {
//     import.meta.env.DEV && console.error("Failed to resubscribe:", error);
//     });
// }

// ─── Notification Click: navigate to URL ───────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // If there's an existing window focused on the target, focus it
        for (const client of windowClients) {
          const clientUrl = new URL(client.url);
          const targetUrl = new URL(urlToOpen, self.location.origin);

          if (
            clientUrl.origin === targetUrl.origin &&
            clientUrl.pathname === targetUrl.pathname &&
            "focus" in client
          ) {
            return client.focus();
          }
        }

        // Otherwise open a new window/tab
          return self.clients.openWindow(urlToOpen);
      }),
  );
});

// ─── Push Subscription Change: notify the server ───────────────
//  event fires in a Service Worker whenever a push subscription is invalidated, expired, or refreshed outside of the application's direct control
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options ?? {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY,
        ),
      })
      .then((newSubscription) => {
        // Send the old and new subscription to the server
        return fetch("/api/v1/push-subscriptions/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription?.endpoint,
            newSubscription: {
              endpoint: newSubscription.endpoint,
              p256dh: arrayBufferToBase64(newSubscription.getKey("p256dh")),
              auth: arrayBufferToBase64(newSubscription.getKey("auth")),
            },
          }),
        });
      }),
  );
});

// ─── Fetch: offline fallback ───────────────────────────────────

self.addEventListener("fetch", (event) => {
  // Only handle navigation requests for offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      }),
    );
  }
});

// ─── Utility: URL-safe Base64 to Uint8Array ────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ─── Utility: ArrayBuffer to Base64 ───────────────────────────

function arrayBufferToBase64(buffer) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// VAPID public key placeholder (set at build/deploy time)
self.__VAPID_PUBLIC_KEY__ = "";