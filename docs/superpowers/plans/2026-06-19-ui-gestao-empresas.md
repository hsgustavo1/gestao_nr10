# UI de Gestão de Empresas (orgs) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao dono do app (platform admin) uma tela para criar/editar/desativar empresas (consultorias, clientes, unidades) e definir entitlements, e ao consultor uma versão escopada da mesma tela para gerenciar a carteira dele.

**Architecture:** Backend = 4 RPCs `SECURITY DEFINER` (autz própria) + coluna `organizations.ativa` + reforço do `can_access_org` (desativação imposta no banco). Frontend = nova rota `/admin/empresas` (TanStack flat route) com árvore hierárquica + wizard de 4 passos (4º opcional via edge `admin-users`) + painel de edição. Acesso de UI por gate puro testável; a barreira real é o RLS/RPC no banco.

**Tech Stack:** TanStack Start/Router, React 19, shadcn/ui, Tailwind, Supabase (PostgreSQL + RLS), Vitest. Tabelas de tenancy acessadas via wrapper não-tipado isolado (mesmo padrão de `auth-context.tsx`, pois `types.ts` é mantido à mão).

**Spec de referência:** `docs/superpowers/specs/2026-06-19-ui-gestao-empresas-design.md`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `supabase/migrations/20260619000000_empresas_management.sql` | Coluna `ativa`, reforço de `can_access_org`, 4 RPCs + GRANTs | Criar |
| `supabase/tests/empresas_rpc_test.sql` | Teste manual de autz das RPCs + regressão de desativação | Criar |
| `src/lib/org-tree.ts` | `buildOrgTree()` genérico (extraído de `site-header.tsx`, compartilhado) | Criar |
| `src/components/site-header.tsx` | Importar `buildOrgTree` do novo módulo; adicionar item de menu "Gestão de empresas" | Modificar |
| `src/lib/tenancy-gates.ts` | Adicionar `getEmpresaAdminAccess()` (gate puro) | Modificar |
| `src/lib/__tests__/tenancy-gates.test.ts` | Testes do novo gate | Modificar |
| `src/lib/empresas-queries.ts` | Camada de dados: `fetchEmpresas` + wrappers das 4 RPCs (acesso não-tipado isolado) | Criar |
| `src/routes/admin.empresas.tsx` | Página: árvore + wizard + painel de edição | Criar |

**Nota sobre `types.ts` (decisão de implementação):** a spec (§3.4) sugeria regenerar `types.ts` à mão para tipar as tabelas de tenancy. O `types.ts` é grande e mantido à mão, e as RPCs não aparecem nele de qualquer forma. O plano cumpre a intenção da spec (chamadas tipadas nos pontos de uso) **isolando** o acesso não-tipado em `empresas-queries.ts` — exatamente o padrão já documentado em `auth-context.tsx` (`const sb = supabase as unknown as …`). A regeneração completa de `types.ts` fica fora do escopo deste plano por ser frágil e não trazer ganho no caminho tocado.

---

## Task 1: Migração — coluna `ativa`, reforço de `can_access_org`, RPCs

**Files:**
- Create: `supabase/migrations/20260619000000_empresas_management.sql`

> Convenção do projeto (atualizada 2026-06-19): migrations são aplicadas via **MCP do Supabase** (`apply_migration`) no projeto `fumwovtzyhxrjhkjzujs`. O arquivo `.sql` continua versionado em `supabase/migrations/`. A verificação roda via `execute_sql` (Task 2).

- [ ] **Step 1: Escrever a migração completa**

Crie `supabase/migrations/20260619000000_empresas_management.sql` com exatamente este conteúdo:

```sql
-- ============================================================================
-- GESTÃO DE EMPRESAS — coluna `ativa`, desativação imposta no RLS, RPCs de CRUD
-- ----------------------------------------------------------------------------
-- Migration ADITIVA e idempotente. Aplicar manualmente no SQL Editor do Supabase.
-- Depende de 20260614000000_multitenancy_foundation.sql.
-- ============================================================================

-- ---------- 1. Coluna de status (soft-deactivate) ----------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ativa boolean NOT NULL DEFAULT true;

-- ---------- 2. can_access_org passa a exigir org-alvo ATIVA ----------
-- platform admin faz bypass (enxerga inativas para reativar). Para os demais,
-- o acesso só vale se a org-alvo estiver ativa. Esta é a função-base do RLS de
-- TODAS as tabelas de domínio — ver teste de regressão em empresas_rpc_test.sql.
CREATE OR REPLACE FUNCTION public.can_access_org(_uid uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_platform_admin(_uid)
    OR (
      EXISTS (SELECT 1 FROM public.organizations oa WHERE oa.id = _org_id AND oa.ativa)
      AND (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = _uid AND m.org_id = _org_id)
        OR EXISTS (
          SELECT 1 FROM public.org_memberships m
          JOIN public.organizations o ON o.parent_org_id = m.org_id
          WHERE m.user_id = _uid AND o.id = _org_id)
        OR EXISTS (
          SELECT 1 FROM public.org_memberships m
          JOIN public.organizations o ON o.managed_by_org_id = m.org_id
          WHERE m.user_id = _uid AND o.id = _org_id)
      )
    );
$$;

-- ---------- 3. RPCs SECURITY DEFINER (autz própria via auth.uid()) ----------

-- 3a. Criar org + entitlements numa transação. Só platform admin.
CREATE OR REPLACE FUNCTION public.fn_create_org(
  p_nome text,
  p_tipo public.org_tipo,
  p_managed_by uuid,
  p_parent uuid,
  p_entitlements text[]
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new_id uuid; _ent text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF coalesce(btrim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'nome obrigatório';
  END IF;
  IF p_tipo = 'unidade' AND p_parent IS NULL THEN
    RAISE EXCEPTION 'unidade requer empresa-mãe';
  END IF;
  IF p_entitlements IS NOT NULL THEN
    FOREACH _ent IN ARRAY p_entitlements LOOP
      IF _ent NOT IN ('gestao_completa', 'rti_pwa', 'loto') THEN
        RAISE EXCEPTION 'entitlement inválido: %', _ent;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.organizations (nome, tipo, managed_by_org_id, parent_org_id)
  VALUES (
    btrim(p_nome),
    p_tipo,
    CASE WHEN p_tipo = 'cliente'  THEN p_managed_by ELSE NULL END,
    CASE WHEN p_tipo = 'unidade'  THEN p_parent     ELSE NULL END
  )
  RETURNING id INTO _new_id;

  IF p_entitlements IS NOT NULL THEN
    INSERT INTO public.org_entitlements (org_id, module)
    SELECT _new_id, unnest(p_entitlements)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN _new_id;
END;
$$;

-- 3b. Editar nome/vínculo. Platform admin OU consultor admin na consultoria
-- gestora. Consultor só renomeia; troca de vínculo é exclusiva do platform admin.
CREATE OR REPLACE FUNCTION public.fn_update_org(
  p_org uuid,
  p_nome text,
  p_managed_by uuid,
  p_parent uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tipo public.org_tipo; _is_pa boolean := public.is_platform_admin(auth.uid());
BEGIN
  SELECT tipo INTO _tipo FROM public.organizations WHERE id = p_org;
  IF _tipo IS NULL THEN
    RAISE EXCEPTION 'empresa não encontrada';
  END IF;
  IF NOT _is_pa THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org
        AND o.managed_by_org_id IS NOT NULL
        AND public.org_role_at_least(auth.uid(), o.managed_by_org_id, 'admin')
    ) THEN
      RAISE EXCEPTION 'sem permissão';
    END IF;
  END IF;
  IF coalesce(btrim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'nome obrigatório';
  END IF;

  IF _is_pa THEN
    UPDATE public.organizations
    SET nome = btrim(p_nome),
        managed_by_org_id = CASE WHEN _tipo = 'cliente' THEN p_managed_by ELSE managed_by_org_id END,
        parent_org_id     = CASE WHEN _tipo = 'unidade' THEN p_parent     ELSE parent_org_id END
    WHERE id = p_org;
  ELSE
    UPDATE public.organizations SET nome = btrim(p_nome) WHERE id = p_org;
  END IF;
END;
$$;

-- 3c. Substituir o conjunto de entitlements. Só platform admin.
CREATE OR REPLACE FUNCTION public.fn_set_org_entitlements(
  p_org uuid,
  p_entitlements text[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ent text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF p_entitlements IS NOT NULL THEN
    FOREACH _ent IN ARRAY p_entitlements LOOP
      IF _ent NOT IN ('gestao_completa', 'rti_pwa', 'loto') THEN
        RAISE EXCEPTION 'entitlement inválido: %', _ent;
      END IF;
    END LOOP;
  END IF;
  DELETE FROM public.org_entitlements WHERE org_id = p_org;
  IF p_entitlements IS NOT NULL THEN
    INSERT INTO public.org_entitlements (org_id, module)
    SELECT p_org, unnest(p_entitlements)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- 3d. Ativar/desativar (soft). Só platform admin (decisão comercial).
CREATE OR REPLACE FUNCTION public.fn_set_org_active(
  p_org uuid,
  p_ativa boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  UPDATE public.organizations SET ativa = p_ativa WHERE id = p_org;
END;
$$;

-- ---------- 4. GRANTs (chamáveis pelo usuário autenticado; a autz é interna) ----------
GRANT EXECUTE ON FUNCTION public.fn_create_org(text, public.org_tipo, uuid, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_update_org(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_set_org_entitlements(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_set_org_active(uuid, boolean) TO authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260619000000_empresas_management.sql
git commit -m "feat(empresas): migration — coluna ativa, reforço can_access_org e RPCs de CRUD de orgs"
```

---

## Task 2: Teste manual de autorização das RPCs (SQL)

**Files:**
- Create: `supabase/tests/empresas_rpc_test.sql`

Espelha `supabase/tests/fase2_isolation_test.sql` (script colável no SQL Editor que retorna uma tabela de resultados).

- [ ] **Step 1: Escrever o teste**

Crie `supabase/tests/empresas_rpc_test.sql` com este conteúdo:

```sql
-- ============================================================================
-- Teste de autorização das RPCs de gestão de empresas + regressão de desativação
-- ----------------------------------------------------------------------------
-- Roda 100% no SQL Editor (WEB) do Supabase. Cole os 5 UUIDs reais abaixo e
-- execute TODO o script de uma vez. Retorna 1 tabela; coluna `passou` = true
-- significa que a RPC se comportou como esperado.
--
-- Pré-requisitos (use a seed 20260614020000 ou crie manualmente):
--   pa        = platform admin (linha em platform_admins)
--   cons      = usuário admin (org_role='admin') NA consultoria `consorg`
--   cliA      = usuário admin (org_role='admin') no cliente `cliA_org`
--   consorg   = id da consultoria que GERENCIA cliA_org (managed_by_org_id)
--   cliA_org  = id de um cliente gerido por consorg
--
-- RESULTADO ESPERADO: todas as linhas com passou = true.
-- ============================================================================

CREATE TEMP TABLE _r(cenario text, esperado text, obtido text, passou boolean) ON COMMIT DROP;

DO $$
DECLARE
  pa       uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  cons     uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  cliA     uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  consorg  uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  cliA_org uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  v uuid;
BEGIN
  -- 1. platform admin cria consultoria -> sucesso
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pa)::text, true);
  BEGIN
    v := public.fn_create_org('Teste Cons (apagar)', 'consultoria', NULL, NULL, ARRAY['rti_pwa']);
    DELETE FROM public.organizations WHERE id = v;  -- limpa
    INSERT INTO _r VALUES ('1 PA cria consultoria', 'sucesso', 'sucesso', true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('1 PA cria consultoria', 'sucesso', 'erro: ' || SQLERRM, false);
  END;

  -- 2. consultor NÃO cria empresa -> exceção
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cons)::text, true);
  BEGIN
    v := public.fn_create_org('Hack', 'cliente', consorg, NULL, ARRAY['rti_pwa']);
    DELETE FROM public.organizations WHERE id = v;
    INSERT INTO _r VALUES ('2 consultor cria empresa', 'erro', 'sucesso (FURO!)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('2 consultor cria empresa', 'erro', 'erro: ' || SQLERRM, true);
  END;

  -- 3. consultor edita nome do cliente gerido -> sucesso
  BEGIN
    PERFORM public.fn_update_org(cliA_org, 'Cliente A (renomeado pelo teste)', NULL, NULL);
    INSERT INTO _r VALUES ('3 consultor edita cliente gerido', 'sucesso', 'sucesso', true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('3 consultor edita cliente gerido', 'sucesso', 'erro: ' || SQLERRM, false);
  END;

  -- 4. consultor NÃO altera entitlements -> exceção
  BEGIN
    PERFORM public.fn_set_org_entitlements(cliA_org, ARRAY['loto']);
    INSERT INTO _r VALUES ('4 consultor altera entitlements', 'erro', 'sucesso (FURO!)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('4 consultor altera entitlements', 'erro', 'erro: ' || SQLERRM, true);
  END;

  -- 5. consultor NÃO desativa -> exceção
  BEGIN
    PERFORM public.fn_set_org_active(cliA_org, false);
    INSERT INTO _r VALUES ('5 consultor desativa empresa', 'erro', 'sucesso (FURO!)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('5 consultor desativa empresa', 'erro', 'erro: ' || SQLERRM, true);
  END;

  -- 6. admin do próprio cliente (não consultor) NÃO edita a org -> exceção
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cliA)::text, true);
  BEGIN
    PERFORM public.fn_update_org(cliA_org, 'Hack pelo cliente', NULL, NULL);
    INSERT INTO _r VALUES ('6 admin-cliente edita própria org', 'erro', 'sucesso (FURO!)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('6 admin-cliente edita própria org', 'erro', 'erro: ' || SQLERRM, true);
  END;

  -- 7. regressão: cliente desativado some para o membro, persiste p/ platform admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pa)::text, true);
  PERFORM public.fn_set_org_active(cliA_org, false);
  INSERT INTO _r VALUES (
    '7a desativado: membro perde acesso', 'false',
    public.can_access_org(cliA, cliA_org)::text,
    public.can_access_org(cliA, cliA_org) = false
  );
  INSERT INTO _r VALUES (
    '7b desativado: platform admin mantém', 'true',
    public.can_access_org(pa, cliA_org)::text,
    public.can_access_org(pa, cliA_org) = true
  );
  PERFORM public.fn_set_org_active(cliA_org, true);  -- restaura
END $$;

SELECT * FROM _r ORDER BY cenario;
```

- [ ] **Step 2: Aplicar via MCP e rodar o teste**

Aplicar a migração da Task 1 via `apply_migration`. Rodar este teste via `execute_sql` (resolvendo os 5 UUIDs reais a partir do banco — platform admin, consultor demo, cliente demo e as orgs correspondentes).
Esperado: a tabela retornada tem **todas as linhas com `passou = true`**.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/empresas_rpc_test.sql
git commit -m "test(empresas): autz das RPCs + regressão de desativação no can_access_org"
```

---

## Task 3: Extrair `buildOrgTree` para módulo compartilhado

`buildOrgTree` hoje é uma função privada em `src/components/site-header.tsx`. A árvore de empresas precisa da mesma lógica. Extrair para `src/lib/org-tree.ts` (genérica) e fazer o `site-header` importar — DRY, sem duplicar.

**Files:**
- Create: `src/lib/org-tree.ts`
- Modify: `src/components/site-header.tsx:386-407` (remover cópia local) e `:13` (import)

- [ ] **Step 1: Criar o módulo compartilhado**

Crie `src/lib/org-tree.ts`:

```ts
import type { Org } from "@/lib/auth-context";

/** Achata as orgs acessíveis numa lista ordenada com profundidade, montando a
 * hierarquia: consultoria → clientes gerenciados (managed_by) e empresa-mãe →
 * unidades (parent). Tolerante a ciclos/órfãos. Genérica para aceitar linhas
 * que estendem Org (ex.: com `ativa` e entitlements). */
export function buildOrgTree<T extends Org>(orgs: T[]): { org: T; depth: number }[] {
  const parentIdOf = (o: Org) => o.managed_by_org_id ?? o.parent_org_id ?? null;
  const hasVisibleParent = (o: Org) => {
    const pid = parentIdOf(o);
    return pid !== null && orgs.some((p) => p.id === pid);
  };
  const childrenOf = (id: string) => orgs.filter((o) => o.id !== id && parentIdOf(o) === id);
  const out: { org: T; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (o: T, depth: number) => {
    if (seen.has(o.id)) return;
    seen.add(o.id);
    out.push({ org: o, depth });
    for (const c of childrenOf(o.id)) walk(c, depth + 1);
  };
  for (const r of orgs.filter((o) => !hasVisibleParent(o))) walk(r, 0);
  for (const o of orgs) if (!seen.has(o.id)) out.push({ org: o, depth: 0 }); // órfãos/ciclos
  return out;
}
```

- [ ] **Step 2: Importar no `site-header.tsx`**

Em `src/components/site-header.tsx`, adicione o import junto aos demais imports de `@/lib` (logo após a linha `import { getRtiCampoAccess } from "@/lib/tenancy-gates";`):

```ts
import { buildOrgTree } from "@/lib/org-tree";
```

- [ ] **Step 3: Remover a cópia local de `buildOrgTree`**

Em `src/components/site-header.tsx`, apague o bloco da função local `buildOrgTree` (o comentário `/** Achata as orgs… */` e toda a função, atualmente em torno das linhas 386–407). Mantenha intactos `OrgSwitcher` e o restante — `OrgSwitcher` continua chamando `buildOrgTree(orgs)`, agora resolvido pelo import.

- [ ] **Step 4: Verificar build/test**

Run: `npm run test`
Expected: PASS (sem novos erros; o comportamento do `OrgSwitcher` é idêntico).

- [ ] **Step 5: Commit**

```bash
git add src/lib/org-tree.ts src/components/site-header.tsx
git commit -m "refactor(tenancy): extrai buildOrgTree para @/lib/org-tree (compartilhado)"
```

---

## Task 4: Gate `getEmpresaAdminAccess` (TDD)

**Files:**
- Modify: `src/lib/tenancy-gates.ts`
- Test: `src/lib/__tests__/tenancy-gates.test.ts`

- [ ] **Step 1: Escrever o teste primeiro (falha)**

No fim de `src/lib/__tests__/tenancy-gates.test.ts`, adicione:

```ts
import { getEmpresaAdminAccess } from "../tenancy-gates";

const empresaCtx = ({
  isPlatformAdmin = false,
  roles = [],
}: {
  isPlatformAdmin?: boolean;
  roles?: string[];
}) => {
  const rank = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;
  return {
    isPlatformAdmin,
    hasOrgRole: (min: "viewer" | "member" | "admin" | "owner") =>
      isPlatformAdmin || roles.some((role) => rank[role as keyof typeof rank] >= rank[min]),
  };
};

describe("getEmpresaAdminAccess", () => {
  it("platform admin: pode tudo", () => {
    expect(getEmpresaAdminAccess(empresaCtx({ isPlatformAdmin: true }))).toEqual({
      canCreate: true,
      canEditOrg: true,
      canManageEntitlements: true,
      canDeactivate: true,
      canManageUsers: true,
    });
  });

  it("consultor (admin): edita e gerencia usuários, mas NÃO cria/entitlements/desativa", () => {
    expect(getEmpresaAdminAccess(empresaCtx({ roles: ["admin"] }))).toEqual({
      canCreate: false,
      canEditOrg: true,
      canManageEntitlements: false,
      canDeactivate: false,
      canManageUsers: true,
    });
  });

  it("member: nada", () => {
    expect(getEmpresaAdminAccess(empresaCtx({ roles: ["member"] }))).toEqual({
      canCreate: false,
      canEditOrg: false,
      canManageEntitlements: false,
      canDeactivate: false,
      canManageUsers: false,
    });
  });

  it("viewer: nada", () => {
    expect(getEmpresaAdminAccess(empresaCtx({ roles: ["viewer"] }))).toEqual({
      canCreate: false,
      canEditOrg: false,
      canManageEntitlements: false,
      canDeactivate: false,
      canManageUsers: false,
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm run test -- tenancy-gates`
Expected: FAIL com "getEmpresaAdminAccess is not a function" (ou erro de import).

- [ ] **Step 3: Implementar o gate**

No fim de `src/lib/tenancy-gates.ts`, adicione:

```ts
export type EmpresaAdminAccess = {
  canCreate: boolean;
  canEditOrg: boolean;
  canManageEntitlements: boolean;
  canDeactivate: boolean;
  canManageUsers: boolean;
};

type EmpresaGateContext = {
  isPlatformAdmin: boolean;
  hasOrgRole: (min: OrgRole) => boolean;
};

/** Gate de UI da tela de gestão de empresas. Criação, entitlements e desativação
 * são decisões da plataforma (só platform admin). Editar dados e gerenciar
 * usuários cobrem também o consultor admin da carteira. A barreira real é o
 * banco (RLS + autz das RPCs); este gate é só UX. */
export function getEmpresaAdminAccess(ctx: EmpresaGateContext): EmpresaAdminAccess {
  const pa = ctx.isPlatformAdmin;
  const orgAdmin = pa || ctx.hasOrgRole("admin");
  return {
    canCreate: pa,
    canManageEntitlements: pa,
    canDeactivate: pa,
    canEditOrg: orgAdmin,
    canManageUsers: orgAdmin,
  };
}
```

(`OrgRole` já é importado no topo do arquivo: `import type { OrgRole } from "@/lib/auth-context";`.)

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm run test -- tenancy-gates`
Expected: PASS (todos os describes, incluindo os pré-existentes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tenancy-gates.ts src/lib/__tests__/tenancy-gates.test.ts
git commit -m "feat(empresas): gate getEmpresaAdminAccess + testes"
```

---

## Task 5: Camada de dados `empresas-queries.ts`

**Files:**
- Create: `src/lib/empresas-queries.ts`

Isola o acesso não-tipado às tabelas de tenancy e às RPCs (padrão de `auth-context.tsx`). Expõe funções tipadas.

- [ ] **Step 1: Criar o módulo**

Crie `src/lib/empresas-queries.ts`:

```ts
import { supabase } from "@/integrations/supabase/client";
import type { Org, OrgTipo } from "@/lib/auth-context";

// Tabelas/RPCs de tenancy ainda não estão em types.ts (mantido à mão). Isolamos
// o acesso não-tipado aqui — mesmo padrão de auth-context.tsx — para o resto do
// app seguir tipado nas chamadas a estas funções.
const sb = supabase as unknown as {
  from: (t: string) => any;
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Linha de empresa para a tela de gestão: dados da org + status + módulos. */
export type EmpresaRow = Org & { ativa: boolean; entitlements: string[] };

/** Carrega as orgs visíveis pela RLS (platform admin vê tudo, inclusive inativas;
 * consultor vê a consultoria + clientes ativos geridos) com seus entitlements. */
export async function fetchEmpresas(): Promise<EmpresaRow[]> {
  const [orgRes, entRes] = await Promise.all([
    sb.from("organizations").select("id, nome, tipo, parent_org_id, managed_by_org_id, ativa"),
    sb.from("org_entitlements").select("org_id, module"),
  ]);
  if (orgRes.error) throw new Error(orgRes.error.message);

  const entMap = new Map<string, string[]>();
  ((entRes.data ?? []) as { org_id: string; module: string }[]).forEach((e) => {
    const arr = entMap.get(e.org_id) ?? [];
    arr.push(e.module);
    entMap.set(e.org_id, arr);
  });

  return ((orgRes.data ?? []) as (Org & { ativa: boolean | null })[]).map((o) => ({
    id: o.id,
    nome: o.nome,
    tipo: o.tipo,
    parent_org_id: o.parent_org_id,
    managed_by_org_id: o.managed_by_org_id,
    ativa: o.ativa ?? true,
    entitlements: entMap.get(o.id) ?? [],
  }));
}

export async function createOrg(input: {
  nome: string;
  tipo: OrgTipo;
  managedBy: string | null;
  parent: string | null;
  entitlements: string[];
}): Promise<string> {
  const { data, error } = await sb.rpc("fn_create_org", {
    p_nome: input.nome,
    p_tipo: input.tipo,
    p_managed_by: input.managedBy,
    p_parent: input.parent,
    p_entitlements: input.entitlements,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function updateOrg(input: {
  org: string;
  nome: string;
  managedBy: string | null;
  parent: string | null;
}): Promise<void> {
  const { error } = await sb.rpc("fn_update_org", {
    p_org: input.org,
    p_nome: input.nome,
    p_managed_by: input.managedBy,
    p_parent: input.parent,
  });
  if (error) throw new Error(error.message);
}

export async function setOrgEntitlements(org: string, entitlements: string[]): Promise<void> {
  const { error } = await sb.rpc("fn_set_org_entitlements", {
    p_org: org,
    p_entitlements: entitlements,
  });
  if (error) throw new Error(error.message);
}

export async function setOrgActive(org: string, ativa: boolean): Promise<void> {
  const { error } = await sb.rpc("fn_set_org_active", { p_org: org, p_ativa: ativa });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Verificar typecheck/build**

Run: `npm run test`
Expected: PASS (módulo compila; sem testes próprios — é coberto pela camada de RPC SQL e pelo uso na página).

- [ ] **Step 3: Commit**

```bash
git add src/lib/empresas-queries.ts
git commit -m "feat(empresas): camada de dados (fetchEmpresas + wrappers das RPCs)"
```

---

## Task 6: Página `/admin/empresas` — árvore + gate de acesso

Primeira fatia da rota: gate de acesso, carregamento e árvore hierárquica (sem wizard/edição ainda — entram nas Tasks 7 e 8).

**Files:**
- Create: `src/routes/admin.empresas.tsx`

- [ ] **Step 1: Criar a rota com gate + árvore**

Crie `src/routes/admin.empresas.tsx`:

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Users, ShieldAlert, CornerDownRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getEmpresaAdminAccess } from "@/lib/tenancy-gates";
import { buildOrgTree } from "@/lib/org-tree";
import { fetchEmpresas, type EmpresaRow } from "@/lib/empresas-queries";
import { TIPO_LABEL, MODULE_LABEL } from "@/lib/empresas-labels";

export const Route = createFileRoute("/admin/empresas")({
  component: AdminEmpresasPage,
  head: () => ({ meta: [{ title: "Gestão de empresas — Gestão NR-10" }] }),
});

function AdminEmpresasPage() {
  const { isPlatformAdmin, hasOrgRole, loading, setCurrentOrg } = useAuth();
  const navigate = useNavigate();
  const access = getEmpresaAdminAccess({ isPlatformAdmin, hasOrgRole });

  const [rows, setRows] = useState<EmpresaRow[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await fetchEmpresas());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar empresas");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function manageUsers(orgId: string) {
    setCurrentOrg(orgId);
    navigate({ to: "/admin/usuarios" });
  }

  if (loading)
    return (
      <PageShell>
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </PageShell>
    );

  if (!access.canEditOrg) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="mt-3 text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas o dono da plataforma ou administradores de consultoria gerenciam empresas.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard">Voltar</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const tree = buildOrgTree(rows);

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestão de empresas</h1>
          <p className="text-sm text-muted-foreground">
            {access.canCreate
              ? "Crie consultorias, clientes e unidades, defina módulos e o primeiro acesso."
              : "Gerencie os dados e os acessos dos seus clientes."}
          </p>
        </div>
        {access.canCreate && (
          <Button
            disabled
            className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
            title="Disponível na próxima etapa do plano"
          >
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        )}
      </div>

      <Card className="mt-6">
        <CardContent className="p-2 sm:p-3">
          {rows.length === 0 && !busy && (
            <p className="text-center text-muted-foreground py-10 text-sm">
              Nenhuma empresa visível.
            </p>
          )}
          <ul className="divide-y">
            {tree.map(({ org, depth }) => (
              <li
                key={org.id}
                className={`flex items-center gap-2 py-2.5 ${org.ativa ? "" : "opacity-50"}`}
                style={{ paddingLeft: 8 + depth * 20 }}
              >
                {depth > 0 && (
                  <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                )}
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium truncate">{org.nome}</span>
                <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {TIPO_LABEL[org.tipo]}
                </span>
                <div className="flex gap-1 flex-wrap">
                  {org.entitlements.map((m) => (
                    <span
                      key={m}
                      className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
                    >
                      {MODULE_LABEL[m] ?? m}
                    </span>
                  ))}
                </div>
                {!org.ativa && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    inativa
                  </span>
                )}
                <div className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled
                    title="Editar (próxima etapa do plano)"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {access.canManageUsers && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => manageUsers(org.id)}
                      title="Gerenciar usuários"
                    >
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 2: Criar o módulo de labels (usado aqui e nos diálogos)**

Crie `src/lib/empresas-labels.ts`:

```ts
import type { OrgTipo } from "@/lib/auth-context";

export const TIPO_LABEL: Record<OrgTipo, string> = {
  consultoria: "Consultoria",
  cliente: "Cliente",
  unidade: "Unidade",
};

/** Catálogo de módulos (entitlements). A ordem define a exibição nos checkboxes. */
export const MODULES = [
  { key: "rti_pwa", label: "RTI + Campo (PWA)" },
  { key: "gestao_completa", label: "Gestão completa" },
  { key: "loto", label: "LOTO" },
] as const;

export const MODULE_LABEL: Record<string, string> = Object.fromEntries(
  MODULES.map((m) => [m.key, m.label]),
);
```

- [ ] **Step 3: Verificar build/test**

Run: `npm run test`
Expected: PASS (compila; rota registrada automaticamente pelo plugin do TanStack Router).

- [ ] **Step 4: Verificação no preview**

Inicie o dev server (preview_start se necessário), faça login como platform admin e acesse `/admin/empresas`. Esperado: a árvore lista as empresas com badges de tipo, chips de módulos e inativas esmaecidas. Os botões "Nova empresa" e "Editar" estão desabilitados (entram nas próximas tasks). "Gerenciar usuários" navega para `/admin/usuarios` na org clicada.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin.empresas.tsx src/lib/empresas-labels.ts
git commit -m "feat(empresas): rota /admin/empresas com gate e árvore hierárquica"
```

---

## Task 7: Wizard "Nova empresa" (4 passos, 4º opcional)

Adiciona o wizard de criação (só platform admin). Passo 4 (1º admin) é opcional via edge `admin-users`.

**Files:**
- Modify: `src/routes/admin.empresas.tsx`

- [ ] **Step 1: Adicionar imports e estado do wizard à página**

No topo de `src/routes/admin.empresas.tsx`, complemente os imports:

```tsx
import { type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { OrgTipo, OrgRole } from "@/lib/auth-context";
import { createOrg } from "@/lib/empresas-queries";
import { MODULES } from "@/lib/empresas-labels";
```

Dentro de `AdminEmpresasPage`, adicione o estado de abertura do wizard:

```tsx
  const [wizardOpen, setWizardOpen] = useState(false);
```

- [ ] **Step 2: Ligar o botão "Nova empresa" e montar o diálogo**

Em `AdminEmpresasPage`, troque o botão desabilitado de "Nova empresa" por:

```tsx
        {access.canCreate && (
          <Button
            onClick={() => setWizardOpen(true)}
            className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        )}
```

E, antes do fechamento `</PageShell>`, adicione:

```tsx
      {access.canCreate && (
        <NovaEmpresaWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          empresas={rows}
          onCreated={() => {
            setWizardOpen(false);
            void reload();
          }}
        />
      )}
```

- [ ] **Step 3: Implementar o componente do wizard (no mesmo arquivo)**

Ao final de `src/routes/admin.empresas.tsx`, adicione:

```tsx
const CLIENT_ROLE_OPTIONS: { value: Extract<OrgRole, "owner" | "admin" | "viewer">; label: string }[] = [
  { value: "owner", label: "Admin geral (acesso total)" },
  { value: "admin", label: "Admin padrão (gestão de rotina)" },
  { value: "viewer", label: "Visualização (somente leitura)" },
];

function NovaEmpresaWizard({
  open,
  onOpenChange,
  empresas,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresas: EmpresaRow[];
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<OrgTipo>("cliente");
  const [managedBy, setManagedBy] = useState<string>(""); // "" = cliente direto
  const [parent, setParent] = useState<string>("");
  const [modules, setModules] = useState<string[]>(["rti_pwa"]);
  // passo 4 (opcional)
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [orgRole, setOrgRole] = useState<Extract<OrgRole, "owner" | "admin" | "viewer">>("admin");
  const [saving, setSaving] = useState(false);

  const consultorias = empresas.filter((e) => e.tipo === "consultoria" && e.ativa);
  const possiveisMaes = empresas.filter((e) => e.id && e.ativa);

  function reset() {
    setStep(1);
    setNome("");
    setTipo("cliente");
    setManagedBy("");
    setParent("");
    setModules(["rti_pwa"]);
    setEmail("");
    setUserName("");
    setPassword("");
    setOrgRole("admin");
    setSaving(false);
  }

  function close(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function toggleModule(key: string) {
    setModules((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  }

  function validateStep(): string | null {
    if (step === 1 && !nome.trim()) return "Informe o nome da empresa";
    if (step === 2 && tipo === "unidade" && !parent) return "Unidade exige empresa-mãe";
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) return toast.error(err);
    setStep((s) => Math.min(4, s + 1));
  }

  // Cria a empresa (passos 1–3) e, se preenchido, o 1º usuário (passo 4, opcional).
  async function finish(withUser: boolean) {
    if (withUser) {
      if (!email.includes("@")) return toast.error("E-mail inválido");
      if (password.length < 8) return toast.error("Senha deve ter ao menos 8 caracteres");
    }
    setSaving(true);
    let newId: string;
    try {
      newId = await createOrg({
        nome: nome.trim(),
        tipo,
        managedBy: tipo === "cliente" && managedBy ? managedBy : null,
        parent: tipo === "unidade" && parent ? parent : null,
        entitlements: modules,
      });
    } catch (e) {
      setSaving(false);
      return toast.error(e instanceof Error ? e.message : "Erro ao criar empresa");
    }

    if (withUser) {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: {
          type: "create",
          email,
          password,
          display_name: userName || undefined,
          org_id: newId,
          org_role: orgRole,
        },
      });
      if (error || (data as { error?: string } | null)?.error) {
        const msg =
          (data as { error?: string } | null)?.error ?? error?.message ?? "Erro ao criar usuário";
        setSaving(false);
        // A empresa foi criada; só o usuário falhou — comunica e segue.
        toast.error(`Empresa criada, mas falhou ao criar o usuário: ${msg}. Defina depois em Controle de acessos.`);
        onCreated();
        return;
      }
    }

    setSaving(false);
    toast.success(`Empresa "${nome.trim()}" criada`);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova empresa — passo {step} de 4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Dados básicos da empresa."}
            {step === 2 && "Vínculo na hierarquia."}
            {step === 3 && "Módulos liberados para a empresa."}
            {step === 4 && "Primeiro acesso (opcional — pode definir depois)."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-nome">Nome</Label>
              <Input
                id="emp-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Indústria Acme Ltda."
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as OrgTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultoria">Consultoria</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="unidade">Unidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {tipo === "consultoria" && (
              <p className="text-sm text-muted-foreground">
                Consultoria não tem vínculo — é uma raiz da hierarquia.
              </p>
            )}
            {tipo === "cliente" && (
              <div className="space-y-1.5">
                <Label>Consultoria gestora (opcional)</Label>
                <Select value={managedBy || "none"} onValueChange={(v) => setManagedBy(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Cliente direto (sem consultoria)</SelectItem>
                    {consultorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tipo === "unidade" && (
              <div className="space-y-1.5">
                <Label>Empresa-mãe (obrigatório)</Label>
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa-mãe" />
                  </SelectTrigger>
                  <SelectContent>
                    {possiveisMaes.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            {MODULES.map((m) => (
              <label key={m.key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={modules.includes(m.key)} onCheckedChange={() => toggleModule(m.key)} />
                <span className="text-sm">{m.label}</span>
              </label>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-uname">Nome do usuário</Label>
              <Input id="emp-uname" value={userName} onChange={(e) => setUserName(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-email">E-mail</Label>
              <Input
                id="emp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-pass">Senha provisória</Label>
              <Input
                id="emp-pass"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nível de acesso</Label>
              <Select value={orgRole} onValueChange={(v) => setOrgRole(v as typeof orgRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step > 1 && (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              Voltar
            </Button>
          )}
          {step < 4 && (
            <Button
              type="button"
              onClick={next}
              className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
            >
              Avançar
            </Button>
          )}
          {step === 3 && (
            <Button type="button" variant="outline" onClick={() => void finish(false)} disabled={saving}>
              Criar sem usuário
            </Button>
          )}
          {step === 4 && (
            <>
              <Button type="button" variant="outline" onClick={() => void finish(false)} disabled={saving}>
                Pular — definir depois
              </Button>
              <Button
                type="button"
                onClick={() => void finish(true)}
                disabled={saving}
                className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
              >
                {saving ? "Criando..." : "Criar empresa + usuário"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Verificar build/test**

Run: `npm run test`
Expected: PASS (compila).

- [ ] **Step 5: Verificação no preview**

Como platform admin em `/admin/empresas`: abra "Nova empresa". Crie uma **consultoria** (passo 2 sem vínculo; "Criar sem usuário" no passo 3). Confirme o toast de sucesso e que ela aparece na árvore. Crie um **cliente** vinculado a essa consultoria, indo até o passo 4 e usando "Pular — definir depois". Confirme que aparece indentado sob a consultoria. Tente criar **unidade** sem empresa-mãe e confirme o erro "Unidade exige empresa-mãe".

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin.empresas.tsx
git commit -m "feat(empresas): wizard de criação em 4 passos (1º usuário opcional)"
```

---

## Task 8: Painel de edição/gestão (renomear, vínculo, entitlements, ativar/desativar)

Adiciona o painel de edição. Platform admin: renomear + trocar vínculo + entitlements + ativar/desativar. Consultor: só renomear.

**Files:**
- Modify: `src/routes/admin.empresas.tsx`

- [ ] **Step 1: Imports e estado de edição**

Em `src/routes/admin.empresas.tsx`, complemente os imports:

```tsx
import { Power } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateOrg, setOrgEntitlements, setOrgActive } from "@/lib/empresas-queries";
```

Em `AdminEmpresasPage`, adicione:

```tsx
  const [editing, setEditing] = useState<EmpresaRow | null>(null);
```

- [ ] **Step 2: Ligar o botão "Editar" e montar o diálogo**

Em `AdminEmpresasPage`, troque o botão "Editar" desabilitado por:

```tsx
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(org)}
                    title="Editar empresa"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
```

E antes de `</PageShell>` (após o wizard), adicione:

```tsx
      <EditarEmpresaPanel
        row={editing}
        empresas={rows}
        access={access}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void reload();
        }}
      />
```

- [ ] **Step 3: Implementar o painel (no mesmo arquivo)**

Ao final de `src/routes/admin.empresas.tsx`, adicione:

```tsx
function EditarEmpresaPanel({
  row,
  empresas,
  access,
  onOpenChange,
  onSaved,
}: {
  row: EmpresaRow | null;
  empresas: EmpresaRow[];
  access: ReturnType<typeof getEmpresaAdminAccess>;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [managedBy, setManagedBy] = useState<string>("");
  const [parent, setParent] = useState<string>("");
  const [modules, setModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  useEffect(() => {
    if (row) {
      setNome(row.nome);
      setManagedBy(row.managed_by_org_id ?? "");
      setParent(row.parent_org_id ?? "");
      setModules(row.entitlements);
    }
  }, [row]);

  if (!row) return null;

  const consultorias = empresas.filter((e) => e.tipo === "consultoria" && e.id !== row.id && e.ativa);
  const possiveisMaes = empresas.filter((e) => e.id !== row.id && e.ativa);
  // Quantos clientes esta consultoria gere (aviso ao desativar).
  const clientesGeridos = empresas.filter((e) => e.managed_by_org_id === row.id).length;

  function toggleModule(key: string) {
    setModules((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  }

  async function save() {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      await updateOrg({
        org: row!.id,
        nome: nome.trim(),
        managedBy: row!.tipo === "cliente" && managedBy ? managedBy : null,
        parent: row!.tipo === "unidade" && parent ? parent : null,
      });
      // Entitlements só quando a UI permite (platform admin) e houve mudança.
      if (access.canManageEntitlements) {
        const before = [...row!.entitlements].sort().join(",");
        const after = [...modules].sort().join(",");
        if (before !== after) await setOrgEntitlements(row!.id, modules);
      }
      toast.success("Empresa atualizada");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    setSaving(true);
    try {
      await setOrgActive(row!.id, !row!.ativa);
      toast.success(row!.ativa ? "Empresa desativada" : "Empresa reativada");
      setConfirmToggle(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar status");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={row !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar {TIPO_LABEL[row.tipo].toLowerCase()}</DialogTitle>
            <DialogDescription>
              {access.canManageEntitlements
                ? "Renomeie, ajuste o vínculo e os módulos."
                : "Renomeie a empresa. Módulos e vínculo são definidos pelo dono da plataforma."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-nome">Nome</Label>
              <Input id="ed-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            </div>

            {/* Vínculo: só platform admin altera (canManageEntitlements == platform admin) */}
            {access.canManageEntitlements && row.tipo === "cliente" && (
              <div className="space-y-1.5">
                <Label>Consultoria gestora</Label>
                <Select value={managedBy || "none"} onValueChange={(v) => setManagedBy(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Cliente direto (sem consultoria)</SelectItem>
                    {consultorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {access.canManageEntitlements && row.tipo === "unidade" && (
              <div className="space-y-1.5">
                <Label>Empresa-mãe</Label>
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {possiveisMaes.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {access.canManageEntitlements && (
              <div className="space-y-2">
                <Label>Módulos</Label>
                {MODULES.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={modules.includes(m.key)} onCheckedChange={() => toggleModule(m.key)} />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {access.canDeactivate && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmToggle(true)}
                disabled={saving}
                className={row.ativa ? "text-destructive hover:text-destructive" : ""}
              >
                <Power className="h-3.5 w-3.5" /> {row.ativa ? "Desativar" : "Reativar"}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmToggle} onOpenChange={setConfirmToggle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {row.ativa ? "Desativar" : "Reativar"} {row.nome}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {row.ativa
                ? `A empresa some para os usuários comuns; os dados são preservados e você pode reativá-la. ${
                    row.tipo === "consultoria" && clientesGeridos > 0
                      ? `Atenção: esta consultoria gere ${clientesGeridos} cliente(s) — eles NÃO são desativados automaticamente.`
                      : ""
                  }`
                : "A empresa volta a ficar acessível aos usuários vinculados."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void toggleActive()}
              className={row.ativa ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {row.ativa ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 4: Verificar build/test**

Run: `npm run test`
Expected: PASS (compila).

- [ ] **Step 5: Verificação no preview**

Como platform admin: edite um cliente, renomeie, troque a consultoria gestora e altere módulos — confirme que persiste após reload. Desative o cliente e confirme que ele fica esmaecido com badge "inativa". Reative. Ao desativar uma consultoria com clientes, confirme que o diálogo avisa quantos clientes ela gere.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin.empresas.tsx
git commit -m "feat(empresas): painel de edição (vínculo, módulos, ativar/desativar)"
```

---

## Task 9: Item de menu "Gestão de empresas"

Expõe a rota no header para platform admin ou consultor admin.

**Files:**
- Modify: `src/components/site-header.tsx`

- [ ] **Step 1: Calcular a flag de acesso à gestão de empresas**

Em `src/components/site-header.tsx`, dentro de `SiteHeader`, logo após a linha `const canManageUsers = isAdmin || hasOrgRole("admin");`, adicione:

```tsx
  // Gestão de empresas: dono da plataforma ou consultor admin (carteira).
  const { isPlatformAdmin } = auth;
  const canManageEmpresas = isPlatformAdmin || hasOrgRole("admin");
```

- [ ] **Step 2: Adicionar o link no menu mobile (Sheet)**

Em `src/components/site-header.tsx`, no bloco do Sheet onde existe `{user && canManageUsers && ( … Controle de acessos … )}`, troque para incluir a gestão de empresas:

```tsx
              {user && (canManageUsers || canManageEmpresas) && (
                <div className="p-2 border-b border-white/10 space-y-0.5">
                  {canManageEmpresas && (
                    <MobileNavLink to="/admin/empresas" onNav={() => setMenuOpen(false)}>
                      Gestão de empresas
                    </MobileNavLink>
                  )}
                  {canManageUsers && (
                    <MobileNavLink to="/admin/usuarios" onNav={() => setMenuOpen(false)}>
                      Controle de acessos
                    </MobileNavLink>
                  )}
                </div>
              )}
```

- [ ] **Step 3: Passar a flag para o `UserMenu` e renderizar o item (desktop)**

Em `src/components/site-header.tsx`, na chamada de `<UserMenu … />`, adicione a prop:

```tsx
              <UserMenu
                displayName={displayName}
                initials={initials}
                cargo={cargo}
                canManageUsers={canManageUsers}
                canManageEmpresas={canManageEmpresas}
              />
```

Atualize a assinatura de `UserMenu`:

```tsx
function UserMenu({
  displayName,
  initials,
  cargo,
  canManageUsers,
  canManageEmpresas,
}: {
  displayName: string;
  initials: string;
  cargo: string;
  canManageUsers: boolean;
  canManageEmpresas: boolean;
}) {
```

E, dentro do `DropdownMenuContent`, troque o bloco `{canManageUsers && ( … )}` por:

```tsx
        {(canManageUsers || canManageEmpresas) && <DropdownMenuSeparator />}
        {canManageEmpresas && (
          <DropdownMenuItem asChild>
            <Link to="/admin/empresas" className="cursor-pointer gap-2">
              <Building2 className="h-3.5 w-3.5" /> Gestão de empresas
            </Link>
          </DropdownMenuItem>
        )}
        {canManageUsers && (
          <DropdownMenuItem asChild>
            <Link to="/admin/usuarios" className="cursor-pointer gap-2">
              <Building2 className="h-3.5 w-3.5" /> Controle de acessos
            </Link>
          </DropdownMenuItem>
        )}
```

- [ ] **Step 4: Verificar build/test**

Run: `npm run test`
Expected: PASS (compila).

- [ ] **Step 5: Verificação no preview**

Como platform admin: o menu da conta (desktop) e o Sheet (mobile) mostram "Gestão de empresas" levando a `/admin/empresas`. Faça login como um usuário comum (member) e confirme que o item **não** aparece.

- [ ] **Step 6: Commit**

```bash
git add src/components/site-header.tsx
git commit -m "feat(empresas): item de menu 'Gestão de empresas' (platform admin / consultor)"
```

---

## Task 10: Lint e verificação final

**Files:** nenhum novo.

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: sem novos erros nos arquivos tocados. (Erros tsc pré-existentes são conhecidos — não corrigir aqui.)

- [ ] **Step 2: Suíte de testes**

Run: `npm run test`
Expected: PASS, incluindo os 4 novos testes de `getEmpresaAdminAccess`.

- [ ] **Step 3: Checklist manual de fim a fim**

Com a migração aplicada e o teste SQL (Task 2) verde:
- Platform admin cria consultoria → cliente (gerido) → unidade; define módulos; cria 1º usuário em uma e pula em outra.
- Consultor (login do `cons`) vê só a consultoria + clientes geridos; renomeia um cliente; **não** vê "Nova empresa" nem checkboxes de módulos; "Gerenciar usuários" abre o painel já na org certa.
- Desativar um cliente o faz sumir para o usuário-cliente (validar logando como `cliA`), mas o platform admin continua vendo (esmaecido) e consegue reativar.

---

## Self-Review

**1. Cobertura da spec:**
- §1.1 coluna `ativa` + reforço `can_access_org` + edge case consultoria→clientes → Task 1 (coluna/função) + Task 8 (aviso de clientes geridos). ✓
- §1.2 as 4 RPCs + 1º usuário via edge → Task 1 (RPCs) + Task 7 (passo 4 chama `admin-users`). ✓
- §1.3 listagem (árvore) client-side por RLS → Task 5 (`fetchEmpresas`) + Task 6 (árvore). ✓
- §2.1 rota `/admin/empresas` + item de menu por gate → Task 6 (rota) + Task 9 (menu). ✓
- §2.2 árvore indentada com tipo/chips/status, inativas esmaecidas → Task 6. ✓
- §2.3 wizard 4 passos, 4º opcional → Task 7. ✓
- §2.4 edição platform admin (vínculo/entitlements/ativar) vs consultor (só nome + usuários) → Task 8 (painel condicionado por `access`) + Task 6 ("Gerenciar usuários"). ✓
- §3.1 gate `getEmpresaAdminAccess` → Task 4. ✓
- §3.2 erros das RPCs traduzidos em toast + atomicidade do passo 4 → Tasks 5/7 (mensagens) + Task 7 (toast "empresa criada, usuário falhou"). ✓
- §3.3 testes unit + SQL → Task 4 (Vitest) + Task 2 (SQL). ✓
- §3.4 `types.ts` → desvio justificado (wrapper isolado em `empresas-queries.ts`); documentado no topo do plano. ✓

**2. Placeholders:** nenhum "TBD"/"etc." em passos de código; todo passo de código traz o bloco completo.

**3. Consistência de tipos:** `EmpresaRow` definido em `empresas-queries.ts` e reusado em `admin.empresas.tsx`; `buildOrgTree` genérico aceita `EmpresaRow` (estende `Org`); `MODULES`/`MODULE_LABEL`/`TIPO_LABEL` definidos uma vez em `empresas-labels.ts`; `getEmpresaAdminAccess` retorna o mesmo shape consumido em `EditarEmpresaPanel` via `ReturnType<typeof getEmpresaAdminAccess>`; nomes das RPCs (`fn_create_org`/`fn_update_org`/`fn_set_org_entitlements`/`fn_set_org_active`) idênticos entre migração (Task 1), wrappers (Task 5) e teste SQL (Task 2).
