import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// Base configurável: no Vercel (site separado) use VITE_PWA_BASE=/ ; local/sub-path mantém '/campo-pwa/'.
const PWA_BASE = process.env.VITE_PWA_BASE ?? "/campo-pwa/";

export default defineConfig({
  base: PWA_BASE,
  server: {
    port: parseInt(process.env.PORT ?? "8082"),
    host: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@gestao/campo-core": path.resolve(__dirname, "../packages/campo-core/src/index.ts"),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.svg", "icons/*.png"],
      manifest: {
        name: "Campo NR-10",
        short_name: "Campo",
        description: "Coleta de inspeção elétrica em campo",
        theme_color: "#1e293b",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: PWA_BASE,
        scope: PWA_BASE,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      devOptions: {
        enabled: false,
      },
      workbox: {
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
});
