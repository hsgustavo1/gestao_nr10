import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";
import path from "node:path";

// Config Vite nativo — substitui @lovable.dev/vite-tanstack-config.
// Reproduz exatamente o que o wrapper do Lovable fazia, sem os plugins
// exclusivos do sandbox/HMR do Lovable (componentTagger, hmrGate,
// devServerBridge e os overlays de erro SSR/server-fn), que só têm efeito
// dentro do editor cloud deles e não são importados por nenhum código em src/.
export default defineConfig(({ command, mode }) => {
  // Injeção explícita de VITE_* em import.meta.env (idêntico ao wrapper).
  // O Vite já faz isso no bundle client; mantemos explícito para paridade
  // total, inclusive no contexto SSR/Cloudflare.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define,
    server: {
      host: "::",
      port: parseInt(process.env.PORT ?? '8081'),
    },
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
        "@gestao/campo-core": path.resolve(process.cwd(), "packages/campo-core/src/index.ts"),
      },
      // Deduplicação para evitar cópias duplicadas de React/TanStack.
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
      // Cloudflare apenas no build (gera o worker SSR). Mesma opção do wrapper.
      ...(command === "build"
        ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
        : []),
      tanstackStart({
        // Protege imports server-only de vazarem para o bundle client.
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
