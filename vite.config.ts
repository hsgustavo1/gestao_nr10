/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define,
    test: {
      // campo-pwa tem vitest próprio (campo-pwa/vitest.config.ts) com alias e
      // fake-indexeddb; o runner da raiz não deve varrer aquele pacote.
      exclude: ["**/node_modules/**", "**/dist/**", "campo-pwa/**"],
    },
    server: {
      host: "::",
      port: 57010,
      strictPort: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
        "@gestao/campo-core": path.resolve(process.cwd(), "packages/campo-core/src/index.ts"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      viteReact(),
    ],
  };
});
