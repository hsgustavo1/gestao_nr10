# UI de gestão de empresas (orgs) — design

**Data:** 2026-06-19
**Contexto:** ROADMAP — a fundação multi-tenant (tabelas, RLS, funções de autz) já
existe e o isolamento foi validado (2026-06-15). Falta a **camada de UI para criar e
gerenciar empresas (orgs)** — hoje orgs só nascem por seed SQL manual. Esta spec cobre
o subsistema **A** (gestão de empresas). O subsistema **B** (vitrine sem login +
hospedagem/roteamento) foi **adiado** para depois do RTI validado (decisão 2026-06-19).

## Problema

Não existe forma de criar uma org pela aplicação. Existe um painel de **usuários por
org** (`src/routes/admin/usuarios.tsx` + edge `admin-users`), mas nada para:
- o **dono do app** (platform admin) criar consultorias, clientes diretos e unidades,
  atribuir consultor a um cliente, definir entitlements e (opcionalmente) o 1º admin;
- o **consultor** (dono da consultoria) ver/gerenciar a carteira de clientes dele.

## Decisões tomadas no brainstorming

1. **Matriz de criação (MVP):** só o **platform admin cria** empresas. O consultor
   **não cria** clientes — só **gerencia** os que o dono atribuiu a ele.
2. **Fluxo de criação = wizard completo**, com a etapa de 1º usuário **opcional**
   (a empresa pode nascer sem usuário, definido depois pelo painel existente).
3. **Ciclo de vida:** criar + listar (árvore) + editar + **desativar lógico**
   (nunca delete físico — invariante de auditoria/LGPD). Reativável.
4. **Consultor tem a mesma tela, escopada à carteira dele:** vê a árvore só com seus
   clientes, pode **editar dados** do cliente e **gerenciar usuários**; **não cria
   empresas nem mexe em entitlements** (decisão comercial = só do dono).
5. **Backend = RPCs `SECURITY DEFINER`** (Abordagem 1), o mesmo "seam" de autz que o
   projeto já adota. Atômico, sem service-role novo, sem edge nova.
6. **Desativação imposta no banco (RLS), não só no front** — coerente com a decisão de
   roadmap "isolamento real é no banco". Org desativada some para usuários comuns; dados
   persistem; platform admin segue enxergando para reativar.

## Schema relevante (já existente — migração 20260614000000)

- `organizations(id, nome, tipo org_tipo, parent_org_id, managed_by_org_id, created_at)`.
  **Sem coluna de status** → esta spec adiciona `ativa`.
- `org_entitlements(org_id, module)` com `module ∈ {gestao_completa, rti_pwa, loto}`.
  Escrita já é **só platform admin** na RLS.
- `org_memberships(user_id, org_id, org_role)`; `org_role ∈ {viewer, member, admin, owner}`.
- Funções: `is_platform_admin`, `can_access_org`, `org_role_at_least`, `org_role_rank`,
  `has_entitlement`, `shares_org`.
- RLS de `organizations`: `orgs_ins` já permite platform admin (e admin de
  managed_by/parent); `orgs_upd` exige `owner` — por isso o consultor (admin) **não**
  edita o cliente via RLS direta; a RPC `SECURITY DEFINER` resolve isso aplicando a
  própria regra.

## Seção 1 — Backend (dados + RPCs)

### 1.1 Adição de schema (migração aditiva, não-destrutiva)

- `organizations.ativa boolean NOT NULL DEFAULT true`.
- `can_access_org(_uid, _org_id)` passa a exigir que a **org-alvo** esteja ativa:
  `is_platform_admin` faz bypass (enxerga inativas para reativar); para os demais,
  o acesso só vale se `organizations.ativa = true` na org-alvo. Mudança contida (um
  `AND` no gate base), mas como `can_access_org` é a função-base do RLS de todas as
  tabelas de domínio, **acompanha teste de regressão de isolamento**.
- Edge case (registrado, sem cascata automática): desativar uma **consultoria** não
  desativa os clientes geridos; a UI avisa quantos clientes ela gere.

### 1.2 RPCs `SECURITY DEFINER` (autz interna, atômicas)

- `fn_create_org(p_nome text, p_tipo org_tipo, p_managed_by uuid, p_parent uuid, p_entitlements text[])`
  → cria org + entitlements numa transação. **Autz:** `is_platform_admin`. **Valida:**
  `unidade` exige `parent`; `cliente` aceita `managed_by` (opcional); `consultoria` não
  tem vínculo; `p_entitlements` ⊆ {gestao_completa, rti_pwa, loto}. Retorna o novo `id`.
- `fn_update_org(p_org uuid, p_nome text, p_managed_by uuid, p_parent uuid)`
  → **Autz:** `is_platform_admin` **ou** consultor `admin` na consultoria gestora.
  **Não** mexe em entitlements.
- `fn_set_org_entitlements(p_org uuid, p_entitlements text[])`
  → **Autz:** **só** `is_platform_admin`. Substitui o conjunto de entitlements da org.
- `fn_set_org_active(p_org uuid, p_ativa boolean)`
  → **Autz:** **só** `is_platform_admin` (desativar é decisão comercial).
- **1º usuário (opcional):** reusa a edge `admin-users` existente (já aceita
  `org_id` + `org_role`). O wizard a chama **após** `fn_create_org` retornar o id.
  Nenhum código novo de backend de usuário.

### 1.3 Listagem (árvore)

Consulta client-side em `organizations` (já escopada pela RLS `orgs_sel`: platform admin
vê tudo, consultor vê consultoria + clientes geridos) + `org_entitlements`. Contagem de
usuários por org é nice-to-have e fica para a edge `list` sob demanda (a RLS de
`profiles`/`shares_org` esconde usuários-cliente do consultor).

## Seção 2 — Frontend (rotas, árvore e wizard)

### 2.1 Rota e acesso

Nova rota `/admin/empresas`, item de menu visível para `isPlatformAdmin` **ou** consultor
(`hasOrgRole('admin')` numa consultoria). A árvore vem escopada pela RLS — sem filtro
extra no front além do gate de menu.

### 2.2 Árvore de empresas

Lista hierárquica indentada: `Consultorias → Clientes (geridos) → Unidades`; clientes
diretos (sem consultor) num grupo próprio. Reaproveita o padrão de indentação do
`OrgSwitcher` (commit `89ac137`). Cada linha: nome, badge de tipo, chips de entitlements
(`gestão`/`rti`/`loto`), status (ativa/inativa). Inativas esmaecidas (só platform admin).

### 2.3 Wizard "Nova empresa" (só platform admin) — 4 passos, o 4º opcional

1. **Dados** — nome + tipo (consultoria/cliente/unidade).
2. **Vínculo** — adapta ao tipo: `cliente` → seletor de consultoria gestora (opcional →
   senão cliente direto); `unidade` → seletor de empresa-mãe (obrigatório); `consultoria`
   → sem vínculo.
3. **Entitlements** — checkboxes `gestao_completa` / `rti_pwa` / `loto` (default sugerido:
   `rti_pwa`).
4. **1º admin (opcional)** — e-mail/senha via edge `admin-users`, ou **"Pular — definir
   depois"**.

### 2.4 Edição/gestão (rota de detalhe ou painel lateral)

- **Platform admin:** renomear, trocar vínculo, editar entitlements, **ativar/desativar**,
  atalho "Gerenciar usuários" (abre o painel por org existente já apontando para a empresa).
- **Consultor:** renomear o cliente + "Gerenciar usuários"; entitlements, criação e
  desativação **não aparecem**.

## Seção 3 — Autorização, erros e testes

### 3.1 Gate helper (espelha `src/lib/tenancy-gates.ts`)

`getEmpresaAdminAccess(ctx)` → `{ canCreate, canEditOrg, canManageEntitlements,
canDeactivate, canManageUsers }`:
- `canCreate` / `canManageEntitlements` / `canDeactivate` = `isPlatformAdmin`.
- `canEditOrg` / `canManageUsers` = `isPlatformAdmin || hasOrgRole('admin')`.
Regra de UI num só lugar testável. **A barreira real é o banco** (RLS + autz das RPCs);
o gate é UX.

### 3.2 Tratamento de erros

- RPCs levantam exceção com mensagem clara (`'sem permissão'`, `'unidade requer
  empresa-mãe'`, `'org-alvo inativa'`) → o front traduz em toast.
- **Atomicidade:** `fn_create_org` (org + entitlements) é uma transação. O passo 4
  (usuário) é separado e pode falhar sem desfazer a empresa → toast "empresa criada;
  falha ao criar usuário, defina depois pelo painel". Sem estado meio-criado na parte
  crítica.
- **Desativar consultoria com clientes:** diálogo de confirmação informa quantos clientes
  ela gere (sem cascata automática).
- Dependência de deploy da edge `admin-users` afeta só o passo 4 (já é assim hoje);
  criar/editar empresa não depende de deploy de edge (são RPCs aplicadas por migração).

### 3.3 Testes

- **Unit (Vitest):** `getEmpresaAdminAccess` — matriz platform admin / consultor-admin /
  member / viewer.
- **SQL (espelha `supabase/tests/fase2_isolation_test.sql`):** autz das RPCs — platform
  admin cria; consultor **não** cria; consultor edita cliente próprio mas **não** o de
  outra consultoria; consultor **não** altera entitlements; `fn_set_org_active` só
  platform admin; e regressão "org desativada some para o membro, persiste para o admin".

### 3.4 `types.ts` (à mão)

Adicionar as tabelas de tenancy (`organizations`, `org_memberships`, `org_entitlements`,
`platform_admins`, `org_public_tokens`) e a coluna `ativa`, removendo o `sb as any` de
`auth-context.tsx` no caminho tocado.

## Fora de escopo (registrado)

- **Subsistema B — vitrine sem login + hospedagem/roteamento por domínio:** adiado para
  depois do RTI validado. Endpoint server-side via `org_public_tokens` que retorna **só
  indicadores conformes** (nunca NCs).
- **Consultor criar os próprios clientes** (delegação) — MVP é só platform admin cria.
- **Nível "cliente operador restrito"** (travas por campo no RTI) — já registrado no
  ROADMAP como fase posterior.
- **Cascata de desativação** consultoria→clientes — só aviso, sem automação.
- **Contagem de usuários por org na árvore** — nice-to-have via edge `list` sob demanda.

## Dependências de implantação

- **Migração** (coluna `ativa` + `can_access_org` + as 4 RPCs): aplicar no SQL Editor do
  Supabase (convenção do projeto: migrations manuais).
- Edge `admin-users`: **já deployada** (v3). O passo 4 do wizard usa o que já existe.
