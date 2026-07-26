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

      // configurations for the generated manifest file
      manifest: {
        id: "/",
        name: "Wanny's Nails",
        short_name: "Wannys Nails",
        description:
          "Booking management for Nails by Wanny salon — appointments, payments, and customers in one place.\n\nThe app can be installed to the home screen of your mobile device or desktop ",
        display: "standalone",
        // display_override: ["window-controls-overlay"],
        orientation: "portrait",
        theme_color: "#C084A8",
        background_color: "#FAFAFA",
        lang: "en-KE",
        categories: ["business", "lifestyle"],
        start_url: "/",
        scope: "/",
        launch_handler: {
          client_mode: "focus-existing",
        },
        handle_links: "preferred",
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
            src: "/images/screenshots/mobile/dashboard-758x1583.png",
            sizes: "758x1584",
            type: "image/png",
            form_factor: "narrow",
            label: "Mobile view of the dashboard in the booking management app",
          },
          {
            src: "/images/screenshots/desktop/dashboard-2880x1584.png",
            sizes: "2880x1584",
            type: "image/png",
            form_factor: "wide",
            label: "Desktop view of dashboard in the booking management app",
          },
        ],

        shortcuts: [
          {
            name: "Dashboard",
            url: "/dashboard",
            icons: [
              {
                src: "/icons/shortcuts/layout-dashboard-96x96.png",
                sizes: "96x96",
                type: "image/png",
              },
            ],
          },
          {
            name: "Bookings",
            url: "/bookings",
            icons: [
              {
                src: "/icons/shortcuts/calendar-96x96.png",
                sizes: "96x96",
                type: "image/png",
              },
            ],
          },
          {
            name: "Payments",
            url: "/payments",
            icons: [
              {
                src: "/icons/shortcuts/credit-card-96x96.png",
                sizes: "96x96",
                type: "image/png",
              },
            ],
          },
          {
            name: "Customers",
            url: "/customers",
            icons: [
              {
                src: "/icons/shortcuts/users-96x96.png",
                sizes: "96x96",
                type: "image/png",
              },
            ],
          },
          {
            name: "Settings",
            url: "/settings",
            icons: [
              {
                src: "/icons/shortcuts/settings-96x96.png",
                sizes: "96x96",
                type: "image/png",
              },
            ],
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
