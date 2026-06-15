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

### Segurança das chaves — VERIFICADO (2026-06-14)
- Investigado: o `.env` commitado tinha **só a chave anon** (`role: anon`,
  baixo risco — pública por design, protegida por RLS). A **`service_role`
  NUNCA foi commitada** (0 ocorrências no histórico do `.env`; os matches de
  "SERVICE_ROLE_KEY" são código referenciando o nome da env var + `.env.example`
  vazio). `campo-pwa/.env.local` nunca esteve no git.
- Conclusão: rotação **não é urgente**. Opcional rotacionar a Publishable key por
  higiene (atualizar Vercel + `.env` + redeploy). `.gitignore` já bloqueia `.env*`.

### Passos manuais ainda pendentes (do usuário)
1. ⏳ **Aplicar a migração `20260614010000_org_id_cascade.sql`** no SQL Editor
   (cascata de org_id + índices). Sem ela, inserts de usuário multi-org (Fase 2)
   falham por NOT NULL; single-org continua OK via `fn_default_org_id`.
2. (Opcional/baixa prioridade) Rotacionar a Publishable key do Supabase por higiene.
3. ⏳ Reprocessar/limpar itens "dead-letter" da fila do PWA (agora há botões
   "Tentar novamente" e "Descartar" no banner de sync).
4. (Opcional) Migrar o app principal para o Vercel — hoje continua na Cloudflare.

### Dívida conhecida (pré-existente, não bloqueia)
- O repo **não é prettier-clean**: `npm run lint` (`eslint .`) acusa centenas de
  erros `prettier/prettier` de formatação em arquivos legados (estilo compacto).
  Logo, o step de lint do CI (Fase 0) fica vermelho por formatação pré-existente,
  não por bug. Opções: rodar `eslint . --fix` num commit isolado (diff grande) ou
  remover o plugin prettier do eslint. Typecheck e build estão verdes.

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

### Fase 1.6 — org_id em campo-core e campo-pwa  ✅ feito (2026-06-14)
**Decisão-chave (base sólida):** filhos da árvore campo→RTI **herdam `org_id` do
pai** via trigger no banco (`fn_inherit_org_id`), em vez de o cliente carimbar
`org_id` em cada insert. Cliente só informa a org nas **raízes**
(`field_inspections`, `rti_reports`). Vantagem: invariante de segurança (filho
nunca fica em org diferente do pai) + zero churn por insert + funciona para
usuário multi-org (consultor) sem o trigger single-org `fn_default_org_id`.

Entregue:
- `packages/campo-core/src/types.ts` **e** `src/lib/campo.ts` (cópia do app, drift
  conhecido): `org_id?: string` nas 5 tabelas `field_*`. Opcional de propósito —
  coluna autoritativa do servidor; baixados trazem, locais herdam no insert.
- Migração [`20260614010000_org_id_cascade.sql`](../../../supabase/migrations/20260614010000_org_id_cascade.sql):
  `fn_inherit_org_id` + triggers `trg_inherit_org_*` em `field_nodes/points/
  findings/photos` e `rti_areas/ncs/nc_evidencias/nc_historico`; índices `org_id`
  em todas as tabelas de domínio. **Passo manual: aplicar no SQL Editor.**
- PWA: [`campo-pwa/src/lib/org.ts`](../../../campo-pwa/src/lib/org.ts)
  (`refreshOrgContext`/`getActiveOrgId`/`clearOrgContext`, cache em localStorage);
  `downloadAll` refresca a org; `CreateInspectionModal` carimba `org_id` na raiz;
  logout limpa o cache; `uploadPhoto` usa path `{org_id}/campo/…` (fallback ao
  legado `campo/…` sem regressão).
- App: `comporRti()` carimba `org_id` na raiz `rti_reports` (NCs/áreas/evidências
  cascateiam); cópia de evidência usa path `{org_id}/evidencias/…`;
  `uploadFieldPhoto(file, orgId?)` com path por org.
- `src/integrations/supabase/types.ts`: `org_id` nas tabelas `field_*` + `rti_reports`
  (+ corrigido drift de `arquivada_campo` em `field_inspections`). Typecheck app+PWA
  **verde**; build app+PWA **passa**.

⚠️ **Storage RLS por org foi adiado** de propósito: políticas duras por prefixo
quebrariam as fotos históricas (paths legados `campo/…`/`evidencias/…`). O
isolamento real continua no banco (file_path só é descoberto via linha RLS-scoped;
paths são UUID aleatório). Tightening de storage RLS = fase posterior (junto da
migração de fotos antigas para o prefixo `{org_id}/`).

### Fase 2 — MVP: consultor entregando RTI+PWA  ✅ artefatos prontos / ⏳ validar + UI
Entregue (código/SQL no repo):
- Seed [`20260614020000_seed_consultor_demo.sql`](../../../supabase/migrations/20260614020000_seed_consultor_demo.sql):
  Consultoria Demo (`…c0`) + Cliente A (`…a0`, `managed_by`=consultoria) + Cliente B
  (`…b0`, independente, p/ teste negativo) + entitlements `rti_pwa`. Vínculo de
  usuários = template comentado. **Passo manual: aplicar.**
- Edge function `admin-users` escopada por org:
  [`supabase/functions/admin-users/index.ts`](../../../supabase/functions/admin-users/index.ts)
  agora aceita `org_id` + `org_role` no `create`, autoriza via
  `is_platform_admin` OU `org_role_at_least(admin)` na org (cobre o consultor),
  insere `org_memberships`, e limpa membership no `delete`. Compat: sem `org_id`
  cai no papel global legado (`has_role admin`). **Passo manual: `supabase
  functions deploy admin-users`.**
- Teste de isolamento [`supabase/tests/fase2_isolation_test.sql`](../../../supabase/tests/fase2_isolation_test.sql):
  roda em transação com ROLLBACK, simula 4 perfis via JWT claims + `SET ROLE
  authenticated`, mede o que cada um enxerga. **Passo manual: preencher 4 UUIDs
  e rodar; conferir a matriz esperada no cabeçalho.**

⏳ Falta (UI, após validar o isolamento):
- Wire do painel de usuários para criar usuário **na org do cliente selecionado**
  (passar `org_id`/`org_role` do org ativo do contexto p/ a edge function) e listar
  usuários por org. Hoje o painel é global (legado) — backend já pronto p/ escopar.
- Rodar o pipeline campo→RTI logado como usuário do Cliente A e confirmar que o
  RTI nasce com `org_id`=A (a fundação 1.6 já garante via cascata).

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
- **Login offline multiusuário (aparelho compartilhado):** ver detalhes na seção
  "Sessão, offline e login" (cache de sessões por usuário + `setSession` + PIN
  local). Passar por brainstorming antes (mexe em auth/segurança).

## Sessão, offline e login (comportamento atual + futuro)

**Como funciona hoje (PWA):**
- 1º login precisa de internet (`signInWithPassword` valida no servidor). A sessão
  fica salva no aparelho (`persistSession`). `Layout` usa `getSession()` (sem rede)
  → reabrir o app offline entra direto, sem pedir login.
- **"Sair" (`signOut`) apaga a sessão salva** → o próximo login exige internet.
  Por isso, para uso offline, a orientação é: NÃO clicar em Sair, só fechar o app.
  Já há **confirmação no botão Sair** avisando isso (reforçada quando offline).
- Dados coletados (Dexie/IndexedDB) **persistem** mesmo após `signOut`; sincronizam
  quando o mesmo usuário logar de novo (online).

**Item futuro — Login OFFLINE multiusuário (aparelho compartilhado):**
Necessidade real: vários técnicos num mesmo tablet, sem sinal, cada um entrando
mesmo após logout, sem internet. Não é comportamento padrão do Supabase. Abordagem
recomendada (a desenhar/brainstormar antes de implementar):
1. Após cada login ONLINE, **cachear a sessão do usuário** (access+refresh token)
   localmente, indexada por e-mail/`user_id` (IndexedDB).
2. "Entrar offline" para um usuário já conhecido = `supabase.auth.setSession({...})`
   com os tokens cacheados (não faz rede) em vez de `signInWithPassword`.
3. **Gate de segurança por PIN local** por usuário (hash local), porque guardar
   refresh tokens de vários usuários num aparelho compartilhado é sensível.
4. Tratar expiração do refresh token (offline longo) e revogação.
Esforço médio; mexe em auth + segurança → passar por brainstorming antes.

## Riscos conhecidos / pontos de atenção
- A migração remove leitura pública (`USING(true)`) das tabelas LOTO. Se houver
  página anônima do app LOTO, validar antes de aplicar.
- Erros tsc pré-existentes no repo são conhecidos (CLAUDE.md). 2 que bloqueavam o
  build do PWA foram corrigidos nesta sessão (`CreateInspectionModal`, `Login`).
- Hierarquia profunda (consultoria → cliente → unidade) hoje cobre 1 nível por
  caminho em `can_access_org`. Transitividade total é melhoria futura.
- Desvinculação do @lovable.dev é item crítico paralelo (ver memória do projeto).
