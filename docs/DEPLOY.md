# Deploy

## Campo PWA → Vercel (site separado) — ATIVO

O PWA (`campo-pwa/`) é um SPA Vite estático e está pronto para virar um site
Vercel independente. Configs já no repo: [`campo-pwa/vercel.json`](../campo-pwa/vercel.json)
e base configurável em [`campo-pwa/vite.config.ts`](../campo-pwa/vite.config.ts).

### Passos manuais (na sua conta Vercel)
1. **New Project** → importar este repositório do GitHub.
2. **Root Directory:** `campo-pwa` (Settings → General → Root Directory).
3. **Framework Preset:** Vite (deve detectar automaticamente).
   - Build Command: `npm run build` · Output: `dist` (já no `vercel.json`).
4. **Environment Variables** (Settings → Environment Variables):
   - `VITE_SUPABASE_URL` = URL do seu projeto Supabase
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = chave pública (anon)
   - `VITE_PWA_BASE` = `/`  ← essencial: faz o PWA rodar na raiz do domínio
     próprio (sem isso ele assume `/campo-pwa/` do setup local).
5. **Deploy.** A URL pública gerada já permite instalar o PWA no celular e testar
   coleta offline + sync, sem depender de localhost.

> Observação: o build roda `tsc -b && vite build`. Mantenha o `campo-pwa` sem
> erros de TypeScript, senão o deploy falha (o CI em `.github/workflows/ci.yml`
> já protege isso a cada push).

## App principal (TanStack Start) → decisão adiada

O app está configurado para **Cloudflare** (plugin `@cloudflare/vite-plugin` gera
um Worker SSR no build — ver [`vite.config.ts`](../vite.config.ts)). Por isso ele
**não** foi apontado para o Vercel agora. Quando for decidir:

- **Opção A — manter na Cloudflare:** caminho de menor atrito (já configurado).
  Deploy via Cloudflare Pages/Workers conectando o repo (raiz).
- **Opção B — migrar para Vercel:** trocar o alvo de build do TanStack Start para
  o preset Vercel e remover/condicionar o plugin Cloudflare. Requer 1 iteração de
  teste no deploy real. Detalhado no `ROADMAP.md`.

Em ambos os casos, as mesmas env vars do Supabase do `.env.example` se aplicam.
