# ROADMAP — gestão_nr10 (handoff entre sessões)

> Documento de continuidade. Permite retomar o trabalho numa nova sessão de IA
> sem o contexto desta. Última atualização: 2026-06-14.

## Visão de produto (por que existe)

Software de gestão de NR-10 para escalar e comercializar. Cinco dimensões de uso,
todas sustentadas por **uma** base técnica (multi-tenancy + papéis + entitlements):

| Dimensão | Modelagem |
|---|---|
| Dono do app | `platform_admins` — acesso cross-tenant |
| Empresa c/ unidades | org `cliente` + filhas `unidade` (`parent_org_id`); mãe vê filhas |
| Consultor (revendedor) | org `consultoria` que gerencia clientes (`managed_by_org_id`) |
| Empresa de manutenção (só PWA) | org com entitlement só `rti_pwa` |
| Vitrine sem login | `org_public_tokens` + endpoint server-side só-conformes (futuro) |

**1º cliente comercial:** o consultor mapeado, fazendo RTI com PWA. Por isso a
camada de revenda entra já no MVP.

## Decisões já tomadas (não reabrir sem motivo)

1. Multi-tenancy **agora**, antes de dados de 2+ clientes coexistirem (evita
   migração ao vivo + risco LGPD). Migração é **aditiva/não-destrutiva**.
2. Isolamento real é no **banco (RLS)**, não no front. Front é conveniência.
3. Seam de autorização = funções `SECURITY DEFINER` (padrão já existente
   `has_role`/`is_staff`), agora com `can_access_org` / `org_role_at_least`.
4. Deploy: **PWA no Vercel** já; **app fica na Cloudflare** (decisão de migrar
   para Vercel adiada — ver fim deste doc).
5. Storage de fotos: Supabase Storage com path `{org_id}/…` (isolamento +
   migração futura para storage frio sem retrabalho).

## Estado atual (o que já foi entregue nesta sessão)

✅ **Higiene (Fase 0):** `.env` removido do versionamento + `.gitignore` + `.env.example`
   ([`.env.example`](../../../.env.example)); CI em [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)
   (lint+test+build do app, build do PWA).
   ⚠️ O `.env` ficou no **histórico** do git → **rotacionar as chaves do Supabase**.

✅ **Deploy PWA (Fase 0.5):** [`campo-pwa/vercel.json`](../../../campo-pwa/vercel.json),
   base configurável via `VITE_PWA_BASE`. Build do PWA verificado (passou).
   Instruções: [`docs/DEPLOY.md`](../../DEPLOY.md). **Passo manual:** conectar Vercel.

✅ **Migração da fundação (Fase 1.1–1.4):**
   [`supabase/migrations/20260614000000_multitenancy_foundation.sql`](../../../supabase/migrations/20260614000000_multitenancy_foundation.sql).
   Idempotente, não-destrutiva. **Passo manual:** aplicar no SQL Editor do Supabase.

✅ **Contexto de org no frontend (Fase 1.5 — núcleo):**
   [`src/lib/auth-context.tsx`](../../../src/lib/auth-context.tsx) estendido com
   `orgs`, `currentOrg`, `setCurrentOrg`, `isPlatformAdmin`, `entitlements`,
   `orgRole`, `hasEntitlement`, `hasOrgRole` — **degradação graciosa** (se a
   migração ainda não foi aplicada, segue com papéis legados, sem quebrar).
   Seletor de org no header ([`src/components/site-header.tsx`](../../../src/components/site-header.tsx))
   que só aparece com 2+ orgs. Typecheck OK. **Falta** (gated no banco migrado):
   filtrar as `*-queries.ts` por `currentOrg` e aplicar guards de entitlement por
   rota — o RLS já garante o isolamento, isso é otimização/UX.

### Ganchos de schema criados pela migração (referência)
- Tabelas: `organizations`, `org_memberships`, `org_entitlements`,
  `platform_admins`, `org_public_tokens`.
- Enums: `org_tipo` (consultoria|cliente|unidade), `org_role` (viewer|member|admin|owner).
- Funções: `is_platform_admin`, `can_access_org`, `org_role_at_least`,
  `org_role_rank`, `has_entitlement`, `shares_org`.
- `org_id` (NOT NULL) em todas as tabelas de domínio, backfill p/ org semente
  `00000000-0000-0000-0000-000000000001` ("Empresa Principal").
- Trigger `fn_default_org_id` (BEFORE INSERT): preenche `org_id` automaticamente
  quando o usuário tem exatamente 1 org → **não quebra os INSERTs atuais do app**.
- RLS reescrita: `USING(true)` → escopo por org; `profiles` restrito a co-membros;
  `fn_audit` agora grava `org_id`; `compliance_snapshots` único por (org, mês).

### Estado de implantação (2026-06-14)
- ✅ Migração APLICADA no Supabase. Verificada ponta a ponta: PWA no Vercel
  (`campo-pwa.vercel.app`), login, criação de inspeção, sync campo→nuvem→app
  principal e **upload de foto** funcionando sob a fundação multi-tenant.
- ✅ Platform admin definido (usuário hsgustavo1).
- ⚠️ Patch pós-aplicação já no repo (commit `eaf3b86`): `fn_default_org_id` não
  pode usar `min(uuid)` (Postgres não tem esse agregado → erro 42883 quebrava
  todos os inserts `field_*`). Se for reaplicar a migração do zero, o arquivo já
  está corrigido.

### Passos manuais ainda pendentes (do usuário)
1. ⏳ Rotacionar as chaves do Supabase (estiveram no histórico do git).
2. ⏳ Reprocessar/limpar itens "dead-letter" da fila do PWA que falharam ANTES do
   patch (a inspeção que "piscou" e fotos antigas). Itens novos sincronizam ok.
3. (Opcional) Migrar o app principal para o Vercel — hoje continua na Cloudflare.

## Próximas fases (ordem sugerida)

### Fase 1.5 — Contexto de org no frontend  ✅ núcleo feito / ⏳ resto gated
Feito: `AuthProvider` estendido + seletor de org no header (ver "Estado atual").
Falta (fazer com a migração já aplicada, para poder verificar rodando o app):
- Guard de rota por entitlement: org só-`rti_pwa` não vê telas de gestão. Usar
  `hasEntitlement('gestao_completa')` do contexto. NÃO wire antes do seed dos
  entitlements (senão esconde tudo). Componente sugerido: `RequireEntitlement`.
- `*-queries.ts` filtram por `currentOrg.id` (RLS é a rede de segurança; o filtro
  evita buscar dados de outras orgs acessíveis sem querer).
- `types.ts` (mantido à mão): adicionar as novas tabelas/colunas `org_id` para
  remover o acesso não-tipado (`sb as any`) em `auth-context.tsx`.

### Fase 1.6 — org_id em campo-core e campo-pwa
- `packages/campo-core`: adicionar `org_id` aos tipos `FieldInspection` etc.
- `campo-pwa` sync engine (download/enqueue/processQueue): carregar/enviar `org_id`.
  Hoje o `CreateInspectionModal` cria inspeção sem org — definir a partir da org
  ativa do usuário (ou deixar o trigger `fn_default_org_id` resolver no insert).
- `comporRti()` e importação em massa: setar `org_id` do org de destino.
- Storage: subir fotos no path `{org_id}/…` nos buckets `rti-evidencias` etc.,
  e aplicar RLS de storage por org.

### Fase 2 — MVP: consultor entregando RTI+PWA
- Seed: org `consultoria` (o consultor) + org `cliente` com
  `managed_by_org_id` = consultoria; entitlement `rti_pwa` no cliente.
- Escopar a edge function `admin-users` por org (criar/convidar usuários do cliente).
- Teste de isolamento (3 perfis): cliente A não lê B; consultor lê seus clientes;
  platform admin lê tudo.

### Fases posteriores (registrar, não construir ainda)
- **Vitrine sem login segura:** função `SECURITY DEFINER` que recebe um
  `org_public_tokens.token` e retorna só os indicadores **conformes** (nunca NCs).
  O "viewer mode" atual é client-side (`sessionStorage`) e **não serve** como
  vitrine para fiscal — substituir por endpoint server-side.
- **Entitlement `gestao_completa`** para venda direta a empresas (sem consultor).
- **Storage frio de fotos** + política de retenção (migrar de Supabase Storage
  para S3/Backblaze quando o volume crescer; path `{org_id}/…` já prepara isso).
- **Billing/assinatura por org** (Stripe), atrelado a `org_entitlements`.
- **UI mãe↔unidade** (consolidação multi-unidade) e **white-label do consultor**
  (logo/cores por `consultoria`).
- **App no Vercel (opcional):** trocar o alvo de build do TanStack Start de
  Cloudflare para o preset Vercel (remover/condicionar `@cloudflare/vite-plugin`
  em [`vite.config.ts`](../../../vite.config.ts)); validar SSR no deploy real.

## Riscos conhecidos / pontos de atenção
- A migração remove leitura pública (`USING(true)`) das tabelas LOTO. Se houver
  página anônima do app LOTO, validar antes de aplicar.
- Erros tsc pré-existentes no repo são conhecidos (CLAUDE.md). 2 que bloqueavam o
  build do PWA foram corrigidos nesta sessão (`CreateInspectionModal`, `Login`).
- Hierarquia profunda (consultoria → cliente → unidade) hoje cobre 1 nível por
  caminho em `can_access_org`. Transitividade total é melhoria futura.
- Desvinculação do @lovable.dev é item crítico paralelo (ver memória do projeto).
