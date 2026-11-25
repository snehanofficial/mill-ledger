import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const backendUrl = env.VITE_BACKEND_URL?.trim();
  if (!backendUrl) {
    throw new Error("Missing required environment variable: VITE_BACKEND_URL");
  }
  const appUrl = env.VITE_APP_URL?.trim();
  if (!appUrl) {
    throw new Error("Missing required environment variable: VITE_APP_URL");
  }
  const normalizedBackendUrl = backendUrl.replace(/\/+$/, "");

  return {
    plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      manifest: {
        id: "/",
        name: "MillLedger ERP",
        short_name: "MillLedger",
        description: "Order-to-Audit System for a Small Food Manufacturer",
        theme_color: "#176b54",
        background_color: "#fcfdfc",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Do not cache private API responses
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => !url.pathname.startsWith("/api"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-resources",
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: true,
    proxy: {
      "/api": {
        target: normalizedBackendUrl,
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react-router") ||
            id.includes("/node_modules/react-is/")
          ) {
            return "vendor-react";
          }
          if (id.includes("/node_modules/@tanstack/react-query/")) {
            return "vendor-query";
          }
          if (id.includes("/node_modules/lucide-react/")) {
            return "vendor-icons";
          }
          if (id.includes("/node_modules/dexie/")) {
            return "vendor-dexie";
          }
          if (
            id.includes("/node_modules/@radix-ui/") ||
            id.includes("/node_modules/cmdk/")
          ) {
            return "vendor-ui";
          }
        },
      },
    },
  },
  };
});
