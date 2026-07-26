import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest", // need for custom push event handling
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: "Nails by Wanny",
        short_name: "Wanny Nails",
        description:
          "Booking management application purposely built for Nails by Wanny nail salon",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#C084A8",
        background_color: "#FAFAFA",
        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/icons/favicon/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/favicon/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/favicon/pwa-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/favicon/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        /**
         * Only 8 screenshots at max
         * Only jpeg and png
         * Same form-factor must have same aspect ratio
         * Width and height within 320px-3840px
         */

        screenshots: [
          {
            src: "/images/dashboard-mobile",
            sizes: "474x745",
            type: "image/png",
            form_factor: "narrow",
            label: "Mobile view of the dashboard in the booking app",
          },
          {
            src: "/images/bookingpage-mobile",
            sizes: "472x744",
            type: "image/png",
            form_factor: "narrow",
            label: "Mobile view of bookings in the booking app",
          },
        ],

        shortcuts: [
          {
            name: "Dashboard",
            url: "/dashboard",
          },
          {
            name: "Bookings",
            url: "/bookings",
          },
          {
            name: "Payments",
            url: "/payments",
          },
          {
            name: "Customers",
            url: "/customers",
          },
          {
            name: "Settings",
            url: "/settings",
          },
        ],
      },

      workbox: {
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) =>
              ["style", "script", "worker", "font"].includes(
                request.destination,
              ),
            handler: "CacheFirst",
            options: { cacheName: "static-assets" },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },

      devOptions: {
        enabled: true,
        navigateFallback: "index.html",
        suppressWarnings: true,
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
  },
});
