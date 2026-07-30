/**
 * Wanny's Nails — Service Worker
 *
 * Handles:
 *  - Push notification display and click handling
 *  - Push subscription change refresh
 *  - Basic offline fallback
 */

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import {offlineFallback} from "workbox-recipes"
import {registerRoute, NavigationRoute} from "workbox-routing"

// This tells TS this file runs in service worker context not DOM
declare let self: ServiceWorkerGlobalScope & {
  __VAPID_PUBLIC_KEY__: string;
  // __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Remove old pre-caches from previous service worker so storage doesn't grow unbounded across deploys
cleanupOutdatedCaches();
/* __________ Pre-caching __________ */
// __WB_MANIFEST replaced at build time by vite/workbox
// with real array of { url, revision } for every asset matched
// by injectManifest.globPatterns in vite.config.ts.
// You never populate this array yourself
precacheAndRoute(self.__WB_MANIFEST);

// new service worker claims existing clients
clientsClaim()

// serve the precatche index.html for any navigation request that isn;t already matched by a more specific route
const handler = createHandlerBoundToURL("/index.html")
const navigationRoute = new NavigationRoute(handler, {
  // Don't hijack navigations meant for real API/asset routes
  denylist: [/^\/api\//, /\.[a-z0-9]+$/i], // exclude /api/* and anything with a file extension
});
registerRoute(navigationRoute)

offlineFallback({
  pageFallback: "/offline.html"
})


// Fired once after service worker is registered and the browser has downloaded and parse it
// it will only be fire again when the service worker is updated

self.addEventListener("install", () => {
  // No self.skipWaiting() here. The new worker installs and
  // sits in "waiting" until the user explicitly triggers activation
  // via the SKIP_WAITING message.
});

// ─── Activate: clean old caches(avoid exceeding storage qoutas) ────────────────────────────────
self.addEventListener("activate", () => {
  // clientsClaim() lets this worker take control of already-open
  // tabs immediately after activation, without needing a hard reload
  // to "adopt" them. Combined with controllerchange + reload on the
  // client side, this is what makes the update feel instant once
  // the user clicks "Update now".
  // (new service worker)Take control of all clients immediately(triggers controllerchange event on navigator.serviceWorker on affected clients)
  // event.waitUntil();
  
});


// 4. USER-TRIGGERED UPDATE (the SKIP_WAITING message contract)(prompts user)
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();// activate immediately
  }
});

// ─── Push: display notification ────────────────────────────────
self.addEventListener("push", (event) => {
  if(!event.data) return

  const data = event.data.json() ?? {
    title: "Wanny's Nails",
    body: "You have a new notification.",
    icon: "/icons/192.png",
    data: { url: "/", notificationId: "" },
    tag: Date.now().toString(),
  };

  const options = {
    body: data.body,
    icon: data.icon || "/icons/192.png",
    badge: "/icons/192.png",
    data: data.data,
    tag: data.tag || `notification-${Date.now()}`,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    // Collapse duplicate notifications with the same tag
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});


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
          // Focus an already-open tab if one matches, instead of
      // always opening a new one
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
      .subscribe(
        event.oldSubscription?.options ?? {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            self.__VAPID_PUBLIC_KEY__,
          ),
        },
      )
      .then((newSubscription) => {
        // Send the old and new subscription to the server
        return fetch("/api/v1/push-subscriptions/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

// ─── Utility: URL-safe Base64 to Uint8Array ────────────────────

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ─── Utility: ArrayBuffer to Base64 

function arrayBufferToBase64(buffer: ArrayBuffer | null) {
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
