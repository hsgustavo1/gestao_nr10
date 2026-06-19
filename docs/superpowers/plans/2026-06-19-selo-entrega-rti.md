# Selo de Entrega (RTI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um RTI entregue por consultor/dono fique com o registro técnico congelado (criticidade, recomendação, descrição, evidência de constatação, exclusão de NCs) para o admin-padrão do cliente, mantendo livre a gestão de rotina (prazos, custos, andamento, evidência de correção, criar ações).

**Architecture:** Camada genérica "Selo de Entrega": colunas `entregue_em`/`entregue_por_org` nos nós-raiz e filhos do RTI; tabela declarativa `seal_policy`; um trigger `fn_enforce_seal()` que bloqueia colunas congeladas/DELETE quando selado e o ator não bypassa; helper único `fn_can_bypass_seal()` consumido por banco e UI. Enforcement em dois níveis (trigger no banco + gate na UI) e auditoria automática no histórico.

**Tech Stack:** Supabase (Postgres, PL/pgSQL, RLS, triggers, RPC), TanStack Start/Router, React Query, React, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-19-selo-entrega-rti-design.md`

**Convenções do projeto (obrigatório):**
- Migrations são **aplicadas manualmente** no SQL Editor do Supabase. Cada task de migration cria o arquivo `.sql` versionado E descreve a aplicação/verificação manual. NÃO automatize o apply.
- `types.ts` é mantido **à mão**.
- Erros de `tsc` pré-existentes são conhecidos — não tratar como bug novo.
- Commits direto na `main`.

---

## File Structure

**Criar:**
- `supabase/migrations/20260619000000_seal_schema.sql` — colunas, `seal_policy`, `fn_can_bypass_seal`.
- `supabase/migrations/20260619001000_seal_entregar_rpc.sql` — `fn_entregar_rti_report` (carimbo + cascata).
- `supabase/migrations/20260619002000_seal_enforce_triggers.sql` — `fn_enforce_seal`, provença no INSERT, auditoria no histórico.

**Modificar:**
- `src/integrations/supabase/types.ts` — colunas novas nas tabelas RTI (à mão).
- `src/lib/rti.ts` — `entregue_em`/`entregue_por_org` em `RtiReport`, `RtiArea`, `RtiNc`, `RtiNcEvidencia`.
- `src/lib/tenancy-gates.ts` — novo `getRecordAccess()` (mantém `getRtiCampoAccess` intacto).
- `src/lib/__tests__/tenancy-gates.test.ts` — testes de `getRecordAccess`.
- `src/lib/auth-context.tsx` — expõe `managerOrgRole` e `roleInOrg`.
- `src/lib/rti-queries.ts` — `useEntregarRtiReport()`.
- `src/routes/admin.usuarios.tsx` — seletor de nível 2 → 3 opções.
- `src/routes/rti.nc.$ncId.tsx` — gate por registro (técnico × operacional) + badge.
- `src/routes/rti.plano.tsx` — botão "Entregar relatório" + badge.

---

## Task 1: Migration — schema do selo

**Files:**
- Create: `supabase/migrations/20260619000000_seal_schema.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- ============================================================================
-- Selo de Entrega — schema base (colunas + política declarativa + bypass)
-- Idempotente, aditivo, não-destrutivo. Aplicar manualmente no SQL Editor.
-- ============================================================================

-- ---------- 1. Colunas de selo no root e nos filhos protegidos ----------
ALTER TABLE public.rti_reports        ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
ALTER TABLE public.rti_reports        ADD COLUMN IF NOT EXISTS entregue_por_org uuid REFERENCES public.organizations(id);
ALTER TABLE public.rti_areas          ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
ALTER TABLE public.rti_areas          ADD COLUMN IF NOT EXISTS entregue_por_org uuid;
ALTER TABLE public.rti_ncs            ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
ALTER TABLE public.rti_ncs            ADD COLUMN IF NOT EXISTS entregue_por_org uuid;
ALTER TABLE public.rti_nc_evidencias  ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
ALTER TABLE public.rti_nc_evidencias  ADD COLUMN IF NOT EXISTS entregue_por_org uuid;

-- ---------- 2. Registro declarativo de política de congelamento ----------
CREATE TABLE IF NOT EXISTS public.seal_policy (
  table_name     text PRIMARY KEY,
  frozen_columns text[]  NOT NULL DEFAULT '{}',
  allow_delete   boolean NOT NULL DEFAULT false,
  row_filter     text    -- expressão SQL booleana sobre NEW/OLD; NULL = toda linha
);

-- Política do RTI (Opção 1 — congelar colunas). '*' = qualquer coluna muda → bloqueia.
INSERT INTO public.seal_policy (table_name, frozen_columns, allow_delete, row_filter) VALUES
  ('rti_ncs', ARRAY['descricao','prioridade','recomendacao','area_id','numero','finding_id'], false, NULL),
  ('rti_nc_evidencias', ARRAY['*'], false, $$tipo = 'constatacao'$$),
  ('rti_areas', ARRAY['nome','ordem'], false, NULL)
ON CONFLICT (table_name) DO UPDATE
  SET frozen_columns = EXCLUDED.frozen_columns,
      allow_delete   = EXCLUDED.allow_delete,
      row_filter     = EXCLUDED.row_filter;

-- ---------- 3. Predicado único de bypass (banco + espelho na UI) ----------
-- true se o usuário pode editar registro técnico mesmo selado:
--   dono (platform_admin)  OU  membro (>=member) da org autora/entregadora
--   OU  owner (admin-geral) na própria org do registro.
CREATE OR REPLACE FUNCTION public.fn_can_bypass_seal(
  _uid uuid, _row_org uuid, _entregue_por_org uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_platform_admin(_uid)
    OR (_entregue_por_org IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = _uid AND m.org_id = _entregue_por_org
            AND m.org_role IN ('member','admin','owner')))
    OR EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = _uid AND m.org_id = _row_org
            AND m.org_role = 'owner');
$$;
```

- [ ] **Step 2: Confirmar dependências antes de aplicar**

Run (SQL Editor): confirme que `public.is_platform_admin(uuid)` existe.
```sql
SELECT proname FROM pg_proc WHERE proname = 'is_platform_admin';
```
Expected: 1 linha. (Definida na fundação `20260614000000`.) Se a assinatura for sem argumento, ajuste a chamada em `fn_can_bypass_seal` para `is_platform_admin()`.

- [ ] **Step 3: Aplicar a migration manualmente**

Cole o conteúdo do arquivo no SQL Editor do Supabase e execute.

- [ ] **Step 4: Verificar schema e política**

Run:
```sql
SELECT table_name, frozen_columns, allow_delete, row_filter FROM public.seal_policy ORDER BY table_name;
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='rti_ncs' AND column_name IN ('entregue_em','entregue_por_org');
```
Expected: 3 linhas de política; 2 linhas de colunas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260619000000_seal_schema.sql
git commit -m "feat(seal): schema base do selo de entrega (colunas + seal_policy + bypass)"
```

---

## Task 2: Migration — operação "Entregar"

**Files:**
- Create: `supabase/migrations/20260619001000_seal_entregar_rpc.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- ============================================================================
-- Selo de Entrega — RPC de entrega + cascata para os filhos existentes.
-- Idempotente. Aplicar manualmente no SQL Editor.
-- ============================================================================

-- Entrega um relatório: carimba o root e cascateia o selo para os filhos atuais.
-- Só quem bypassa (consultor/dono/owner) pode entregar. entregue_por_org é a org
-- ativa do ator (a consultoria/empresa que está entregando).
CREATE OR REPLACE FUNCTION public.fn_entregar_rti_report(_report_id uuid, _entregue_por_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _report_org uuid;
  _ts timestamptz := now();
BEGIN
  SELECT org_id INTO _report_org FROM public.rti_reports WHERE id = _report_id;
  IF _report_org IS NULL THEN
    RAISE EXCEPTION 'Relatório % não encontrado', _report_id;
  END IF;

  IF NOT public.fn_can_bypass_seal(_uid, _report_org, _entregue_por_org) THEN
    RAISE EXCEPTION 'Sem permissão para entregar este relatório';
  END IF;

  -- Já entregue? Operação idempotente: não re-carimba.
  IF EXISTS (SELECT 1 FROM public.rti_reports WHERE id = _report_id AND entregue_em IS NOT NULL) THEN
    RETURN;
  END IF;

  UPDATE public.rti_reports
     SET entregue_em = _ts, entregue_por_org = _entregue_por_org
   WHERE id = _report_id;

  UPDATE public.rti_areas
     SET entregue_em = _ts, entregue_por_org = _entregue_por_org
   WHERE report_id = _report_id AND entregue_em IS NULL;

  UPDATE public.rti_ncs
     SET entregue_em = _ts, entregue_por_org = _entregue_por_org
   WHERE report_id = _report_id AND entregue_em IS NULL;

  UPDATE public.rti_nc_evidencias e
     SET entregue_em = _ts, entregue_por_org = _entregue_por_org
   WHERE e.entregue_em IS NULL
     AND e.nc_id IN (SELECT id FROM public.rti_ncs WHERE report_id = _report_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_entregar_rti_report(uuid, uuid) TO authenticated;
```

- [ ] **Step 2: Aplicar a migration manualmente**

Cole no SQL Editor e execute.

- [ ] **Step 3: Verificar (dry-run controlado)**

Escolha um `report_id` de teste cuja org seja um cliente, e a org da consultoria que o gerencia como `_entregue_por_org`. Rode como o usuário consultor (ou via `set request.jwt.claims`); em ambiente de teste basta:
```sql
SELECT public.fn_entregar_rti_report('<REPORT_ID>'::uuid, '<ORG_CONSULTORIA>'::uuid);
SELECT entregue_em, entregue_por_org FROM public.rti_reports WHERE id = '<REPORT_ID>';
SELECT count(*) FILTER (WHERE entregue_em IS NOT NULL) AS ncs_seladas,
       count(*) AS total_ncs
  FROM public.rti_ncs WHERE report_id = '<REPORT_ID>';
```
Expected: root com `entregue_em` preenchido; `ncs_seladas = total_ncs`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260619001000_seal_entregar_rpc.sql
git commit -m "feat(seal): RPC fn_entregar_rti_report com cascata para filhos"
```

---

## Task 3: Migration — triggers de enforcement, provença e auditoria

**Files:**
- Create: `supabase/migrations/20260619002000_seal_enforce_triggers.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- ============================================================================
-- Selo de Entrega — enforcement (UPDATE/DELETE), provença no INSERT, auditoria.
-- Idempotente. Aplicar manualmente no SQL Editor.
-- ============================================================================

-- ---------- 1. Enforcement de colunas congeladas e DELETE ----------
CREATE OR REPLACE FUNCTION public.fn_enforce_seal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pol            public.seal_policy%ROWTYPE;
  _row_org        uuid;
  _entregue_por   uuid;
  _entregue_em    timestamptz;
  _col            text;
  _old_j          jsonb;
  _new_j          jsonb;
  _filter_ok      boolean;
BEGIN
  SELECT * INTO _pol FROM public.seal_policy WHERE table_name = TG_TABLE_NAME;
  IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Linha-alvo: OLD para DELETE/UPDATE.
  _old_j := to_jsonb(OLD);
  _entregue_em  := (_old_j ->> 'entregue_em')::timestamptz;
  IF _entregue_em IS NULL THEN
    RETURN COALESCE(NEW, OLD);  -- não selada: nada a barrar
  END IF;

  _row_org      := (_old_j ->> 'org_id')::uuid;
  _entregue_por := (_old_j ->> 'entregue_por_org')::uuid;

  -- Ator que bypassa o selo passa direto.
  IF public.fn_can_bypass_seal(auth.uid(), _row_org, _entregue_por) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- row_filter: só protege linhas que casam (ex.: evidência de constatação).
  IF _pol.row_filter IS NOT NULL THEN
    EXECUTE format('SELECT (%s)', _pol.row_filter) INTO _filter_ok USING OLD;
    IF _filter_ok IS NOT TRUE THEN RETURN COALESCE(NEW, OLD); END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF _pol.allow_delete THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Registro entregue não pode ser excluído (%).', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  -- UPDATE: rejeita se alguma coluna congelada mudou.
  _new_j := to_jsonb(NEW);
  IF _pol.frozen_columns = ARRAY['*'] THEN
    IF _old_j IS DISTINCT FROM _new_j THEN
      RAISE EXCEPTION 'Registro entregue é somente leitura (%).', TG_TABLE_NAME
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  FOREACH _col IN ARRAY _pol.frozen_columns LOOP
    IF (_old_j ->> _col) IS DISTINCT FROM (_new_j ->> _col) THEN
      RAISE EXCEPTION 'Campo "%" pertence ao registro entregue e não pode ser alterado.', _col
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ---------- 2. Provença no INSERT (filho de relatório já entregue) ----------
-- Se o pai está entregue, um filho novo nasce selado se quem insere é o lado
-- autor (bypassa); se é o admin-padrão do cliente, nasce livre.
CREATE OR REPLACE FUNCTION public.fn_seal_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _parent_table text := TG_ARGV[0];
  _fk_col       text := TG_ARGV[1];
  _fk_val       uuid;
  _p_entregue   timestamptz;
  _p_por_org    uuid;
BEGIN
  IF NEW.entregue_em IS NOT NULL THEN RETURN NEW; END IF;  -- já definido (cascata)
  _fk_val := (to_jsonb(NEW) ->> _fk_col)::uuid;
  IF _fk_val IS NULL THEN RETURN NEW; END IF;

  EXECUTE format('SELECT entregue_em, entregue_por_org FROM public.%I WHERE id = $1', _parent_table)
    INTO _p_entregue, _p_por_org USING _fk_val;

  IF _p_entregue IS NOT NULL
     AND public.fn_can_bypass_seal(auth.uid(), NEW.org_id, _p_por_org) THEN
    NEW.entregue_em := now();
    NEW.entregue_por_org := _p_por_org;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- 3. Auditoria: mutação pós-entrega em NC vira histórico ----------
CREATE OR REPLACE FUNCTION public.fn_seal_audit_nc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.entregue_em IS NOT NULL AND (to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW)) THEN
    INSERT INTO public.rti_nc_historico (nc_id, tipo, texto, autor_nome, org_id)
    VALUES (NEW.id, 'alteracao', 'Alteração após entrega do relatório.',
            NULL, NEW.org_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- 4. Anexa triggers ----------
DO $$
DECLARE
  -- child_table, parent_table, fk_column
  rels text[][] := ARRAY[
    ['rti_areas',         'rti_reports', 'report_id'],
    ['rti_ncs',           'rti_reports', 'report_id'],
    ['rti_nc_evidencias', 'rti_ncs',     'nc_id']
  ];
  i int;
  enforce_tables text[] := ARRAY['rti_ncs','rti_nc_evidencias','rti_areas'];
  t text;
BEGIN
  -- enforcement (UPDATE/DELETE)
  FOREACH t IN ARRAY enforce_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_seal ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_seal BEFORE UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_seal()', t);
  END LOOP;

  -- provença no INSERT
  FOR i IN 1 .. array_length(rels,1) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_seal_on_insert ON public.%I', rels[i][1]);
    EXECUTE format(
      'CREATE TRIGGER trg_seal_on_insert BEFORE INSERT ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.fn_seal_on_insert(%L, %L)',
      rels[i][1], rels[i][2], rels[i][3]);
  END LOOP;

  -- auditoria de NC (depois do enforcement; AFTER UPDATE)
  EXECUTE 'DROP TRIGGER IF EXISTS trg_seal_audit_nc ON public.rti_ncs';
  EXECUTE 'CREATE TRIGGER trg_seal_audit_nc AFTER UPDATE ON public.rti_ncs '
          'FOR EACH ROW EXECUTE FUNCTION public.fn_seal_audit_nc()';
END $$;
```

- [ ] **Step 2: Confirmar colunas usadas na auditoria**

Run: confirme que `rti_nc_historico` tem as colunas usadas no INSERT.
```sql
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='rti_nc_historico'
   AND column_name IN ('nc_id','tipo','texto','autor_nome','org_id');
```
Expected: as 5 colunas. Se `org_id` não existir aqui, remova-a do INSERT em `fn_seal_audit_nc` (o trigger de herança preenche).

- [ ] **Step 3: Aplicar a migration manualmente** (SQL Editor).

- [ ] **Step 4: Verificar enforcement (em relatório de teste já entregue na Task 2)**

Como **admin-padrão do cliente** (sessão do usuário cliente), tente alterar coluna congelada e operacional:
```sql
-- Deve FALHAR (check_violation): prioridade é congelada
UPDATE public.rti_ncs SET prioridade = 99 WHERE report_id = '<REPORT_ID>' LIMIT 1;
-- Deve PASSAR: prazo é operacional
UPDATE public.rti_ncs SET prazo = '2026-12-31' WHERE report_id = '<REPORT_ID>';
-- DELETE de NC entregue deve FALHAR
DELETE FROM public.rti_ncs WHERE report_id = '<REPORT_ID>' LIMIT 1;
```
Expected: 1º e 3º erram com `check_violation`; 2º grava e gera linha em `rti_nc_historico` (tipo `alteracao`). Como **consultor/dono** (bypass), os três passam.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260619002000_seal_enforce_triggers.sql
git commit -m "feat(seal): triggers de enforcement, provença no insert e auditoria"
```

---

## Task 4: types.ts + tipos do domínio RTI

**Files:**
- Modify: `src/integrations/supabase/types.ts`
- Modify: `src/lib/rti.ts:68-126`

- [ ] **Step 1: Adicionar colunas em `rti.ts` (tipos do domínio)**

Em `src/lib/rti.ts`, acrescente os dois campos em cada tipo. No `RtiReport` (após `updated_at: string;` na linha ~81):
```ts
  entregue_em: string | null;
  entregue_por_org: string | null;
```
Repita o mesmo par de campos em `RtiArea` (após `created_at`), `RtiNc` (após `updated_at`) e `RtiNcEvidencia` (após `created_at`).

- [ ] **Step 2: Refletir em `types.ts` (mantido à mão)**

Em `src/integrations/supabase/types.ts`, nas definições `Row`/`Insert`/`Update` de `rti_reports`, `rti_areas`, `rti_ncs`, `rti_nc_evidencias`, adicione:
```ts
        entregue_em: string | null
        entregue_por_org: string | null
```
(`Row`: `string | null`; `Insert`/`Update`: `string | null` opcional — `entregue_em?: string | null`.)

- [ ] **Step 3: Verificar build de tipos**

Run: `npx tsc --noEmit`
Expected: sem **novos** erros relacionados a `entregue_em`/`entregue_por_org` (erros pré-existentes são conhecidos e ignorados).

- [ ] **Step 4: Commit**

```bash
git add src/lib/rti.ts src/integrations/supabase/types.ts
git commit -m "feat(seal): tipos entregue_em/entregue_por_org nas tabelas RTI"
```

---

## Task 5: Gate por registro — `getRecordAccess` (TDD)

**Files:**
- Modify: `src/lib/tenancy-gates.ts`
- Test: `src/lib/__tests__/tenancy-gates.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao final de `src/lib/__tests__/tenancy-gates.test.ts` (antes do `});` final do arquivo? não — é um novo `describe` no nível raiz, após o `describe` existente):
```ts
import { getRecordAccess } from "../tenancy-gates";

const RANK = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;
type R = keyof typeof RANK;

const sealCtx = ({
  isStaff = false,
  isPlatformAdmin = false,
  entitlements = ["rti_pwa"],
  direct = null,
  manager = null,
  memberships = {},
}: {
  isStaff?: boolean;
  isPlatformAdmin?: boolean;
  entitlements?: string[];
  direct?: R | null;
  manager?: R | null;
  memberships?: Record<string, R>;
}) => ({
  isStaff,
  isPlatformAdmin,
  hasEntitlement: (m: string) => entitlements.includes(m),
  directOrgRole: direct,
  managerOrgRole: manager,
  roleInOrg: (orgId: string) => memberships[orgId] ?? null,
});

const sealed = { entregue_em: "2026-06-19T00:00:00Z", entregue_por_org: "consultoria-1" };
const rascunho = { entregue_em: null, entregue_por_org: null };

describe("getRecordAccess", () => {
  it("admin-padrão do cliente: edita rotina, NÃO edita técnico nem entrega (selado)", () => {
    const a = getRecordAccess(sealCtx({ direct: "admin" }), sealed);
    expect(a.canView).toBe(true);
    expect(a.canEditOperacional).toBe(true);
    expect(a.canEditTecnico).toBe(false);
    expect(a.canDelete).toBe(false);
    expect(a.canEntregar).toBe(false);
  });

  it("admin-geral (owner) do cliente: bypassa o selo", () => {
    const a = getRecordAccess(sealCtx({ direct: "owner" }), sealed);
    expect(a.canEditTecnico).toBe(true);
    expect(a.canDelete).toBe(true);
  });

  it("consultor (membro da org autora): bypassa o selo e pode entregar rascunho", () => {
    const a = getRecordAccess(
      sealCtx({ direct: "member", manager: "owner", memberships: { "consultoria-1": "owner" } }),
      sealed,
    );
    expect(a.canEditTecnico).toBe(true);
    const draft = getRecordAccess(
      sealCtx({ manager: "owner" }),
      rascunho,
    );
    expect(draft.canEntregar).toBe(true);
  });

  it("dono (platform admin): bypassa tudo", () => {
    const a = getRecordAccess(sealCtx({ isPlatformAdmin: true }), sealed);
    expect(a.canEditTecnico).toBe(true);
    expect(a.canEntregar).toBe(false); // já entregue
  });

  it("viewer: só lê", () => {
    const a = getRecordAccess(sealCtx({ direct: "viewer" }), sealed);
    expect(a.canEditOperacional).toBe(false);
    expect(a.canEditTecnico).toBe(false);
  });

  it("relatório em rascunho: admin-padrão edita técnico (sem selo)", () => {
    const a = getRecordAccess(sealCtx({ direct: "admin" }), rascunho);
    expect(a.canEditTecnico).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/tenancy-gates.test.ts`
Expected: FAIL — `getRecordAccess` não existe.

- [ ] **Step 3: Implementar `getRecordAccess`**

Em `src/lib/tenancy-gates.ts`, após o `getRtiCampoAccess` existente, acrescente:
```ts
const ORG_RANK: Record<OrgRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };
const rank = (r: OrgRole | null): number => (r ? ORG_RANK[r] : 0);

export type SealActor = {
  isStaff: boolean;
  isPlatformAdmin: boolean;
  hasEntitlement: (module: string) => boolean;
  /** papel direto na org DO registro (a org-cliente dona) */
  directOrgRole: OrgRole | null;
  /** maior papel na cadeia gestora (managed_by/parent) — o consultor */
  managerOrgRole: OrgRole | null;
  /** papel direto numa org arbitrária (para entregue_por_org) */
  roleInOrg: (orgId: string) => OrgRole | null;
};

export type SealedRecord = {
  entregue_em: string | null;
  entregue_por_org: string | null;
};

export type RecordAccess = {
  canView: boolean;
  canEditOperacional: boolean;
  canEditTecnico: boolean;
  canDelete: boolean;
  canEntregar: boolean;
  sealed: boolean;
};

export function getRecordAccess(ctx: SealActor, record: SealedRecord): RecordAccess {
  const hasRti = ctx.hasEntitlement("rti_pwa") || ctx.hasEntitlement("gestao_completa");
  const canView = ctx.isStaff || ctx.isPlatformAdmin || hasRti;

  const editRank = Math.max(rank(ctx.directOrgRole), rank(ctx.managerOrgRole));
  const canEditModule = canView && (ctx.isStaff || ctx.isPlatformAdmin || editRank >= ORG_RANK.member);

  const authorRank = record.entregue_por_org ? rank(ctx.roleInOrg(record.entregue_por_org)) : 0;
  const canBypass =
    ctx.isStaff ||
    ctx.isPlatformAdmin ||
    rank(ctx.directOrgRole) >= ORG_RANK.owner ||
    rank(ctx.managerOrgRole) >= ORG_RANK.member ||
    authorRank >= ORG_RANK.member;

  const sealed = record.entregue_em != null;

  return {
    canView,
    canEditOperacional: canEditModule,
    canEditTecnico: canEditModule && (!sealed || canBypass),
    canDelete: canEditModule && (!sealed || canBypass),
    canEntregar: canView && !sealed && canBypass,
    sealed,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/tenancy-gates.test.ts`
Expected: PASS (6 testes antigos + 6 novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tenancy-gates.ts src/lib/__tests__/tenancy-gates.test.ts
git commit -m "feat(seal): getRecordAccess (técnico × operacional × entregar) com testes"
```

---

## Task 6: auth-context — expor `managerOrgRole` e `roleInOrg`

**Files:**
- Modify: `src/lib/auth-context.tsx`

- [ ] **Step 1: Adicionar os campos à interface `AuthState`**

Em `src/lib/auth-context.tsx`, na interface `AuthState` (após `orgRole: OrgRole | null;`, linha ~52):
```ts
  managerOrgRole: OrgRole | null;
  roleInOrg: (orgId: string) => OrgRole | null;
```

- [ ] **Step 2: Computar `managerOrgRole`**

Após a linha `const orgRole = roleInOrg(currentOrgId);` (linha ~188), acrescente:
```ts
  // Maior papel na cadeia que GERENCIA a org ativa (consultor via managed_by /
  // org-mãe via parent). Distingue "consultor" do "admin do próprio cliente".
  const managerOrgRole: OrgRole | null = (() => {
    const candidates: (OrgRole | null)[] = [
      roleInOrg(currentOrg?.managed_by_org_id),
      roleInOrg(currentOrg?.parent_org_id),
    ];
    return candidates.reduce<OrgRole | null>((best, r) => {
      if (!r) return best;
      if (!best) return r;
      return ORG_ROLE_RANK[r] > ORG_ROLE_RANK[best] ? r : best;
    }, null);
  })();
```
Nota: `roleInOrg` já aceita `null/undefined` (retorna `null`). A assinatura atual é `(orgId: string | null | undefined)`; mantenha-a — ao expor no contexto, tipamos como `(orgId: string) => OrgRole | null`, compatível.

- [ ] **Step 3: Expor no provider value**

No objeto passado ao `AuthContext.Provider` (após `orgRole,`, linha ~236):
```ts
        managerOrgRole,
        roleInOrg,
```

- [ ] **Step 4: Verificar build**

Run: `npx tsc --noEmit`
Expected: sem novos erros referentes a `managerOrgRole`/`roleInOrg`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-context.tsx
git commit -m "feat(seal): expõe managerOrgRole e roleInOrg no auth-context"
```

---

## Task 7: rti-queries — `useEntregarRtiReport`

**Files:**
- Modify: `src/lib/rti-queries.ts`

- [ ] **Step 1: Adicionar o hook de entrega**

Em `src/lib/rti-queries.ts`, após `useUpsertRtiReport` (linha ~73), adicione:
```ts
export function useEntregarRtiReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, orgId }: { reportId: string; orgId: string }) => {
      const { error } = await supabase.rpc("fn_entregar_rti_report", {
        _report_id: reportId,
        _entregue_por_org: orgId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rti-reports"] });
      qc.invalidateQueries({ queryKey: ["rti-ncs"] });
    },
  });
}
```
Nota: confirme os `queryKey` reais consultando `useRtiReports`/`useRtiNcs` no mesmo arquivo e ajuste se diferirem. Se `supabase.rpc` reclamar de tipo (types.ts não declara a função), use `(supabase as any).rpc(...)` — segue o padrão de acesso não-tipado já usado no projeto para superfícies novas.

- [ ] **Step 2: Verificar build**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rti-queries.ts
git commit -m "feat(seal): hook useEntregarRtiReport (RPC)"
```

---

## Task 8: admin.usuarios — seletor de nível 2 → 3

**Files:**
- Modify: `src/routes/admin.usuarios.tsx:68` (tipo), `:592-600` e `:718-726` (selects), default de edição `:646`

- [ ] **Step 1: Ampliar o tipo de nível**

Em `src/routes/admin.usuarios.tsx:68`, troque:
```ts
type ClientOrgRole = Extract<OrgRole, "admin" | "viewer">;
```
por:
```ts
type ClientOrgRole = Extract<OrgRole, "owner" | "admin" | "viewer">;
```

- [ ] **Step 2: Adicionar a 3ª opção nos dois `Select` de nível**

No `CreateUserDialog` (bloco `:592-600`) e no `EditUserDialog` (bloco `:718-726`), o `SelectContent` de orgRole deve ficar:
```tsx
                <SelectContent>
                  <SelectItem value="owner">Admin geral (acesso total)</SelectItem>
                  <SelectItem value="admin">Admin padrão (gestão de rotina)</SelectItem>
                  <SelectItem value="viewer">Visualização (somente leitura)</SelectItem>
                </SelectContent>
```

- [ ] **Step 3: Normalizar o default ao editar (preservar owner)**

No `EditUserDialog`, na linha ~646 que hoje faz:
```ts
      setOrgRole(row.org_role === "admin" ? "admin" : "viewer");
```
troque por:
```ts
      setOrgRole(
        row.org_role === "owner" ? "owner" : row.org_role === "admin" ? "admin" : "viewer",
      );
```
(Valores legados `member` caem em `viewer` no seletor; salvar normaliza.)

- [ ] **Step 4: Verificar build**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin.usuarios.tsx
git commit -m "feat(seal): seletor de nível com 3 papéis (admin geral/padrão/visualização)"
```

---

## Task 9: UI do RTI — gate por registro, botão Entregar e badge

**Files:**
- Modify: `src/routes/rti.plano.tsx` (botão Entregar + badge no relatório ativo)
- Modify: `src/routes/rti.nc.$ncId.tsx` (gate técnico × operacional nos campos da NC)

Contexto: hoje ambas as telas derivam um único `canEdit` de `getRtiCampoAccess(auth)`. Vamos manter `canEdit` para o que é operacional/módulo e introduzir `getRecordAccess` para diferenciar **técnico × operacional** quando há um registro carregado.

Mapa de classificação dos campos da NC (use para decidir qual gate aplica a cada input):

| Campo da NC | Classe → gate |
|---|---|
| `descricao`, `prioridade` (criticidade), `recomendacao`, área, `numero` | **técnico** → `canEditTecnico` |
| `prazo`, `custo_planejado`, `custo_realizado`, `status`, `progresso`, `situacao_atual`, `responsavel`, `tipo_execucao`, `os_numero` | **operacional** → `canEditOperacional` |
| evidência `constatacao` (excluir/editar) | **técnico** → `canEditTecnico` |
| evidência `correcao` (adicionar/editar/excluir) | **operacional** → `canEditOperacional` |
| excluir a NC | `canDelete` |

- [ ] **Step 1: Helper de contexto para o gate (montar `SealActor`)**

Em `src/routes/rti.nc.$ncId.tsx`, perto de onde `auth` é usado (linha ~80), monte o ator do selo a partir do `auth`:
```ts
import { getRecordAccess, type SealActor } from "@/lib/tenancy-gates";
// ...
const sealActor: SealActor = {
  isStaff: auth.isStaff,
  isPlatformAdmin: auth.isPlatformAdmin,
  hasEntitlement: auth.hasEntitlement,
  directOrgRole: auth.orgRole,
  managerOrgRole: auth.managerOrgRole,
  roleInOrg: auth.roleInOrg,
};
const acc = getRecordAccess(sealActor, {
  entregue_em: nc?.entregue_em ?? null,
  entregue_por_org: nc?.entregue_por_org ?? null,
});
const canEditTecnico = acc.canEditTecnico;
const canEditOperacional = acc.canEditOperacional;
const canDelete = acc.canDelete;
```
Mantenha o `canEdit` legado de `getRtiCampoAccess` para gates de visualização do módulo onde não há registro.

- [ ] **Step 2: Aplicar os gates aos inputs da NC**

Para cada input/controle, troque o `canEdit` pelo gate da classe correspondente (tabela acima). Inputs técnicos: `disabled={!canEditTecnico}`; operacionais: `disabled={!canEditOperacional}`. Botão excluir NC: `disabled={!canDelete}`. Onde a NC está selada e o campo é técnico (`acc.sealed && !canEditTecnico`), exiba o controle em modo leitura com tooltip:
```tsx
title="Registro entregue pelo consultor — somente leitura"
```
As props `canEdit` passadas a `DadosCard`/`GestaoCard`/`EvidenciasCard` (linhas ~236-256) devem receber o gate certo: `DadosCard` (técnico) → `canEdit={canEditTecnico}`; `GestaoCard` (operacional) → `canEdit={canEditOperacional}`; evidências precisam dos dois (passe ambos e decida por `tipo`).

- [ ] **Step 3: Badge "Entregue em" + botão Entregar em `rti.plano.tsx`**

Em `src/routes/rti.plano.tsx`, onde `activeReport` é renderizado (header do relatório ativo, perto da linha ~332), adicione:
```tsx
import { getRecordAccess, type SealActor } from "@/lib/tenancy-gates";
import { useEntregarRtiReport } from "@/lib/rti-queries";
import { formatDatePtBR } from "@/lib/format"; // confirme o caminho real do helper
// ...
const entregar = useEntregarRtiReport();
const sealActor: SealActor = {
  isStaff: auth.isStaff,
  isPlatformAdmin: auth.isPlatformAdmin,
  hasEntitlement: auth.hasEntitlement,
  directOrgRole: auth.orgRole,
  managerOrgRole: auth.managerOrgRole,
  roleInOrg: auth.roleInOrg,
};
const repAcc = activeReport
  ? getRecordAccess(sealActor, {
      entregue_em: activeReport.entregue_em,
      entregue_por_org: activeReport.entregue_por_org,
    })
  : null;
```
E no JSX do header do relatório:
```tsx
{activeReport?.entregue_em && (
  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
    Entregue em {formatDatePtBR(activeReport.entregue_em)}
  </span>
)}
{repAcc?.canEntregar && activeReport && auth.currentOrgId && (
  <Button
    type="button"
    variant="outline"
    size="sm"
    disabled={entregar.isPending}
    onClick={() => {
      if (
        window.confirm(
          "Após entregar, o cliente não poderá mais alterar o registro técnico " +
            "(criticidade, recomendações, evidências de constatação) deste relatório. Continuar?",
        )
      ) {
        entregar.mutate({ reportId: activeReport.id, orgId: auth.currentOrgId! });
      }
    }}
  >
    {entregar.isPending ? "Entregando…" : "Entregar relatório"}
  </Button>
)}
```
Nota: `auth.currentOrgId` é a org ativa do ator. Para o consultor, ela deve ser a **consultoria** (org autora) no momento da entrega — confirme em teste que `entregue_por_org` ficou correto; se o fluxo do consultor operar dentro da org-cliente, use `auth.currentOrg?.managed_by_org_id ?? auth.currentOrgId` como `orgId`.

- [ ] **Step 4: Verificar build**

Run: `npx tsc --noEmit`
Expected: sem novos erros referentes às mudanças (erros pré-existentes ignorados).

- [ ] **Step 5: Verificação manual no app**

Rode o app. Com usuário **admin-padrão** do cliente, num relatório **entregue**: campos técnicos aparecem desabilitados/somente-leitura; prazo/custo/andamento editáveis; sem botão Entregar; sem excluir NC entregue. Com **consultor/dono**: tudo editável + botão "Entregar relatório" some após entregar e vira badge "Entregue em …".

- [ ] **Step 6: Commit**

```bash
git add src/routes/rti.plano.tsx src/routes/rti.nc.$ncId.tsx
git commit -m "feat(seal): UI RTI — gate técnico×operacional, botão Entregar e badge"
```

---

## Self-Review (preenchido)

- **Cobertura do spec:**
  - A. Modelo de papéis → Task 8 (seletor 3 níveis) + gate em Task 5.
  - B1 selo no root → Task 1; B2 seal_policy → Task 1; B3 enforce → Task 3; B4 provença INSERT → Task 3; B5 bypass → Task 1 (banco) + Task 5 (espelho UI via Task 6).
  - C. política de congelamento RTI → Task 1 (seed `seal_policy`) + Task 9 (classificação na UI).
  - D. UI (botão Entregar, badge, read-only) → Task 9; generalização `getRecordAccess` → Task 5.
  - E. enforcement 2 níveis → Task 3 (banco) + Task 9 (UI); auditoria → Task 3 (`fn_seal_audit_nc`).
- **Placeholders:** nenhum "TBD/TODO"; pontos marcados como "confirme o caminho/queryKey" são verificações pontuais com fallback explícito, não lacunas de design.
- **Consistência de tipos:** `SealActor`/`SealedRecord`/`RecordAccess` definidos na Task 5 e consumidos idênticos nas Tasks 6/9; `fn_can_bypass_seal(uid,row_org,entregue_por_org)` com a mesma assinatura nas Tasks 1/2/3; `fn_entregar_rti_report(_report_id,_entregue_por_org)` igual na Task 2 (RPC) e Task 7 (hook).
- **Riscos conhecidos:** caminhos de helper de data (`formatDatePtBR`) e `queryKey` reais precisam de confirmação no arquivo — instruções já trazem o fallback.
