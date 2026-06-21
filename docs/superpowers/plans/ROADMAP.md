# ROADMAP — gestão_nr10 (handoff entre sessões)

> Documento de continuidade. Permite retomar o trabalho numa nova sessão de IA
> sem o contexto desta. Última atualização: 2026-06-20.

## ⏱️ O QUE FALTA FAZER AGORA (checklist ordenado)

Fases 0 → 2 estão com **código/SQL prontos e commitados** na `main`; CI verde
(lint 0 erros, 85 testes, build app+PWA). Migrações da fundação, da cascata de
org_id e do seed do consultor **aplicadas**. **Isolamento multi-tenant VALIDADO**
em 2026-06-15 (ver abaixo). Restam só itens opcionais/UI.

✅ **Fase 2 — isolamento VALIDADO (2026-06-15):** teste
`supabase/tests/fase2_isolation_test.sql` rodado com 3 usuários de teste reais.
Matriz confirmada: consultor lê A e não B; cliente A só A; cliente B só B; platform
admin tudo. `can_access_org`/`org_role_at_least` (a base do RLS) comprovadamente
isolam os tenants.

Pendências (todas opcionais agora):
1. ✅ **Deploy da edge function `admin-users` — FEITO (2026-06-15, v1, ACTIVE,
   verify_jwt on)** via Supabase MCP. (Antes nunca tinha sido publicada — era v1.)
   Inclui a versão multi-tenant: ação `list` + autz org-aware.
2. ✅ **UI do painel por org — FEITO (2026-06-15/16).** Criar/listar usuário na org
   do cliente selecionado (via edge `list`); commit `8e4ec8a`. UX de tenancy (commit
   `89ac137`): "Controle de acessos" movido do menu RAC — Bloqueio para o menu do
   usuário (avatar); seletor de org **hierárquico** (consultoria → clientes indentados);
   painel mostra "gerenciado por {consultoria}". Falta opcional: árvore multi-org num só
   painel (precisa de ação nova na edge + redeploy).
3. *(Opcional, prova final)* Logar no app/PWA como cada usuário de teste e ver só
   os dados da própria org.

**👉 FASE 1.5 EM ANDAMENTO (gates por papel/entitlement + filtro de dados por org):**
- ✅ **RTI + Campo migrados (2026-06-18, commits `238c9e3` + `01e02d0`).** Gates
  centralizados em `src/lib/tenancy-gates.ts` (`getRtiCampoAccess` → canView/canEdit/
  canAdmin, com entitlement `rti_pwa`/`gestao_completa` + papel de org + fallback legado).
  Menu esconde o grupo RTI para org sem entitlement. Dados RTI (`useRtiReports`/
  `useAllRtiNcs`) filtrados por org. Um cliente `member` com `rti_pwa` já opera o fluxo
  RTI/Campo **sem** papel global.
- ⏳ **Falta:** replicar o padrão de gate aos demais módulos (NR-10, EPIs, qualificações,
  LOTO, incidentes, ASOs, prontuário + restante do `site-header`) e filtrar os outros
  `*-queries.ts` por org (só RTI está filtrado). Detalhe na seção "Fase 1.5".

✅ **Selo de Entrega — controle por provença (2026-06-19, commits `81bf31f`→`5be8a9c`).**
Terceiro nível de autorização (entre admin e visualização): ao **entregar** um RTI, o
registro técnico (criticidade, recomendação, descrição, evidência de constatação,
exclusão de NC) congela para o admin-padrão do cliente; rotina (prazo/custo/andamento/
evidência de correção/criar ação) segue livre. Camada genérica (`seal_policy` +
`fn_can_bypass_seal` + `fn_enforce_seal`), **extensível à LOTO** sem código novo —
só registrar a tabela na `seal_policy`. Migrations `20260619000000/001000/002000`
APLICADAS via MCP + verificadas; edge `admin-users` **v3**. Spec/plano em
`docs/superpowers/{specs,plans}/2026-06-19-selo-entrega-rti*`. 111 testes verdes.
- ⏳ **Follow-up opcional:** alinhar o gate da UI (`getRecordAccess`) ao banco em perfis
  legados raros (`isStaff`/cadeia `parent_org_id`) — cosmético, banco já é a barreira.

Outros itens opcionais/futuros estão em "Passos manuais" e "Fases posteriores".

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

### Estado de implantação (2026-06-15)
- ✅ Migração da fundação APLICADA no Supabase. Verificada ponta a ponta: PWA no
  Vercel (`campo-pwa.vercel.app`), login, criação de inspeção, sync campo→nuvem→app
  principal e **upload de foto** funcionando sob a fundação multi-tenant.
- ✅ Migração da cascata `20260614010000_org_id_cascade.sql` APLICADA (2026-06-15).
- ✅ Seed `20260614020000_seed_consultor_demo.sql` APLICADO (orgs Consultoria/A/B +
  entitlements). Falta criar/vincular os usuários de teste (ver checklist no topo).
- ✅ Platform admin definido (usuário hsgustavo1).
- ✅ **Isolamento multi-tenant validado (2026-06-15)** via teste com 3 usuários reais
  (consultor/cliente A/cliente B) — matriz esperada bateu 100%.
- ⏳ Edge function `admin-users` (escopo por org) ainda **não deployada** — opcional,
  só necessária quando o app for criar usuários por org. Ver checklist no topo.
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

### Passos manuais pendentes (do usuário)
**Fase 2 — isolamento já validado ✅.** Só sobrou o deploy opcional de
`admin-users` (necessário quando o app for criar usuários por org; ver checklist
do topo).

**Opcionais / baixa prioridade:**
1. Rotacionar a Publishable key do Supabase por higiene.
2. Reprocessar/limpar itens "dead-letter" da fila do PWA (já há botões "Tentar
   novamente" e "Descartar" no banner de sync).
3. Migrar o app principal para o Vercel — hoje na Cloudflare (sem lock-in;
   **recomendado como tarefa isolada pós-Fase 2**, ver fases posteriores).

### Higiene de lint/CI — ✅ RESOLVIDO (2026-06-15)
Commits `7c7d7fb` (reformat prettier do repo + ajuste do eslint) e `5ead464`
(`.git-blame-ignore-revs`). `eslint .` agora sai com **0 erros** (CI verde);
restam 42 *warnings* não-bloqueantes (26 `any` rebaixado para warn; 9 react-refresh;
7 `react-hooks/exhaustive-deps`). Config: passou a ignorar `**/dist/**` (estava
varrendo o build do PWA) e `no-explicit-any` virou `warn` (usos legítimos: Supabase
não-tipado, Recharts).
- ✅ **RESOLVIDO (2026-06-15):** os 7 `react-hooks/exhaustive-deps` foram revisados
  caso a caso (nenhum era bug de correção latente, mas 2 viraram ganho real de perf):
  - `src/routes/rti.custos.tsx` — predicados `matchSetor/matchPrioridade/matchTipo`
    envolvidos em `useCallback` (ref estável entra nas deps dos `useMemo` sem quebrar
    a memoização).
  - `campo-pwa/src/pages/InspectionDetail.tsx` — `allFindings`/`nodes` estabilizados
    com `useMemo` sobre o resultado cru do `useLiveQuery` (elimina recomputação de
    `findingsByPoint`/`nodeById` durante o carregamento).
  - `src/components/print-label-dialog.tsx` — `eslint-disable` documentado: incluir o
    objeto `padlock` seria regressão (re-fetch da foto/re-query a cada render do pai);
    as deps por-campo já cobrem o que o efeito lê.
  `eslint` nos 3 arquivos sai com 0 warnings de exhaustive-deps; typecheck app+PWA verde.
- Para ativar o blame-ignore localmente: `git config blame.ignoreRevsFile .git-blame-ignore-revs`
  (o GitHub usa automático).

## Próximas fases (ordem sugerida)

### Fase 1.5 — Contexto de org + gates no frontend  ✅ núcleo + RTI/Campo / ⏳ demais módulos
Feito: `AuthProvider` estendido + seletor de org no header (ver "Estado atual").

✅ **Fatia RTI/Campo concluída (2026-06-18):**
- Dados: `useRtiReports`/`useAllRtiNcs` filtram por `currentOrgId` (queryKey + `.eq` +
  `enabled`); criação de relatório carimba `org_id` da org ativa (commit `238c9e3`).
- Gates: helper `getRtiCampoAccess` ([`src/lib/tenancy-gates.ts`](../../../src/lib/tenancy-gates.ts))
  + testes, aplicado em 6 rotas RTI + 4 rotas Campo + menu (commit `01e02d0`). `canView`
  gateia por entitlement `rti_pwa`/`gestao_completa`; `canEdit`=member; `canAdmin`=admin;
  fallback legado `isStaff`/`isAdmin`. Spec: [`docs/superpowers/specs/2026-06-16-rti-campo-gates-design.md`](../specs/2026-06-16-rti-campo-gates-design.md).
- (Produto, não tenancy) Tela de Análise de Custos refeita: realizado/em aberto/saldo
  estouro-economia + gráfico de andamento por custo clicável — commits `e214806`/`69a4c8b`.

⏳ **Falta para fechar a Fase 1.5:**
- **Replicar gates aos demais módulos:** NR-10, EPIs, qualificações, LOTO, incidentes,
  ASOs, prontuário e o restante do `site-header` ainda usam `isStaff`/`isAdmin` globais.
  Padrão: helper por recorte espelhando `getRtiCampoAccess` (ou generalizar para
  `getModuleAccess(modulo, ctx)`). Cada módulo amarra ao seu entitlement
  (`gestao_completa` p/ NR-10/EPIs/etc.; `loto` p/ LOTO).
- **Filtrar os demais `*-queries.ts` por `currentOrg.id`** (só RTI está filtrado):
  campo-queries, qualificacoes, inspecoes, epis, prontuario, asos, incidentes. RLS é a
  rede de segurança; o filtro é correção de UX p/ usuário multi-org.
- `types.ts` (à mão): adicionar tabelas de tenancy/colunas `org_id` p/ remover o
  `sb as any` em `auth-context.tsx`.
- (Opcional) Componente `RequireEntitlement` p/ guard de rota formal — hoje o menu já
  esconde por entitlement no recorte RTI/Campo.

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

### Fase 2 — MVP: consultor entregando RTI+PWA  ✅ isolamento validado / ⏳ UI
Entregue (código/SQL no repo) e **isolamento validado em 2026-06-15**:
- Seed [`20260614020000_seed_consultor_demo.sql`](../../../supabase/migrations/20260614020000_seed_consultor_demo.sql):
  Consultoria Demo (`…c0`) + Cliente A (`…a0`, `managed_by`=consultoria) + Cliente B
  (`…b0`, independente, p/ teste negativo) + entitlements `rti_pwa`. **APLICADO ✅**
  (usuários de teste criados via dashboard + INSERT do template).
- Edge function `admin-users` escopada por org:
  [`supabase/functions/admin-users/index.ts`](../../../supabase/functions/admin-users/index.ts)
  agora aceita `org_id` + `org_role` no `create`, autoriza via
  `is_platform_admin` OU `org_role_at_least(admin)` na org (cobre o consultor),
  insere `org_memberships`, e limpa membership no `delete`. Compat: sem `org_id`
  cai no papel global legado (`has_role admin`). Estendida em 2026-06-15 com a ação
  `list` + autz org-aware em delete/update/reset. ✅ **Deployada (v1, ACTIVE).**
- Teste de isolamento [`supabase/tests/fase2_isolation_test.sql`](../../../supabase/tests/fase2_isolation_test.sql):
  roda no SQL Editor web; testa direto `can_access_org`/`org_role_at_least` (a base
  do RLS) para os 4 perfis. **RODADO ✅ — matriz esperada bateu 100%** (consultor lê
  A e não B; cada cliente só a própria org; platform admin tudo).

⏳ Falta (UI — próximo passo de produto da Fase 2):
- 🔨 **EM IMPLEMENTAÇÃO (2026-06-15):** wire do painel de usuários por org. Spec:
  [`docs/superpowers/specs/2026-06-15-painel-usuarios-por-org-design.md`](../specs/2026-06-15-painel-usuarios-por-org-design.md).
  Inclui: nova ação `list` na edge function (necessária — RLS de `profiles`/`shares_org`
  esconde usuários-cliente do consultor, que gerencia mas não é co-membro); autz
  org-aware em delete/update/reset; criação com `org_id`+`org_role` (níveis
  Administrador/Visualização); gate por `hasOrgRole('admin')`. Legado (Empresa
  Principal) inalterado. ✅ **`admin-users` deployada (v1, ACTIVE) em 2026-06-15.**
- Rodar o pipeline campo→RTI logado como usuário do Cliente A e confirmar que o
  RTI nasce com `org_id`=A (a fundação 1.6 já garante via cascata). ✅ **Desbloqueado
  pela fatia RTI/Campo da Fase 1.5 (2026-06-18):** cliente `member`/`admin` com `rti_pwa`
  já opera o pipeline sem papel global. Falta a **prova logado** como Cliente A.

✅ **UI de gestão de empresas (subsistema A) — ENTREGUE (2026-06-19, commits `2cd9cf7`..`0384bf1`).**
Antes orgs só nasciam por seed SQL; agora há a rota
[`/admin/empresas`](../../../src/routes/admin.empresas.tsx) com árvore hierárquica +
wizard de criação em 4 passos (4º = 1º usuário, **opcional**, via edge `admin-users`) +
painel de edição (renomear / vínculo / módulos / ativar-desativar), condicionado ao papel
pelo gate puro `getEmpresaAdminAccess` (criar/entitlements/desativar = só platform admin;
editar/usuários = +consultor admin). Backend na migração
[`20260619200000_empresas_management.sql`](../../../supabase/migrations/20260619200000_empresas_management.sql)
(**aplicada via MCP do Supabase** — convenção mudou nesta sessão): coluna `organizations.ativa`,
`can_access_org` passou a exigir org-alvo ativa (platform admin faz bypass p/ reativar) e 4 RPCs
`SECURITY DEFINER` (`fn_create_org` / `fn_update_org` / `fn_set_org_entitlements` / `fn_set_org_active`,
autz própria via `auth.uid()`). Acesso não-tipado isolado em
[`src/lib/empresas-queries.ts`](../../../src/lib/empresas-queries.ts) (decisão: NÃO regenerar
`types.ts` à mão — wrapper isolado como em `auth-context`). Teste de autz
[`supabase/tests/empresas_rpc_test.sql`](../../../supabase/tests/empresas_rpc_test.sql) = **8/8 verde**.
Spec: [`2026-06-19-ui-gestao-empresas-design.md`](../specs/2026-06-19-ui-gestao-empresas-design.md);
plano: [`2026-06-19-ui-gestao-empresas.md`](2026-06-19-ui-gestao-empresas.md).

⏳ **Follow-ups MENORES (inertes hoje, da revisão final 2026-06-19):**
  - `fn_update_org` reconhece o consultor **só pela cadeia `managed_by`**, não `parent` — uma
    *unidade* sob um cliente gerido recusaria a edição na RPC com "sem permissão" (falha **fechada**,
    sem risco de segurança; sem unidades cadastradas hoje). Corrigir adicionando o ramo
    `parent_org_id` ao `EXISTS` quando criarmos unidades.
  - `possiveisMaes` (seletor de empresa-mãe no wizard/edição) **não filtra por `tipo`**, permitindo
    escolher uma unidade como mãe de outra. Confirmar se sub-unidades são desejadas; senão, filtrar
    `tipo !== "unidade"`.

### Fases posteriores (registrar, não construir ainda)
- 📐 **Visibilidade por entrega (inspeção/RTI só aparece ao cliente após entregue)
  — DESIGN PRONTO (2026-06-20), implementação pendente.** Spec:
  [`2026-06-20-visibilidade-por-entrega-design.md`](../specs/2026-06-20-visibilidade-por-entrega-design.md).
  Regra: inspeção/RTI criado pela **própria org** do cliente → visível na hora;
  criado pelo **consultor/dono** → invisível ao cliente até **entregar**; autores
  veem rascunhos sempre. Reusa `entregue_em` do Selo (o RTI já tem; falta na
  inspeção) + nova coluna **server-set `created_by_org_id`** (procedência
  confiável, trigger anti-spoofing) + nova **policy de SELECT** nas raízes
  (`fn_can_view_entregavel` distingue gestor de membro-cliente) com filhos
  herdando por `EXISTS`. Sync do PWA: nada a mudar (RLS já filtra o download).
- ✅ **Cache de org no PWA auto-sana (2026-06-20, commit `e8960bc`).** Atualização
  do PWA não depende mais de o usuário limpar cache: `getActiveOrgId` valida contra
  a lista de orgs operáveis (descarta valor stale, ex.: consultoria de versão antiga)
  e `startConnectivityWatcher` refresca a org no kick inicial (o evento `online` nunca
  dispara no celular). Relacionado ao fix do drill-down de cliente (commit `a5f60af`:
  `org.ts` lia `org_memberships`→consultoria; passou a ler `organizations`→clientes
  geridos; modal carimba `org_id` = cliente escolhido).
- ✅ **Propagação de modos de falha por org (campo/modos) — ENTREGUE (2026-06-20,
  migration [`20260620070000_modos_falha_escopo_publico.sql`](../../../supabase/migrations/20260620070000_modos_falha_escopo_publico.sql)).**
  Modelo por **visibilidade** (RLS), **não por cópia** — superou o plano antigo de
  `fn_propagate_modo_falha`. Colunas: `organizations.is_root` (Empresa Principal =
  dona do app, única, índice único parcial) e `rti_modos_falha.publico`; `org_id`
  virou **NOT NULL** (procedência — todo modo tem dono; os 30 globais legados
  `org_id IS NULL` viraram `publico=true` da raiz). Regras: **(A)** modo da raiz com
  `publico=true` → todas as empresas; **(B)** modo de consultoria → ela + clientes
  que gere (`managed_by`); **(C)** modo de filha → só ela; **(D)** nível acima
  edita/exclui o de baixo; **(E)** platform admin vê/edita/exclui tudo. Autz em 2
  funções `SECURITY DEFINER` (`can_write_modo_falha(org_id)` /
  `can_publish_modo_falha()`); 4 policies recriadas. UI
  ([`campo.modos.tsx`](../../../src/routes/campo.modos.tsx)): toggle **"Publicar para
  todas as empresas / Manter interno"** só no contexto da raiz; PA exclui qualquer
  modo (corrige o bug "criei na Principal e não conseguia excluir"). **Decisão:**
  Opção A (camadas fixas dona/consultoria/cliente) em vez de árvore recursiva —
  clientes/consultores nunca enxergam a hierarquia. Validado por simulação RLS dos
  4 papéis (consultor vê os modos do cliente que gere; cliente B isolado; PA tudo).
- **Dois níveis de cliente do consultor** (levantado 2026-06-15): hoje o painel oferece
  só níveis grossos (`admin` = controla tudo / `viewer` = só lê). Falta o nível
  **"cliente operador restrito":** edita a operação mas **prioridades/NCs definidas
  pelo consultor ficam read-only** (o consultor entrega o relatório priorizado e o
  cliente não deve alterar essa curadoria). É permissão **por campo** no domínio RTI
  (column/action-level lock), mapeando a um futuro `org_role=member` + travas. O outro
  nível (cliente-final, consultor só distribui) já é coberto por `admin` hoje.
- **Gates de feature por entitlement (Fase 1.5) — RTI/Campo ✅, demais módulos ⏳:** o
  recorte RTI/Campo já libera por entitlement+papel de org (helper `getRtiCampoAccess`,
  2026-06-18). Os demais módulos (NR-10/EPIs/qualificações/LOTO/...) ainda usam papel
  **global** (`isStaff`/`isAdmin`) — falta replicar o padrão (ver seção "Fase 1.5").
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
