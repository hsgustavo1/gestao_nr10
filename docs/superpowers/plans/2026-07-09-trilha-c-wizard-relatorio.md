# Trilha C — Wizard de Relatório RTI: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wizard em 5 etapas no app principal que transforma um `rti_report` em PDF entregável de alto padrão com identidade do consultor, parecer sugerido por IA e versionamento auditável.

**Architecture:** Rascunho persistido em `rti_report_wizard` (1:1 com o report); modelo de dados do PDF montado por funções puras (`src/lib/rti-relatorio.ts`, TDD); documento composto com `@react-pdf/renderer` **renderizado no client** (preview via `PDFViewer`, emissão via `pdf().toBlob()` — mesmo layout nos dois); upload para o bucket `rti-evidencias` com a sessão do usuário (RLS preservado) + linha em `rti_report_pdfs` (versão nunca sobrescrita). IA (Groq, padrão certificados) só sugere texto de parecer via server function.

> **Emenda auditável (D-C2b):** a spec D-C2 dizia "server-side na rota do app". Mantida a biblioteca decidida (`@react-pdf/renderer`), mas a renderização passa a ser **no navegador**: elimina transporte de PDF em base64 por server function, timeout/cold start serverless com 30 NCs × fotos, e usa o supabase client autenticado do usuário para o upload (sem service key). Preview e emissão ficam idênticos por construção. A Task 12 registra isso no arquivo de decisões.

**Tech Stack:** TanStack Start/Router (rota file-based), React Query, Supabase (Postgres + RLS + Storage, projeto `fumwovtzyhxrjhkjzujs` via MCP), `@react-pdf/renderer`, `@fontsource/hanken-grotesk` (WOFF), Groq (`createServerFn`), Vitest.

**Regras do projeto que valem aqui:** commits locais livres, **nunca `git push` sem ordem explícita**; migration = arquivo `.sql` versionado **e** aplicação via MCP `apply_migration`; `src/integrations/supabase/types.ts` atualizado à mão; nunca mexer no dev server da porta 57010; `routeTree.gen.ts` é gerado (não editar à mão — o dev server do usuário regenera ao salvar a rota nova).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260709100000_rti_report_wizard.sql` | Tabelas `rti_report_wizard` + `rti_report_pdfs`, branding em `organizations`, RPC `fn_set_org_branding`, bucket `org-assets` |
| `src/integrations/supabase/types.ts` (modify) | Tipos das tabelas/colunas/RPC novas |
| `src/lib/rti-relatorio.ts` | **Puro:** tipos do wizard, merge de overrides, modelo do PDF, resumo por prioridade, versão/path do PDF |
| `src/lib/__tests__/rti-relatorio.test.ts` | Testes do puro acima |
| `src/lib/campo.ts` (modify) | **Puro:** `fotosParaAchado()` (fotos por finding_id com fallback) |
| `src/lib/__tests__/campo-fotos-achado.test.ts` | Teste de `fotosParaAchado` |
| `src/lib/campo-queries.ts` (modify ~linha 1020) | `comporRti` passa a anexar fotos por achado |
| `src/lib/rti-parecer-ai.ts` | **Puro:** input estruturado p/ IA + normalização da resposta |
| `src/lib/__tests__/rti-parecer-ai.test.ts` | Testes do puro acima |
| `src/lib/rti-parecer-ai-server.ts` | Server function Groq (texto, retry, fallback de modelo) |
| `src/lib/rti-relatorio-queries.ts` | React Query: report único, rascunho (load/upsert), fotos por NC, PDFs emitidos, emissão, branding |
| `src/components/rti/pdf/fonts.ts` | `Font.register` Hanken Grotesk (WOFF via @fontsource) |
| `src/components/rti/pdf/RtiPdfDocument.tsx` | Documento @react-pdf (capa → NCs → resumo → parecer → assinatura) |
| `src/components/rti/pdf/PdfPreview.tsx` | Wrapper `PDFViewer` (default export p/ `React.lazy`, client-only) |
| `src/components/rti/pdf/gerarPdfBlob.tsx` | `gerarPdfBlob(model)` p/ emissão |
| `src/components/rti/wizard/StepIdentificacao.tsx` | Etapa 1 |
| `src/components/rti/wizard/StepNcs.tsx` | Etapa 2 (revisão seriada de NCs + fotos) |
| `src/components/rti/wizard/StepParecer.tsx` | Etapa 3 (IA + edição) |
| `src/routes/rti.relatorio.$reportId.wizard.tsx` | Rota `/rti/relatorio/:reportId/wizard` — estado, autosave, etapas 4/5 |
| `src/routes/rti.plano.tsx` (modify ~linha 383) | Botão "Gerar relatório" |
| `src/components/org-branding-dialog.tsx` | Dialog de identidade do consultor (logo/cor/razão social/registro) |
| `src/routes/admin.empresas.tsx` (modify, `EditarEmpresaPanel` ~linha 625) | Abre o dialog de branding |

Fatos do schema que o plano usa (já verificados no código):
- `rti_ncs`: `numero`, `descricao`, `recomendacao`, `prioridade` smallint 1–4 (**P4 = mais grave**), `area_id`, `status`, `tipo_execucao ('os'|'investimento')`, `os_numero`, `custo_planejado`, `situacao_atual`, `finding_id` (nullable).
- `rti_nc_evidencias`: `nc_id`, `tipo ('constatacao'|'correcao')`, `file_path` (bucket público `rti-evidencias`), `descricao`.
- `rti_reports`: `titulo`, `empresa_auditora`, `responsavel_tecnico_rti`, `responsavel_relatorio`, `periodo_inicio/fim`, `art_numero`, `report_path`, `entregue_em`, `org_id`.
- `field_photos`: `point_id`, `finding_id` (nullable, trilha B), `file_path` (mesmo bucket), `gps_lat/gps_lng`.
- Paths de storage: helpers puros em `src/lib/storage-paths.ts` (`evidenciaFolder`, `orgFolderName`, `reportSlug`).
- Auth: `useAuth()` de `@/lib/auth-context` expõe `currentOrg` (com `nome`) e `currentOrgId`.

---

### Task 1: Migration — tabelas do wizard, versões de PDF, branding e bucket

**Files:**
- Create: `supabase/migrations/20260709100000_rti_report_wizard.sql`

- [ ] **Step 1: Escrever o arquivo SQL**

```sql
-- ============================================================================
-- Trilha C — Wizard de Relatório RTI (2026-07-09)
-- 1) rti_report_wizard: rascunho 1:1 do wizard (etapas, identificação, overrides).
-- 2) rti_report_pdfs: versões emitidas do PDF (imutável, auditoria).
-- 3) organizations: identidade mínima do consultor no PDF (white-label mínimo).
-- 4) fn_set_org_branding: escrita de branding sem policy column-level.
-- 5) bucket org-assets: logo do consultor.
-- Idempotente. Aplicada via Supabase MCP (apply_migration) + versionada aqui.
-- ============================================================================

-- ---------- 1. Rascunho do wizard ----------
CREATE TABLE IF NOT EXISTS public.rti_report_wizard (
  report_id     uuid PRIMARY KEY REFERENCES public.rti_reports(id) ON DELETE CASCADE,
  etapa_atual   smallint NOT NULL DEFAULT 1 CHECK (etapa_atual BETWEEN 1 AND 5),
  identificacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ncs_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { [ncId]: {descricao?, recomendacao?, incluir?, fotosExcluidas?} }
  parecer          text,
  resumo_executivo text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rti_report_wizard ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS rti_report_wizard_touch ON public.rti_report_wizard;
CREATE TRIGGER rti_report_wizard_touch
  BEFORE UPDATE ON public.rti_report_wizard
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Visibilidade espelha o report: o EXISTS roda sob o RLS de rti_reports do
-- próprio usuário — se ele enxerga o report, enxerga o rascunho.
DROP POLICY IF EXISTS "rti_wizard_select" ON public.rti_report_wizard;
CREATE POLICY "rti_wizard_select" ON public.rti_report_wizard FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rti_reports r WHERE r.id = report_id));

-- Escrita: membro da org do report ou consultoria que a gere (padrão RLS Pessoas).
DROP POLICY IF EXISTS "rti_wizard_write" ON public.rti_report_wizard;
CREATE POLICY "rti_wizard_write" ON public.rti_report_wizard FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.rti_reports r WHERE r.id = report_id
      AND (public.org_role_at_least(auth.uid(), r.org_id, 'member')
           OR public.fn_org_is_manager(auth.uid(), r.org_id))))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rti_reports r WHERE r.id = report_id
      AND (public.org_role_at_least(auth.uid(), r.org_id, 'member')
           OR public.fn_org_is_manager(auth.uid(), r.org_id))));

-- ---------- 2. Versões emitidas ----------
CREATE TABLE IF NOT EXISTS public.rti_report_pdfs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        uuid NOT NULL REFERENCES public.rti_reports(id) ON DELETE CASCADE,
  versao           integer NOT NULL,
  file_path        text NOT NULL,               -- bucket rti-evidencias
  emitido_por      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  emitido_por_nome text,
  emitido_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, versao)
);
ALTER TABLE public.rti_report_pdfs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rti_report_pdfs_report ON public.rti_report_pdfs(report_id);

DROP POLICY IF EXISTS "rti_pdfs_select" ON public.rti_report_pdfs;
CREATE POLICY "rti_pdfs_select" ON public.rti_report_pdfs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rti_reports r WHERE r.id = report_id));

-- Só INSERT (reemissão = versão nova; nunca UPDATE/DELETE — trilha de auditoria).
DROP POLICY IF EXISTS "rti_pdfs_insert" ON public.rti_report_pdfs;
CREATE POLICY "rti_pdfs_insert" ON public.rti_report_pdfs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rti_reports r WHERE r.id = report_id
      AND (public.org_role_at_least(auth.uid(), r.org_id, 'member')
           OR public.fn_org_is_manager(auth.uid(), r.org_id))));

-- ---------- 3. Branding do consultor ----------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS cor_primaria text,
  ADD COLUMN IF NOT EXISTS razao_social_relatorio text,
  ADD COLUMN IF NOT EXISTS registro_profissional text;

-- ---------- 4. RPC de branding ----------
CREATE OR REPLACE FUNCTION public.fn_set_org_branding(
  _org_id uuid,
  _logo_path text,
  _cor_primaria text,
  _razao_social_relatorio text,
  _registro_profissional text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_platform_admin(auth.uid())
          OR public.org_role_at_least(auth.uid(), _org_id, 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão para editar a identidade desta organização';
  END IF;
  UPDATE public.organizations
     SET logo_path = _logo_path,
         cor_primaria = _cor_primaria,
         razao_social_relatorio = _razao_social_relatorio,
         registro_profissional = _registro_profissional
   WHERE id = _org_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_set_org_branding(uuid, text, text, text, text) TO authenticated;

-- ---------- 5. Bucket org-assets (logo) ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-assets', 'org-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Path: {org_id}/logo-<timestamp>.<ext> — 1º segmento é a org dona.
DROP POLICY IF EXISTS "org_assets_public_read" ON storage.objects;
CREATE POLICY "org_assets_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'org-assets');

DROP POLICY IF EXISTS "org_assets_admin_insert" ON storage.objects;
CREATE POLICY "org_assets_admin_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'org-assets'
    AND (public.is_platform_admin(auth.uid())
         OR public.org_role_at_least(auth.uid(), ((string_to_array(name, '/'))[1])::uuid, 'admin')));

DROP POLICY IF EXISTS "org_assets_admin_delete" ON storage.objects;
CREATE POLICY "org_assets_admin_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'org-assets'
    AND (public.is_platform_admin(auth.uid())
         OR public.org_role_at_least(auth.uid(), ((string_to_array(name, '/'))[1])::uuid, 'admin')));
```

- [ ] **Step 2: Aplicar via MCP do Supabase**

Chamar `mcp__…__apply_migration` no projeto `fumwovtzyhxrjhkjzujs` com `name: "rti_report_wizard"` e o SQL acima (idêntico ao arquivo).

- [ ] **Step 3: Verificar**

Via `execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name IN ('rti_report_wizard','rti_report_pdfs') ORDER BY table_name, ordinal_position;
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'organizations' AND column_name LIKE '%logo%' OR column_name LIKE '%registro%';
SELECT id FROM storage.buckets WHERE id = 'org-assets';
```
Esperado: colunas das duas tabelas, `logo_path`/`registro_profissional`, bucket presente.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260709100000_rti_report_wizard.sql
git commit -m "feat(rti): schema do wizard de relatorio — rascunho, versoes de PDF, branding e bucket org-assets"
```

---

### Task 2: Tipos do Supabase à mão

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Adicionar as tabelas novas em `Database.public.Tables`** (ordem alfabética, seguindo o formato existente do arquivo — copie o shape de uma tabela vizinha como `rti_reports`):

```ts
rti_report_pdfs: {
  Row: {
    id: string;
    report_id: string;
    versao: number;
    file_path: string;
    emitido_por: string | null;
    emitido_por_nome: string | null;
    emitido_em: string;
  };
  Insert: {
    id?: string;
    report_id: string;
    versao: number;
    file_path: string;
    emitido_por?: string | null;
    emitido_por_nome?: string | null;
    emitido_em?: string;
  };
  Update: {
    id?: string;
    report_id?: string;
    versao?: number;
    file_path?: string;
    emitido_por?: string | null;
    emitido_por_nome?: string | null;
    emitido_em?: string;
  };
  Relationships: [
    {
      foreignKeyName: "rti_report_pdfs_report_id_fkey";
      columns: ["report_id"];
      isOneToOne: false;
      referencedRelation: "rti_reports";
      referencedColumns: ["id"];
    },
  ];
};
rti_report_wizard: {
  Row: {
    report_id: string;
    etapa_atual: number;
    identificacao: Json;
    ncs_overrides: Json;
    parecer: string | null;
    resumo_executivo: string | null;
    updated_at: string;
  };
  Insert: {
    report_id: string;
    etapa_atual?: number;
    identificacao?: Json;
    ncs_overrides?: Json;
    parecer?: string | null;
    resumo_executivo?: string | null;
    updated_at?: string;
  };
  Update: {
    report_id?: string;
    etapa_atual?: number;
    identificacao?: Json;
    ncs_overrides?: Json;
    parecer?: string | null;
    resumo_executivo?: string | null;
    updated_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "rti_report_wizard_report_id_fkey";
      columns: ["report_id"];
      isOneToOne: true;
      referencedRelation: "rti_reports";
      referencedColumns: ["id"];
    },
  ];
};
```

- [ ] **Step 2: Adicionar as colunas novas em `organizations`** — em Row: `logo_path: string | null; cor_primaria: string | null; razao_social_relatorio: string | null; registro_profissional: string | null;` (e as versões opcionais em Insert/Update).

- [ ] **Step 3: Adicionar a RPC em `Database.public.Functions`**:

```ts
fn_set_org_branding: {
  Args: {
    _org_id: string;
    _logo_path: string | null;
    _cor_primaria: string | null;
    _razao_social_relatorio: string | null;
    _registro_profissional: string | null;
  };
  Returns: undefined;
};
```

- [ ] **Step 4: Typecheck e commit**

Run: `npx tsc --noEmit` — sem erros **novos** (erros pré-existentes são conhecidos; compare com a baseline antes de mexer).
```bash
git add src/integrations/supabase/types.ts
git commit -m "feat(rti): tipos do wizard de relatorio no client Supabase"
```

---

### Task 3: Lib pura do relatório (TDD)

**Files:**
- Create: `src/lib/rti-relatorio.ts`
- Test: `src/lib/__tests__/rti-relatorio.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, test } from "vitest";
import {
  defaultIdentificacao,
  mergeNcOverrides,
  proximaVersao,
  relatorioPdfPath,
  resumoPorPrioridade,
  type NcParaPdf,
  type NcsOverrides,
} from "../rti-relatorio";

const nc = (over: Partial<NcParaPdf>): NcParaPdf => ({
  id: "nc-1",
  numero: 1,
  areaNome: "Subestação",
  descricao: "Painel sem identificação",
  recomendacao: "Identificar conforme NR-10",
  prioridade: 3,
  tipoExecucao: "os",
  osNumero: null,
  custoPlanejado: 0,
  fotos: [],
  ...over,
});

describe("mergeNcOverrides", () => {
  test("sem overrides devolve as NCs ordenadas por numero", () => {
    const out = mergeNcOverrides([nc({ id: "b", numero: 2 }), nc({ id: "a", numero: 1 })], {});
    expect(out.map((n) => n.numero)).toEqual([1, 2]);
  });

  test("override de texto substitui descricao/recomendacao sem tocar o resto", () => {
    const overrides: NcsOverrides = { "nc-1": { descricao: "Texto revisado" } };
    const out = mergeNcOverrides([nc({})], overrides);
    expect(out[0].descricao).toBe("Texto revisado");
    expect(out[0].recomendacao).toBe("Identificar conforme NR-10");
  });

  test("incluir=false remove a NC do relatório", () => {
    const overrides: NcsOverrides = { "nc-1": { incluir: false } };
    expect(mergeNcOverrides([nc({})], overrides)).toHaveLength(0);
  });

  test("fotosExcluidas filtra fotos pelo id", () => {
    const fotos = [
      { id: "f1", url: "u1", legenda: null },
      { id: "f2", url: "u2", legenda: null },
    ];
    const out = mergeNcOverrides([nc({ fotos })], { "nc-1": { fotosExcluidas: ["f1"] } });
    expect(out[0].fotos.map((f) => f.id)).toEqual(["f2"]);
  });
});

describe("resumoPorPrioridade", () => {
  test("agrega quantidade e custo por prioridade, da mais grave (P4) para a mais leve", () => {
    const linhas = resumoPorPrioridade([
      nc({ prioridade: 4, custoPlanejado: 100 }),
      nc({ id: "x", numero: 2, prioridade: 4, custoPlanejado: 50 }),
      nc({ id: "y", numero: 3, prioridade: 1, custoPlanejado: 10 }),
    ]);
    expect(linhas[0]).toMatchObject({ prioridade: 4, quantidade: 2, custoPlanejado: 150 });
    expect(linhas.at(-1)).toMatchObject({ prioridade: 1, quantidade: 1, custoPlanejado: 10 });
    expect(linhas).toHaveLength(4); // sempre as 4 linhas, mesmo zeradas
  });
});

describe("versões e path do PDF", () => {
  test("proximaVersao começa em 1 e incrementa a maior", () => {
    expect(proximaVersao([])).toBe(1);
    expect(proximaVersao([{ versao: 1 }, { versao: 3 }])).toBe(4);
  });

  test("relatorioPdfPath usa a pasta de evidências do report + subpasta relatorios", () => {
    const path = relatorioPdfPath(
      "11111111-2222-3333-4444-555555555555",
      { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", titulo: "RTI Usina" },
      2,
      "Cliente X",
    );
    expect(path).toBe(
      "cliente-x-11111111-2222-3333-4444-555555555555/rti-usina-aaaaaaaa/relatorios/relatorio-v02.pdf",
    );
  });
});

describe("defaultIdentificacao", () => {
  test("pré-preenche do report e usa normas padrão", () => {
    const ident = defaultIdentificacao(
      {
        titulo: "RTI Usina",
        empresa_auditora: "Cliente X",
        responsavel_tecnico_rti: "Eng. Fulano",
        art_numero: "ART-123",
        periodo_inicio: "2026-07-01",
        periodo_fim: "2026-07-03",
      },
      "Consultoria Y",
    );
    expect(ident.titulo).toBe("RTI Usina");
    expect(ident.clienteNome).toBe("Cliente X");
    expect(ident.responsavelTecnico).toBe("Eng. Fulano");
    expect(ident.artNumero).toBe("ART-123");
    expect(ident.normas).toContain("NR-10");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: FAIL — módulo `../rti-relatorio` inexistente.

- [ ] **Step 3: Implementar `src/lib/rti-relatorio.ts`**

```ts
// Trilha C — modelo de dados do PDF do RTI. Puro (sem Supabase/React) — testável isolado.
import { evidenciaFolder } from "./storage-paths";

// ── Identificação (etapa 1) ──────────────────────────────────────────────────
export interface WizardIdentificacao {
  titulo: string;
  clienteNome: string;
  local: string;
  periodoInicio: string | null; // yyyy-mm-dd
  periodoFim: string | null;
  responsavelTecnico: string;
  artNumero: string;
  normas: string;       // referencial normativo, texto livre
  introducao: string;   // template editável
  metodologia: string;  // template editável
}

export const INTRODUCAO_PADRAO =
  "Este Relatório Técnico de Inspeção (RTI) apresenta o resultado da inspeção das " +
  "instalações elétricas realizada no período indicado, em atendimento ao item 10.2.4 " +
  "da NR-10, com o registro das não conformidades constatadas, sua priorização e as " +
  "recomendações técnicas correspondentes.";

export const METODOLOGIA_PADRAO =
  "A inspeção foi conduzida por inspeção visual e verificação documental em campo, " +
  "com registro fotográfico das constatações. As não conformidades foram classificadas " +
  "por prioridade (P1 a P4, sendo P4 a mais grave) considerando o risco elétrico e o " +
  "impacto na conformidade legal.";

export function defaultIdentificacao(
  report: {
    titulo?: string | null;
    empresa_auditora?: string | null;
    responsavel_tecnico_rti?: string | null;
    art_numero?: string | null;
    periodo_inicio?: string | null;
    periodo_fim?: string | null;
  },
  _orgNome?: string | null,
): WizardIdentificacao {
  return {
    titulo: report.titulo ?? "",
    clienteNome: report.empresa_auditora ?? "",
    local: "",
    periodoInicio: report.periodo_inicio ?? null,
    periodoFim: report.periodo_fim ?? null,
    responsavelTecnico: report.responsavel_tecnico_rti ?? "",
    artNumero: report.art_numero ?? "",
    normas: "NR-10 — Segurança em Instalações e Serviços em Eletricidade; NBR 5410",
    introducao: INTRODUCAO_PADRAO,
    metodologia: METODOLOGIA_PADRAO,
  };
}

// ── NCs e overrides (etapa 2) ────────────────────────────────────────────────
export interface PdfFoto {
  id: string;
  url: string;
  legenda: string | null;
}

export interface NcParaPdf {
  id: string;
  numero: number;
  areaNome: string;
  descricao: string;
  recomendacao: string | null;
  prioridade: number; // 1..4, P4 mais grave
  tipoExecucao: "os" | "investimento";
  osNumero: string | null;
  custoPlanejado: number;
  fotos: PdfFoto[];
}

export interface NcOverride {
  descricao?: string;
  recomendacao?: string;
  incluir?: boolean;        // false = fora do relatório
  fotosExcluidas?: string[]; // ids de PdfFoto
}
export type NcsOverrides = Record<string, NcOverride>;

/** Aplica edições do wizard sobre as NCs SEM tocar o registro técnico no banco. */
export function mergeNcOverrides(ncs: NcParaPdf[], overrides: NcsOverrides): NcParaPdf[] {
  return [...ncs]
    .sort((a, b) => a.numero - b.numero)
    .filter((nc) => overrides[nc.id]?.incluir !== false)
    .map((nc) => {
      const o = overrides[nc.id];
      if (!o) return nc;
      const excluidas = new Set(o.fotosExcluidas ?? []);
      return {
        ...nc,
        descricao: o.descricao ?? nc.descricao,
        recomendacao: o.recomendacao ?? nc.recomendacao,
        fotos: nc.fotos.filter((f) => !excluidas.has(f.id)),
      };
    });
}

// ── Quadro-resumo (P4 → P1, sempre 4 linhas) ────────────────────────────────
export const PRIORIDADE_LABEL: Record<number, string> = {
  4: "P4 — Crítica",
  3: "P3 — Alta",
  2: "P2 — Média",
  1: "P1 — Baixa",
};

export interface ResumoLinha {
  prioridade: number;
  label: string;
  quantidade: number;
  custoPlanejado: number;
}

export function resumoPorPrioridade(ncs: NcParaPdf[]): ResumoLinha[] {
  return [4, 3, 2, 1].map((p) => {
    const doNivel = ncs.filter((n) => n.prioridade === p);
    return {
      prioridade: p,
      label: PRIORIDADE_LABEL[p],
      quantidade: doNivel.length,
      custoPlanejado: doNivel.reduce((s, n) => s + (n.custoPlanejado || 0), 0),
    };
  });
}

// ── Branding e modelo final ──────────────────────────────────────────────────
export interface OrgBranding {
  logoUrl: string | null;
  corPrimaria: string | null;       // hex; fallback do PDF: #0C3326
  razaoSocial: string | null;
  registroProfissional: string | null;
}

export interface PdfModel {
  identificacao: WizardIdentificacao;
  branding: OrgBranding;
  ncs: NcParaPdf[];         // já com overrides aplicados
  resumo: ResumoLinha[];
  parecer: string;
  resumoExecutivo: string;
  emitidoEm: string;        // dd/mm/aaaa (exibição)
}

export function buildPdfModel(args: {
  identificacao: WizardIdentificacao;
  branding: OrgBranding | null;
  ncs: NcParaPdf[];
  overrides: NcsOverrides;
  parecer: string;
  resumoExecutivo: string;
  agora?: Date;
}): PdfModel {
  const ncs = mergeNcOverrides(args.ncs, args.overrides);
  const d = args.agora ?? new Date();
  return {
    identificacao: args.identificacao,
    branding: args.branding ?? {
      logoUrl: null,
      corPrimaria: null,
      razaoSocial: null,
      registroProfissional: null,
    },
    ncs,
    resumo: resumoPorPrioridade(ncs),
    parecer: args.parecer,
    resumoExecutivo: args.resumoExecutivo,
    emitidoEm: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
  };
}

// ── Versões e path no Storage ────────────────────────────────────────────────
export function proximaVersao(pdfs: { versao: number }[]): number {
  return pdfs.reduce((m, p) => Math.max(m, p.versao), 0) + 1;
}

export function relatorioPdfFileName(versao: number): string {
  return `relatorio-v${String(versao).padStart(2, "0")}.pdf`;
}

/** Subpasta `relatorios/` dentro da pasta de evidências do report (convenção 2026-07-02). */
export function relatorioPdfPath(
  orgId: string,
  report: { id: string; titulo?: string | null },
  versao: number,
  orgNome?: string | null,
): string {
  return `${evidenciaFolder(orgId, report, orgNome)}/relatorios/${relatorioPdfFileName(versao)}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rti-relatorio.ts src/lib/__tests__/rti-relatorio.test.ts
git commit -m "feat(rti): modelo puro do PDF do relatorio (overrides, resumo, versoes) com TDD"
```

---

### Task 4: `comporRti` — fotos por achado via `finding_id` (dívida registrada no ROADMAP)

**Files:**
- Modify: `src/lib/campo.ts` (fim do arquivo)
- Modify: `src/lib/campo-queries.ts` (~linha 1020, loop de fotos do `comporRti`)
- Test: `src/lib/__tests__/campo-fotos-achado.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, test } from "vitest";
import { fotosParaAchado } from "../campo";

type F = { id: string; finding_id: string | null };
const f = (id: string, finding_id: string | null): F => ({ id, finding_id });

describe("fotosParaAchado", () => {
  test("se há fotos vinculadas ao achado, usa só elas", () => {
    const fotos = [f("a", "find-1"), f("b", null), f("c", "find-2")];
    expect(fotosParaAchado(fotos, "find-1").map((x) => x.id)).toEqual(["a"]);
  });

  test("sem foto vinculada ao achado, cai para as fotos soltas do ponto (finding_id null)", () => {
    const fotos = [f("a", "find-2"), f("b", null)];
    expect(fotosParaAchado(fotos, "find-1").map((x) => x.id)).toEqual(["b"]);
  });

  test("nunca anexa foto vinculada a OUTRO achado", () => {
    const fotos = [f("a", "find-2")];
    expect(fotosParaAchado(fotos, "find-1")).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/campo-fotos-achado.test.ts`
Expected: FAIL — `fotosParaAchado` não exportada.

- [ ] **Step 3: Implementar em `src/lib/campo.ts`** (append no fim do arquivo):

```ts
/**
 * Fotos que evidenciam um achado específico (trilha C, usa o finding_id da trilha B):
 * se o achado tem fotos vinculadas, só elas entram; senão, as fotos soltas do ponto
 * (finding_id null) servem de evidência compartilhada. Foto vinculada a OUTRO achado
 * nunca entra.
 */
export function fotosParaAchado<T extends { finding_id: string | null }>(
  fotosDoPonto: T[],
  findingId: string,
): T[] {
  const vinculadas = fotosDoPonto.filter((f) => f.finding_id === findingId);
  if (vinculadas.length > 0) return vinculadas;
  return fotosDoPonto.filter((f) => !f.finding_id);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/campo-fotos-achado.test.ts` — PASS.

- [ ] **Step 5: Usar no `comporRti`**

Em `src/lib/campo-queries.ts`, importe `fotosParaAchado` junto dos demais imports de `./campo`. No loop de criação de NC nova (~linha 1020, comentário "Fotos do ponto → evidência de constatação"), troque a fonte do `for`:

```ts
// antes:
for (const ph of fotosDoPonto) {
// depois:
for (const ph of fotosParaAchado(fotosDoPonto, finding.id)) {
```

Atualize o comentário do bloco para: `// Fotos do achado (finding_id) — fallback: fotos soltas do ponto (trilha C).`

- [ ] **Step 6: Verificação e commit**

Run: `npx tsc --noEmit` (sem erros novos) e `npx vitest run` (suíte inteira verde).
```bash
git add src/lib/campo.ts src/lib/campo-queries.ts src/lib/__tests__/campo-fotos-achado.test.ts
git commit -m "feat(campo): comporRti anexa evidencias por achado via finding_id (fallback fotos do ponto)"
```

---

### Task 5: Dependências e fontes do PDF

**Files:**
- Modify: `package.json` (raiz)
- Create: `src/components/rti/pdf/fonts.ts`

- [ ] **Step 1: Instalar dependências**

```bash
npm install @react-pdf/renderer @fontsource/hanken-grotesk
```

- [ ] **Step 2: Criar `src/components/rti/pdf/fonts.ts`**

`@react-pdf` aceita TTF/WOFF (não WOFF2). O `?url` do Vite resolve o asset em runtime.

```ts
import { Font } from "@react-pdf/renderer";
import hk400 from "@fontsource/hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff?url";
import hk600 from "@fontsource/hanken-grotesk/files/hanken-grotesk-latin-600-normal.woff?url";
import hk800 from "@fontsource/hanken-grotesk/files/hanken-grotesk-latin-800-normal.woff?url";

let registered = false;

/** Registra a Hanken Grotesk no @react-pdf uma única vez (idempotente). */
export function registerPdfFonts() {
  if (registered) return;
  registered = true;
  Font.register({
    family: "Hanken Grotesk",
    fonts: [
      { src: hk400, fontWeight: 400 },
      { src: hk600, fontWeight: 600 },
      { src: hk800, fontWeight: 800 },
    ],
  });
  // Hifenização desligada: português fica melhor com quebra por palavra.
  Font.registerHyphenationCallback((word) => [word]);
}
```

**Risco conhecido (spec §9):** se o fontkit recusar o WOFF do @fontsource, o fallback é remover o `registerPdfFonts()` do documento e usar `Helvetica` (builtin) — uma linha no `RtiPdfDocument`. Validar na Task 7.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/components/rti/pdf/fonts.ts
git commit -m "feat(rti): dependencias do PDF (@react-pdf) e fontes Hanken Grotesk"
```

---

### Task 6: IA — sugestão de parecer (puro + server function)

**Files:**
- Create: `src/lib/rti-parecer-ai.ts`
- Create: `src/lib/rti-parecer-ai-server.ts`
- Test: `src/lib/__tests__/rti-parecer-ai.test.ts`

- [ ] **Step 1: Testes que falham**

```ts
import { describe, expect, test } from "vitest";
import { buildParecerInput, normalizeParecerResponse } from "../rti-parecer-ai";

describe("buildParecerInput", () => {
  test("resume NCs por prioridade e limita itens a 60, mais graves primeiro", () => {
    const ncs = Array.from({ length: 70 }, (_, i) => ({
      numero: i + 1,
      descricao: `NC ${i + 1}`,
      recomendacao: null,
      prioridade: i < 5 ? 4 : 1,
    }));
    const input = buildParecerInput({ clienteNome: "Cliente X", titulo: "RTI", normas: "NR-10" }, ncs);
    expect(input.totalNcs).toBe(70);
    expect(input.porPrioridade[4]).toBe(5);
    expect(input.itens).toHaveLength(60);
    expect(input.itens[0].prioridade).toBe(4);
  });

  test("trunca descrições longas em 300 chars", () => {
    const input = buildParecerInput({ clienteNome: "C", titulo: "T", normas: "" }, [
      { numero: 1, descricao: "x".repeat(500), recomendacao: null, prioridade: 2 },
    ]);
    expect(input.itens[0].descricao.length).toBeLessThanOrEqual(300);
  });
});

describe("normalizeParecerResponse", () => {
  test("aceita o JSON esperado", () => {
    const out = normalizeParecerResponse({ parecer: " ok ", resumo_executivo: "res" });
    expect(out).toEqual({ parecer: "ok", resumoExecutivo: "res" });
  });

  test("campos ausentes viram string vazia", () => {
    expect(normalizeParecerResponse({})).toEqual({ parecer: "", resumoExecutivo: "" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/__tests__/rti-parecer-ai.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/lib/rti-parecer-ai.ts`** (puro):

```ts
// Trilha C — preparação do input e normalização da resposta da IA de parecer.
// Puro (sem fetch) — a server function fica em rti-parecer-ai-server.ts.

export interface ParecerNcResumo {
  numero: number;
  descricao: string;
  recomendacao: string | null;
  prioridade: number;
}

export interface ParecerInput {
  cliente: string;
  titulo: string;
  normas: string;
  totalNcs: number;
  porPrioridade: Record<number, number>;
  itens: ParecerNcResumo[];
}

export interface ParecerSugestao {
  parecer: string;
  resumoExecutivo: string;
}

const MAX_ITENS = 60;
const MAX_DESC = 300;

export function buildParecerInput(
  ident: { clienteNome: string; titulo: string; normas: string },
  ncs: { numero: number; descricao: string; recomendacao: string | null; prioridade: number }[],
): ParecerInput {
  const porPrioridade: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const nc of ncs) porPrioridade[nc.prioridade] = (porPrioridade[nc.prioridade] ?? 0) + 1;
  const itens = [...ncs]
    .sort((a, b) => b.prioridade - a.prioridade || a.numero - b.numero)
    .slice(0, MAX_ITENS)
    .map((nc) => ({
      numero: nc.numero,
      descricao: nc.descricao.slice(0, MAX_DESC),
      recomendacao: nc.recomendacao ? nc.recomendacao.slice(0, MAX_DESC) : null,
      prioridade: nc.prioridade,
    }));
  return {
    cliente: ident.clienteNome,
    titulo: ident.titulo,
    normas: ident.normas,
    totalNcs: ncs.length,
    porPrioridade,
    itens,
  };
}

export function normalizeParecerResponse(raw: unknown): ParecerSugestao {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return { parecer: str(obj.parecer), resumoExecutivo: str(obj.resumo_executivo) };
}
```

- [ ] **Step 4: Rodar e ver passar** — PASS (4 testes).

- [ ] **Step 5: Implementar `src/lib/rti-parecer-ai-server.ts`** (espelha o padrão de `certificados-ai-server.ts` — retry 429, fallback de modelo, `GROQ_API_KEY`):

```ts
import { createServerFn } from "@tanstack/react-start";
import { normalizeParecerResponse, type ParecerInput, type ParecerSugestao } from "./rti-parecer-ai";

const MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "qwen/qwen3.6-27b";
const MAX_RETRIES = 3;

const PROMPT_SYSTEM =
  "Você é um engenheiro eletricista consultor, redigindo o parecer técnico de um Relatório " +
  "Técnico de Inspeção (RTI) de instalações elétricas conforme a NR-10, em português formal " +
  "brasileiro. Seja objetivo, técnico e sem alarmismo. O texto será REVISADO por um humano " +
  "responsável (ART) antes de emitir — é uma sugestão. Responda em JSON estrito no formato " +
  '{"parecer": "...", "resumo_executivo": "..."}. O parecer tem 3 a 6 parágrafos: estado geral ' +
  "da instalação, principais riscos pelas NCs mais graves, e conclusão com recomendação de " +
  "priorização. O resumo_executivo tem 1 parágrafo para gestores.";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroq(apiKey: string, input: ParecerInput, model: string = MODEL): Promise<ParecerSugestao> {
  const body = {
    model,
    messages: [
      { role: "system", content: PROMPT_SYSTEM },
      { role: "user", content: `Dados estruturados da inspeção:\n${JSON.stringify(input)}` },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  };
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      return normalizeParecerResponse(JSON.parse(data.choices[0].message.content as string));
    }
    const errBody = await res.text();
    if (res.status === 429 && attempt < MAX_RETRIES - 1) {
      const m = errBody.match(/try again in ([\d.]+)s/);
      await sleep((m ? parseFloat(m[1]) + 1 : 8) * 1000);
      continue;
    }
    throw new Error(`Groq HTTP ${res.status}: ${errBody}`);
  }
  throw new Error("Groq: limite de requisições excedido após múltiplas tentativas.");
}

/** Sugere parecer + resumo executivo a partir do resumo estruturado das NCs.
 * Nenhum dado além do resumo textual das NCs sai do servidor; sempre revisado por humano. */
export const sugerirParecer = createServerFn({ method: "POST" })
  .validator((data: { input: ParecerInput }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY não configurada no servidor.");
    try {
      return await callGroq(apiKey, data.input);
    } catch (err) {
      console.error(`Falha com o modelo principal (${MODEL}), tentando fallback`, err);
      return callGroq(apiKey, data.input, FALLBACK_MODEL);
    }
  });
```

- [ ] **Step 6: Verificação e commit**

Run: `npx tsc --noEmit` (sem erros novos).
```bash
git add src/lib/rti-parecer-ai.ts src/lib/rti-parecer-ai-server.ts src/lib/__tests__/rti-parecer-ai.test.ts
git commit -m "feat(rti): IA de parecer do relatorio (Groq) — input puro testado + server function"
```

---

### Task 7: Documento PDF (@react-pdf)

**Files:**
- Create: `src/components/rti/pdf/RtiPdfDocument.tsx`
- Create: `src/components/rti/pdf/gerarPdfBlob.tsx`
- Create: `src/components/rti/pdf/PdfPreview.tsx`

- [ ] **Step 1: Criar `RtiPdfDocument.tsx`**

Cores: primária do branding com fallback `#0C3326` (pinho Conforme). O CLAUDE.md proíbe hex fora do `styles.css` **no app** — o PDF é um documento à parte, fora do runtime Tailwind; hex aqui é aceitável e inevitável (@react-pdf não lê CSS vars).

```tsx
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfModel } from "@/lib/rti-relatorio";
import { PRIORIDADE_LABEL } from "@/lib/rti-relatorio";
import { registerPdfFonts } from "./fonts";

registerPdfFonts();

const PINE = "#0C3326";

const s = StyleSheet.create({
  page: { fontFamily: "Hanken Grotesk", fontSize: 10, paddingTop: 64, paddingBottom: 56, paddingHorizontal: 48, color: "#1a1a1a" },
  header: { position: "absolute", top: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#666" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#666" },
  h1: { fontSize: 22, fontWeight: 800, marginBottom: 8 },
  h2: { fontSize: 14, fontWeight: 800, marginTop: 16, marginBottom: 8 },
  capa: { flex: 1, justifyContent: "center" },
  capaBox: { borderLeftWidth: 4, paddingLeft: 16, marginTop: 24 },
  label: { fontSize: 8, color: "#666", marginTop: 6 },
  valor: { fontSize: 11, fontWeight: 600 },
  p: { marginBottom: 6, lineHeight: 1.5, textAlign: "justify" },
  ncCard: { marginBottom: 14, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  ncTitulo: { fontSize: 11, fontWeight: 800, marginBottom: 3 },
  ncMeta: { fontSize: 8, color: "#666", marginBottom: 4 },
  fotoRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  foto: { width: 160, height: 120, objectFit: "cover", borderRadius: 3 },
  tabela: { marginTop: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 4 },
  th: { fontWeight: 800, fontSize: 9 },
  tdPrio: { width: "40%" }, tdQtd: { width: "20%" }, tdCusto: { width: "40%" },
  assinatura: { marginTop: 64, alignItems: "center" },
  linhaAssin: { width: 260, borderTopWidth: 1, borderTopColor: "#1a1a1a", paddingTop: 6, alignItems: "center" },
});

const fmtBRL = (v: number) =>
  `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

const fmtData = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function HeaderFooter({ model }: { model: PdfModel }) {
  return (
    <>
      <View style={s.header} fixed>
        <Text>{model.branding.razaoSocial ?? model.identificacao.titulo}</Text>
        <Text>{model.identificacao.titulo}</Text>
      </View>
      <View style={s.footer} fixed>
        <Text>Emitido em {model.emitidoEm}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

export function RtiPdfDocument({ model }: { model: PdfModel }) {
  const cor = model.branding.corPrimaria || PINE;
  const ident = model.identificacao;
  return (
    <Document title={ident.titulo} author={model.branding.razaoSocial ?? undefined}>
      {/* Capa */}
      <Page size="A4" style={s.page}>
        <View style={s.capa}>
          {model.branding.logoUrl ? (
            <Image src={model.branding.logoUrl} style={{ width: 140, marginBottom: 24 }} />
          ) : null}
          <Text style={[s.h1, { color: cor }]}>Relatório Técnico de Inspeção</Text>
          <Text style={{ fontSize: 13, fontWeight: 600 }}>{ident.titulo}</Text>
          <View style={[s.capaBox, { borderLeftColor: cor }]}>
            <Text style={s.label}>Cliente</Text>
            <Text style={s.valor}>{ident.clienteNome || "—"}</Text>
            {ident.local ? (
              <>
                <Text style={s.label}>Local</Text>
                <Text style={s.valor}>{ident.local}</Text>
              </>
            ) : null}
            <Text style={s.label}>Período da inspeção</Text>
            <Text style={s.valor}>{fmtData(ident.periodoInicio)} a {fmtData(ident.periodoFim)}</Text>
            <Text style={s.label}>Responsável técnico</Text>
            <Text style={s.valor}>{ident.responsavelTecnico || "—"}</Text>
            {ident.artNumero ? (
              <>
                <Text style={s.label}>ART</Text>
                <Text style={s.valor}>{ident.artNumero}</Text>
              </>
            ) : null}
            <Text style={s.label}>Referencial normativo</Text>
            <Text style={s.valor}>{ident.normas || "—"}</Text>
          </View>
        </View>
      </Page>

      {/* Introdução, metodologia e resumo executivo */}
      <Page size="A4" style={s.page}>
        <HeaderFooter model={model} />
        <Text style={[s.h2, { color: cor }]}>1. Introdução</Text>
        <Text style={s.p}>{ident.introducao}</Text>
        <Text style={[s.h2, { color: cor }]}>2. Metodologia</Text>
        <Text style={s.p}>{ident.metodologia}</Text>
        {model.resumoExecutivo ? (
          <>
            <Text style={[s.h2, { color: cor }]}>3. Resumo executivo</Text>
            <Text style={s.p}>{model.resumoExecutivo}</Text>
          </>
        ) : null}
        <Text style={[s.h2, { color: cor }]}>Quadro-resumo por prioridade</Text>
        <View style={s.tabela}>
          <View style={s.tr}>
            <Text style={[s.th, s.tdPrio]}>Prioridade</Text>
            <Text style={[s.th, s.tdQtd]}>NCs</Text>
            <Text style={[s.th, s.tdCusto]}>Custo planejado</Text>
          </View>
          {model.resumo.map((l) => (
            <View key={l.prioridade} style={s.tr}>
              <Text style={s.tdPrio}>{l.label}</Text>
              <Text style={s.tdQtd}>{l.quantidade}</Text>
              <Text style={s.tdCusto}>{fmtBRL(l.custoPlanejado)}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* NCs */}
      <Page size="A4" style={s.page}>
        <HeaderFooter model={model} />
        <Text style={[s.h2, { color: cor }]}>Não conformidades constatadas</Text>
        {model.ncs.map((nc) => (
          <View key={nc.id} style={s.ncCard} wrap={false} minPresenceAhead={80}>
            <Text style={s.ncTitulo}>NC {String(nc.numero).padStart(3, "0")} — {PRIORIDADE_LABEL[nc.prioridade]}</Text>
            <Text style={s.ncMeta}>
              Área: {nc.areaNome}
              {nc.tipoExecucao === "investimento" ? "  ·  Investimento" : nc.osNumero ? `  ·  O.S. ${nc.osNumero}` : ""}
              {nc.custoPlanejado ? `  ·  ${fmtBRL(nc.custoPlanejado)}` : ""}
            </Text>
            <Text style={s.p}>{nc.descricao}</Text>
            {nc.recomendacao ? <Text style={s.p}>Recomendação: {nc.recomendacao}</Text> : null}
            {nc.fotos.length > 0 ? (
              <View style={s.fotoRow}>
                {nc.fotos.map((f) => (
                  <Image key={f.id} src={f.url} style={s.foto} />
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </Page>

      {/* Parecer e assinatura */}
      <Page size="A4" style={s.page}>
        <HeaderFooter model={model} />
        <Text style={[s.h2, { color: cor }]}>Parecer técnico</Text>
        {model.parecer.split("\n").filter(Boolean).map((par, i) => (
          <Text key={i} style={s.p}>{par}</Text>
        ))}
        <View style={s.assinatura}>
          <View style={s.linhaAssin}>
            <Text style={{ fontWeight: 600 }}>{ident.responsavelTecnico || " "}</Text>
            {model.branding.registroProfissional ? <Text style={{ fontSize: 8 }}>{model.branding.registroProfissional}</Text> : null}
            {ident.artNumero ? <Text style={{ fontSize: 8 }}>ART {ident.artNumero}</Text> : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
```

Nota: `wrap={false}` + `minPresenceAhead` evita NC cortada no meio da página; NC com muitas fotos pode estourar uma página — se acontecer no teste real, remover `wrap={false}` só do card (deixar as fotos quebrarem).

- [ ] **Step 2: Criar `gerarPdfBlob.tsx`**

```tsx
import { pdf } from "@react-pdf/renderer";
import type { PdfModel } from "@/lib/rti-relatorio";
import { RtiPdfDocument } from "./RtiPdfDocument";

/** Renderiza o documento no navegador e devolve o Blob final (emissão). */
export async function gerarPdfBlob(model: PdfModel): Promise<Blob> {
  return pdf(<RtiPdfDocument model={model} />).toBlob();
}
```

- [ ] **Step 3: Criar `PdfPreview.tsx`** (default export para `React.lazy`; só roda no client):

```tsx
import { PDFViewer } from "@react-pdf/renderer";
import type { PdfModel } from "@/lib/rti-relatorio";
import { RtiPdfDocument } from "./RtiPdfDocument";

export default function PdfPreview({ model }: { model: PdfModel }) {
  return (
    <PDFViewer className="h-[75vh] w-full rounded-md border" showToolbar>
      <RtiPdfDocument model={model} />
    </PDFViewer>
  );
}
```

- [ ] **Step 4: Verificação e commit**

Run: `npx tsc --noEmit` (sem erros novos). A validação visual acontece na Task 11 (preview no navegador — inclusive o risco da fonte WOFF).
```bash
git add src/components/rti/pdf/
git commit -m "feat(rti): documento PDF do relatorio (@react-pdf) — capa, NCs com fotos, resumo, parecer"
```

---

### Task 8: Queries do wizard

**Files:**
- Create: `src/lib/rti-relatorio-queries.ts`

- [ ] **Step 1: Implementar**

```ts
// Trilha C — React Query + Supabase do wizard de relatório.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { RtiReport } from "@/lib/rti";
import {
  proximaVersao,
  relatorioPdfPath,
  type NcsOverrides,
  type PdfFoto,
  type WizardIdentificacao,
} from "@/lib/rti-relatorio";

export interface WizardDraft {
  report_id: string;
  etapa_atual: number;
  identificacao: Partial<WizardIdentificacao>;
  ncs_overrides: NcsOverrides;
  parecer: string | null;
  resumo_executivo: string | null;
}

export interface RtiReportPdf {
  id: string;
  report_id: string;
  versao: number;
  file_path: string;
  emitido_por_nome: string | null;
  emitido_em: string;
}

const publicUrl = (path: string) =>
  supabase.storage.from("rti-evidencias").getPublicUrl(path).data.publicUrl;

export function useRtiReport(reportId?: string) {
  return useQuery({
    queryKey: ["rti_report", reportId ?? "none"],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_reports")
        .select("*")
        .eq("id", reportId!)
        .single();
      if (error) throw error;
      return data as RtiReport;
    },
  });
}

export function useWizardDraft(reportId?: string) {
  return useQuery({
    queryKey: ["rti_report_wizard", reportId ?? "none"],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_report_wizard")
        .select("*")
        .eq("report_id", reportId!)
        .maybeSingle();
      if (error) throw error;
      return (data as WizardDraft | null) ?? null;
    },
  });
}

export function useSaveWizardDraft(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: Omit<WizardDraft, "report_id">) => {
      const { error } = await supabase
        .from("rti_report_wizard")
        .upsert({ report_id: reportId, ...draft } as never, { onConflict: "report_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rti_report_wizard", reportId] }),
  });
}

/** Fotos de constatação por NC (evidências) — já como URL pública p/ o PDF. */
export function useFotosPorNc(reportId?: string, ncIds?: string[]) {
  return useQuery({
    queryKey: ["rti_wizard_fotos", reportId ?? "none", ncIds?.length ?? 0],
    enabled: !!reportId && !!ncIds && ncIds.length > 0,
    queryFn: async () => {
      const porNc: Record<string, PdfFoto[]> = {};
      for (let i = 0; i < ncIds!.length; i += 200) {
        const { data, error } = await supabase
          .from("rti_nc_evidencias")
          .select("id, nc_id, file_path, descricao")
          .in("nc_id", ncIds!.slice(i, i + 200))
          .eq("tipo", "constatacao")
          .order("created_at");
        if (error) throw error;
        for (const ev of data ?? []) {
          (porNc[ev.nc_id] ??= []).push({
            id: ev.id,
            url: publicUrl(ev.file_path),
            legenda: ev.descricao,
          });
        }
      }
      return porNc;
    },
  });
}

export function useReportPdfs(reportId?: string) {
  return useQuery({
    queryKey: ["rti_report_pdfs", reportId ?? "none"],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_report_pdfs")
        .select("*")
        .eq("report_id", reportId!)
        .order("versao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RtiReportPdf[];
    },
  });
}

/** Emite: sobe o Blob no Storage (nunca sobrescreve) + registra a versão. */
export function useEmitirPdf() {
  const qc = useQueryClient();
  const auth = useAuth();
  return useMutation({
    mutationFn: async (args: { report: RtiReport; blob: Blob; pdfs: { versao: number }[] }) => {
      const orgId = args.report.org_id;
      if (!orgId) throw new Error("Relatório sem organização.");
      const versao = proximaVersao(args.pdfs);
      const path = relatorioPdfPath(orgId, args.report, versao, auth.currentOrg?.nome);
      const { error: upErr } = await supabase.storage
        .from("rti-evidencias")
        .upload(path, args.blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("rti_report_pdfs").insert({
        report_id: args.report.id,
        versao,
        file_path: path,
        emitido_por: auth.user?.id ?? null,
        emitido_por_nome: auth.profile?.full_name ?? null,
      } as never);
      if (insErr) throw insErr;
      // Aponta o report_path pro PDF mais novo (só antes da entrega — depois o selo congela).
      if (!args.report.entregue_em) {
        await supabase.from("rti_reports").update({ report_path: path }).eq("id", args.report.id);
      }
      return { versao, path, url: publicUrl(path) };
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["rti_report_pdfs", args.report.id] });
      qc.invalidateQueries({ queryKey: ["rti_report", args.report.id] });
    },
  });
}

export function useSetOrgBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      orgId: string;
      logoPath: string | null;
      corPrimaria: string | null;
      razaoSocial: string | null;
      registroProfissional: string | null;
    }) => {
      const { error } = await supabase.rpc("fn_set_org_branding", {
        _org_id: args.orgId,
        _logo_path: args.logoPath,
        _cor_primaria: args.corPrimaria,
        _razao_social_relatorio: args.razaoSocial,
        _registro_profissional: args.registroProfissional,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org_branding"] }),
  });
}

/** Branding da org entregadora (a org atual do consultor), com URL pública do logo. */
export function useOrgBranding(orgId?: string | null) {
  return useQuery({
    queryKey: ["org_branding", orgId ?? "none"],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nome, logo_path, cor_primaria, razao_social_relatorio, registro_profissional")
        .eq("id", orgId!)
        .single();
      if (error) throw error;
      return {
        logoUrl: data.logo_path
          ? supabase.storage.from("org-assets").getPublicUrl(data.logo_path).data.publicUrl
          : null,
        corPrimaria: data.cor_primaria,
        razaoSocial: data.razao_social_relatorio ?? data.nome,
        registroProfissional: data.registro_profissional,
      };
    },
  });
}
```

Atenção a dois pontos de integração (verificar nomes reais ao implementar, ambos já usados no codebase): `useAuth()` — conferir em `src/lib/auth-context.tsx` como se chamam `user`/`profile` (se o perfil não expõe `full_name`, usar o que o `EntregarRtiDialog` usa como nome do autor); `RtiReport` — importado de `@/lib/rti` (mesmo import usado por `rti-queries.ts`).

- [ ] **Step 2: Verificação e commit**

Run: `npx tsc --noEmit` (sem erros novos).
```bash
git add src/lib/rti-relatorio-queries.ts
git commit -m "feat(rti): queries do wizard — rascunho, fotos por NC, versoes de PDF, emissao, branding"
```

---

### Task 9: Componentes das etapas 1–3

**Files:**
- Create: `src/components/rti/wizard/StepIdentificacao.tsx`
- Create: `src/components/rti/wizard/StepNcs.tsx`
- Create: `src/components/rti/wizard/StepParecer.tsx`

Todos controlados por props (`value`/`onChange`) — o estado vive na rota (Task 10). Usar componentes shadcn existentes (`Input`, `Textarea`, `Label`, `Switch`, `Card`).

- [ ] **Step 1: `StepIdentificacao.tsx`**

```tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WizardIdentificacao } from "@/lib/rti-relatorio";

const campos: { key: keyof WizardIdentificacao; label: string; tipo?: "date" }[] = [
  { key: "titulo", label: "Título do relatório" },
  { key: "clienteNome", label: "Cliente" },
  { key: "local", label: "Local / unidade" },
  { key: "periodoInicio", label: "Início da inspeção", tipo: "date" },
  { key: "periodoFim", label: "Fim da inspeção", tipo: "date" },
  { key: "responsavelTecnico", label: "Responsável técnico" },
  { key: "artNumero", label: "Nº da ART" },
  { key: "normas", label: "Referencial normativo" },
];

export function StepIdentificacao({
  value,
  onChange,
}: {
  value: WizardIdentificacao;
  onChange: (v: WizardIdentificacao) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {campos.map((c) => (
        <div key={c.key} className="space-y-1.5">
          <Label htmlFor={`ident-${c.key}`}>{c.label}</Label>
          <Input
            id={`ident-${c.key}`}
            type={c.tipo ?? "text"}
            value={(value[c.key] as string | null) ?? ""}
            onChange={(e) => onChange({ ...value, [c.key]: e.target.value || (c.tipo === "date" ? null : "") })}
          />
        </div>
      ))}
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="ident-introducao">Introdução</Label>
        <Textarea id="ident-introducao" rows={4} value={value.introducao}
          onChange={(e) => onChange({ ...value, introducao: e.target.value })} />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="ident-metodologia">Metodologia</Label>
        <Textarea id="ident-metodologia" rows={4} value={value.metodologia}
          onChange={(e) => onChange({ ...value, metodologia: e.target.value })} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `StepNcs.tsx`** — revisão seriada: uma NC por vez, navegação anterior/próxima, texto editável (vira override), toggle de inclusão, fotos com exclusão por clique:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PRIORIDADE_LABEL, type NcParaPdf, type NcsOverrides } from "@/lib/rti-relatorio";

export function StepNcs({
  ncs,
  overrides,
  onChange,
}: {
  ncs: NcParaPdf[]; // ordem por numero, SEM overrides aplicados (edição sempre parte do original)
  overrides: NcsOverrides;
  onChange: (v: NcsOverrides) => void;
}) {
  const [idx, setIdx] = useState(0);
  if (ncs.length === 0) return <p className="text-sm text-muted-foreground">Este relatório não tem NCs.</p>;
  const nc = ncs[Math.min(idx, ncs.length - 1)];
  const o = overrides[nc.id] ?? {};
  const set = (patch: Partial<(typeof overrides)[string]>) =>
    onChange({ ...overrides, [nc.id]: { ...o, ...patch } });
  const excluidas = new Set(o.fotosExcluidas ?? []);
  const incluida = o.incluir !== false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">
            NC {String(nc.numero).padStart(3, "0")} · {PRIORIDADE_LABEL[nc.prioridade]} · {nc.areaNome}
          </p>
          <p className="text-xs text-muted-foreground">{idx + 1} de {ncs.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="nc-incluir" className="text-sm">Incluir no relatório</Label>
          <Switch id="nc-incluir" checked={incluida} onCheckedChange={(v) => set({ incluir: v })} />
        </div>
      </div>

      <div className={cn("space-y-3", !incluida && "pointer-events-none opacity-40")}>
        <div className="space-y-1.5">
          <Label>Descrição (edição só no relatório — o registro técnico não muda)</Label>
          <Textarea rows={3} value={o.descricao ?? nc.descricao}
            onChange={(e) => set({ descricao: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Recomendação</Label>
          <Textarea rows={3} value={o.recomendacao ?? nc.recomendacao ?? ""}
            onChange={(e) => set({ recomendacao: e.target.value })} />
        </div>
        {nc.fotos.length > 0 && (
          <div>
            <Label className="mb-2 block">Fotos (clique para excluir/incluir no PDF)</Label>
            <div className="flex flex-wrap gap-2">
              {nc.fotos.map((f) => {
                const fora = excluidas.has(f.id);
                return (
                  <button key={f.id} type="button"
                    className={cn("relative overflow-hidden rounded-md border", fora && "opacity-30 grayscale")}
                    onClick={() => {
                      const next = new Set(excluidas);
                      if (fora) next.delete(f.id); else next.add(f.id);
                      set({ fotosExcluidas: [...next] });
                    }}>
                    <img src={f.url} alt="" className="h-24 w-32 object-cover" loading="lazy" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          ← NC anterior
        </Button>
        <Button variant="outline" size="sm" disabled={idx >= ncs.length - 1} onClick={() => setIdx(idx + 1)}>
          Próxima NC →
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `StepParecer.tsx`** — botão de sugestão IA + textareas:

```tsx
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildParecerInput } from "@/lib/rti-parecer-ai";
import { sugerirParecer } from "@/lib/rti-parecer-ai-server";
import type { NcParaPdf, WizardIdentificacao } from "@/lib/rti-relatorio";

export function StepParecer({
  identificacao,
  ncs, // já com overrides aplicados (o parecer fala do que vai pro PDF)
  parecer,
  resumoExecutivo,
  onChange,
}: {
  identificacao: WizardIdentificacao;
  ncs: NcParaPdf[];
  parecer: string;
  resumoExecutivo: string;
  onChange: (v: { parecer: string; resumoExecutivo: string }) => void;
}) {
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setGerando(true);
    try {
      const input = buildParecerInput(identificacao, ncs);
      const sugestao = await sugerirParecer({ data: { input } });
      onChange({ parecer: sugestao.parecer, resumoExecutivo: sugestao.resumoExecutivo });
      toast.success("Sugestão gerada — revise e edite antes de emitir.");
    } catch (err) {
      toast.error(`Falha ao gerar sugestão: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          A IA sugere um rascunho a partir das NCs. O texto é <strong>sempre seu</strong> — revise antes de emitir.
        </p>
        <Button variant="outline" size="sm" onClick={gerar} disabled={gerando || ncs.length === 0}>
          <Sparkles className="mr-1.5 h-4 w-4" />
          {gerando ? "Gerando…" : parecer ? "Gerar de novo (substitui)" : "Sugerir com IA"}
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="parecer-resumo">Resumo executivo</Label>
        <Textarea id="parecer-resumo" rows={4} value={resumoExecutivo}
          onChange={(e) => onChange({ parecer, resumoExecutivo: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="parecer-texto">Parecer técnico</Label>
        <Textarea id="parecer-texto" rows={14} value={parecer}
          onChange={(e) => onChange({ parecer: e.target.value, resumoExecutivo })} />
      </div>
    </div>
  );
}
```

Nota: a assinatura de chamada da server function (`sugerirParecer({ data: { input } })`) deve seguir o mesmo padrão de chamada que o app já usa para `analyzeCertificatePage` — conferir o call site em `src/routes/admin.certificados*` e replicar.

- [ ] **Step 4: Verificação e commit**

Run: `npx tsc --noEmit` (sem erros novos — os componentes ainda não são usados).
```bash
git add src/components/rti/wizard/
git commit -m "feat(rti): etapas 1-3 do wizard — identificacao, revisao seriada de NCs, parecer com IA"
```

---

### Task 10: Rota do wizard (estado, autosave, preview e emissão)

**Files:**
- Create: `src/routes/rti.relatorio.$reportId.wizard.tsx`

- [ ] **Step 1: Implementar a rota**

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useRtiAreas, useRtiNcs } from "@/lib/rti-queries";
import {
  useEmitirPdf,
  useFotosPorNc,
  useOrgBranding,
  useReportPdfs,
  useRtiReport,
  useSaveWizardDraft,
  useWizardDraft,
} from "@/lib/rti-relatorio-queries";
import {
  buildPdfModel,
  defaultIdentificacao,
  mergeNcOverrides,
  type NcParaPdf,
  type NcsOverrides,
  type WizardIdentificacao,
} from "@/lib/rti-relatorio";
import { StepIdentificacao } from "@/components/rti/wizard/StepIdentificacao";
import { StepNcs } from "@/components/rti/wizard/StepNcs";
import { StepParecer } from "@/components/rti/wizard/StepParecer";

const PdfPreview = lazy(() => import("@/components/rti/pdf/PdfPreview"));

export const Route = createFileRoute("/rti/relatorio/$reportId/wizard")({
  component: WizardRelatorioPage,
});

const ETAPAS = ["Identificação", "Revisão de NCs", "Parecer técnico", "Preview", "Emitir"];

function WizardRelatorioPage() {
  const { reportId } = Route.useParams();
  const auth = useAuth();
  const report = useRtiReport(reportId);
  const areas = useRtiAreas(reportId);
  const ncsQ = useRtiNcs(reportId);
  const draft = useWizardDraft(reportId);
  const saveDraft = useSaveWizardDraft(reportId);
  const pdfs = useReportPdfs(reportId);
  // Branding da org entregadora = org atual do consultor (quem emite assina).
  const branding = useOrgBranding(auth.currentOrgId);

  const [etapa, setEtapa] = useState(1);
  const [ident, setIdent] = useState<WizardIdentificacao | null>(null);
  const [overrides, setOverrides] = useState<NcsOverrides>({});
  const [parecer, setParecer] = useState("");
  const [resumoExecutivo, setResumoExecutivo] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Hidrata o estado uma única vez quando report + rascunho chegam.
  const hidratado = useRef(false);
  useEffect(() => {
    if (hidratado.current || !report.data || draft.isLoading) return;
    hidratado.current = true;
    const base = defaultIdentificacao(report.data, auth.currentOrg?.nome);
    const d = draft.data;
    setIdent({ ...base, ...((d?.identificacao ?? {}) as Partial<WizardIdentificacao>) });
    setOverrides((d?.ncs_overrides ?? {}) as NcsOverrides);
    setParecer(d?.parecer ?? "");
    setResumoExecutivo(d?.resumo_executivo ?? "");
    setEtapa(d?.etapa_atual ?? 1);
  }, [report.data, draft.data, draft.isLoading, auth.currentOrg?.nome]);

  // Autosave: debounce 1,5s sobre qualquer mudança (o wizard nunca perde edição).
  useEffect(() => {
    if (!hidratado.current || !ident) return;
    const t = setTimeout(() => {
      saveDraft.mutate({
        etapa_atual: etapa,
        identificacao: ident,
        ncs_overrides: overrides,
        parecer: parecer || null,
        resumo_executivo: resumoExecutivo || null,
      });
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, ident, overrides, parecer, resumoExecutivo]);

  // NCs no formato do PDF
  const areaNome = useMemo(
    () => new Map((areas.data ?? []).map((a) => [a.id, a.nome])),
    [areas.data],
  );
  const ncIds = useMemo(() => (ncsQ.data ?? []).map((n) => n.id), [ncsQ.data]);
  const fotos = useFotosPorNc(reportId, ncIds);
  const ncsPdf: NcParaPdf[] = useMemo(
    () =>
      (ncsQ.data ?? []).map((nc) => ({
        id: nc.id,
        numero: nc.numero,
        areaNome: areaNome.get(nc.area_id) ?? "—",
        descricao: nc.descricao,
        recomendacao: nc.recomendacao,
        prioridade: nc.prioridade,
        tipoExecucao: nc.tipo_execucao,
        osNumero: nc.os_numero,
        custoPlanejado: Number(nc.custo_planejado ?? 0),
        fotos: fotos.data?.[nc.id] ?? [],
      })),
    [ncsQ.data, areaNome, fotos.data],
  );

  const model = useMemo(() => {
    if (!ident) return null;
    return buildPdfModel({
      identificacao: ident,
      branding: branding.data ?? null,
      ncs: ncsPdf,
      overrides,
      parecer,
      resumoExecutivo,
    });
  }, [ident, branding.data, ncsPdf, overrides, parecer, resumoExecutivo]);

  const emitir = useEmitirPdf();
  const [emitidoUrl, setEmitidoUrl] = useState<string | null>(null);

  async function onEmitir() {
    if (!model || !report.data) return;
    try {
      const { gerarPdfBlob } = await import("@/components/rti/pdf/gerarPdfBlob");
      const blob = await gerarPdfBlob(model);
      const r = await emitir.mutateAsync({ report: report.data, blob, pdfs: pdfs.data ?? [] });
      setEmitidoUrl(r.url);
      toast.success(`Relatório v${r.versao} emitido.`);
    } catch (err) {
      toast.error(`Falha na emissão (o rascunho está salvo): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (report.isLoading || !ident) {
    return (
      <PageShell>
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando relatório…
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl space-y-4 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Gerar relatório — {report.data?.titulo}</h1>
            <p className="text-sm text-muted-foreground">
              {saveDraft.isPending ? "Salvando rascunho…" : "Rascunho salvo automaticamente"}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/rti/plano">Voltar ao plano</Link>
          </Button>
        </div>

        {/* Stepper */}
        <div className="flex flex-wrap gap-1.5">
          {ETAPAS.map((nome, i) => {
            const n = i + 1;
            return (
              <button key={nome} type="button" onClick={() => setEtapa(n)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  etapa === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                {n}. {nome}
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ETAPAS[etapa - 1]}</CardTitle>
          </CardHeader>
          <CardContent>
            {etapa === 1 && <StepIdentificacao value={ident} onChange={setIdent} />}
            {etapa === 2 && <StepNcs ncs={ncsPdf} overrides={overrides} onChange={setOverrides} />}
            {etapa === 3 && (
              <StepParecer
                identificacao={ident}
                ncs={mergeNcOverrides(ncsPdf, overrides)}
                parecer={parecer}
                resumoExecutivo={resumoExecutivo}
                onChange={(v) => { setParecer(v.parecer); setResumoExecutivo(v.resumoExecutivo); }}
              />
            )}
            {etapa === 4 && mounted && model && (
              <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Montando preview…</div>}>
                <PdfPreview model={model} />
              </Suspense>
            )}
            {etapa === 5 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  A emissão gera o PDF final e o arquiva com número de versão — reemitir cria uma
                  versão nova, nunca sobrescreve. Depois de emitir, a entrega ao cliente (selo)
                  continua sendo feita pelo plano de ação.
                </p>
                <Button onClick={onEmitir} disabled={emitir.isPending || !model}>
                  {emitir.isPending ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Emitindo…</>
                  ) : (
                    <><FileText className="mr-1.5 h-4 w-4" /> Emitir PDF{pdfs.data?.length ? ` (v${(pdfs.data[0]?.versao ?? 0) + 1})` : " (v1)"}</>
                  )}
                </Button>
                {emitidoUrl && (
                  <p className="flex items-center gap-2 text-sm text-primary">
                    <Check className="h-4 w-4" />
                    <a href={emitidoUrl} target="_blank" rel="noreferrer" className="underline">Abrir PDF emitido</a>
                  </p>
                )}
                {(pdfs.data?.length ?? 0) > 0 && (
                  <div className="space-y-1 border-t pt-3">
                    <p className="text-sm font-medium">Versões emitidas</p>
                    {pdfs.data!.map((p) => (
                      <p key={p.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Download className="h-3.5 w-3.5" />
                        v{p.versao} · {new Date(p.emitido_em).toLocaleString("pt-BR")}
                        {p.emitido_por_nome ? ` · ${p.emitido_por_nome}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" disabled={etapa === 1} onClick={() => setEtapa(etapa - 1)}>← Anterior</Button>
          <Button disabled={etapa === 5} onClick={() => setEtapa(etapa + 1)}>Próxima →</Button>
        </div>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 2: Regenerar a árvore de rotas**

O plugin do TanStack Router regenera `src/routeTree.gen.ts` quando o dev server (porta 57010, do usuário) ou `npm run build` roda. Rodar `npm run build:dev` se o gen não atualizar sozinho. **Não editar o arquivo gerado à mão.**

- [ ] **Step 3: Verificação e commit**

Run: `npx tsc --noEmit` (sem erros novos) e `npm run build` (verde).
```bash
git add src/routes/rti.relatorio.\$reportId.wizard.tsx src/routeTree.gen.ts
git commit -m "feat(rti): rota do wizard de relatorio — 5 etapas, autosave, preview e emissao versionada"
```

---

### Task 11: Pontos de entrada — botão no plano + branding em admin/empresas + validação no navegador

**Files:**
- Modify: `src/routes/rti.plano.tsx` (~linha 383, bloco de botões do header)
- Create: `src/components/org-branding-dialog.tsx`
- Modify: `src/routes/admin.empresas.tsx` (`EditarEmpresaPanel`, ~linha 625)

- [ ] **Step 1: Botão "Gerar relatório" no plano de ação**

Em `rti.plano.tsx`, no bloco do header onde já ficam os botões de entrega (entre as linhas ~361–403), adicionar antes do botão "Entregar relatório":

```tsx
{repAcc?.canEntregar && (
  <Button asChild size="sm" variant="outline">
    <Link to="/rti/relatorio/$reportId/wizard" params={{ reportId: activeReport.id }}>
      <FileText className="mr-1.5 h-4 w-4" /> Gerar relatório
    </Link>
  </Button>
)}
```

Conferir imports: `Link` de `@tanstack/react-router` e `FileText` de `lucide-react` (adicionar se faltarem).

- [ ] **Step 2: `org-branding-dialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrgBranding, useSetOrgBranding } from "@/lib/rti-relatorio-queries";

export function OrgBrandingDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const branding = useOrgBranding(open ? orgId : null);
  const save = useSetOrgBranding();
  const [razao, setRazao] = useState("");
  const [registro, setRegistro] = useState("");
  const [cor, setCor] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!branding.data) return;
    setRazao(branding.data.razaoSocial ?? "");
    setRegistro(branding.data.registroProfissional ?? "");
    setCor(branding.data.corPrimaria ?? "");
    // logoPath só muda se o usuário subir arquivo novo — mantém o atual por padrão
  }, [branding.data]);

  async function handleSave() {
    try {
      let path = logoPath;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        path = `${orgId}/logo-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("org-assets").upload(path, logoFile, {
          contentType: logoFile.type,
          upsert: false,
        });
        if (error) throw error;
      }
      await save.mutateAsync({
        orgId,
        logoPath: path,
        corPrimaria: cor.trim() || null,
        razaoSocial: razao.trim() || null,
        registroProfissional: registro.trim() || null,
      });
      toast.success("Identidade do relatório salva.");
      onOpenChange(false);
    } catch (err) {
      toast.error(`Falha ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Identidade do relatório (white-label)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Razão social exibida no PDF</Label>
            <Input value={razao} onChange={(e) => setRazao(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Registro profissional (ex.: CREA-SP 0000000000)</Label>
            <Input value={registro} onChange={(e) => setRegistro(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cor primária (hex, ex.: #0C3326)</Label>
            <Input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="#0C3326" />
          </div>
          <div className="space-y-1.5">
            <Label>Logo (PNG/JPG — fundo transparente fica melhor)</Label>
            {branding.data?.logoUrl && !logoFile && (
              <img src={branding.data.logoUrl} alt="Logo atual" className="h-12 rounded border bg-white object-contain p-1" />
            )}
            <Input type="file" accept="image/png,image/jpeg"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Detalhe: o dialog nunca reenvia `logoPath` antigo porque o RPC grava o que receber — ao salvar sem arquivo novo, buscar o `logo_path` atual antes: no `handleSave`, se `!logoFile && !logoPath`, ler `logo_path` corrente (`select logo_path from organizations where id = orgId`) e reusar. Implementar esse fetch dentro do `handleSave` para não sobrescrever logo existente com `null`.

- [ ] **Step 3: Abrir o dialog em `admin.empresas.tsx`**

No `EditarEmpresaPanel` (~linha 625): importar `OrgBrandingDialog`, adicionar `const [brandingOpen, setBrandingOpen] = useState(false);`, renderizar `<OrgBrandingDialog orgId={org.id} open={brandingOpen} onOpenChange={setBrandingOpen} />` (usar o nome real da prop da org dentro do painel — conferir a assinatura do componente na linha 625) e um botão perto do `save()` existente:

```tsx
<Button variant="outline" size="sm" onClick={() => setBrandingOpen(true)}>
  Identidade do relatório
</Button>
```

- [ ] **Step 4: Validar no navegador (preview_* — servidor do usuário na 57010, NUNCA reiniciar)**

1. `preview_snapshot` em `/rti/plano` → botão "Gerar relatório" visível com um report ativo.
2. Clicar → wizard abre; preencher etapa 1; recarregar a página → rascunho persistiu (autosave).
3. Etapa 2: editar descrição de uma NC, excluir uma foto; etapa 4: preview renderiza (aqui valida o risco da fonte WOFF — se o preview falhar com erro de fonte, aplicar o fallback da Task 5 e registrar).
4. Etapa 5: emitir → toast v1, link abre o PDF; emitir de novo → v2 (nunca sobrescreve).
5. `preview_console_logs` sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add src/routes/rti.plano.tsx src/components/org-branding-dialog.tsx src/routes/admin.empresas.tsx
git commit -m "feat(rti): entrada do wizard no plano de acao + identidade do consultor em admin/empresas"
```

---

### Task 12: Documentação, emenda de decisão e verificação final

**Files:**
- Modify: `docs/superpowers/specs/2026-07-09-decisoes-trilhas-c-a-d.md`
- Modify: `docs/superpowers/plans/ROADMAP.md`

- [ ] **Step 1: Registrar a emenda D-C2b no arquivo de decisões** (após D-C2):

```markdown
### D-C2b · (emenda na fase de plano) Renderização client-side, não server-side
- (a) Server function devolvendo o PDF (como a spec dizia)
- (b) **Mesma lib (@react-pdf/renderer), renderizada no NAVEGADOR: preview via
  PDFViewer e emissão via pdf().toBlob(), upload com a sessão do usuário** ← **escolhida**
**Porquê:** preview e PDF final ficam idênticos por construção; evita transportar PDF
grande (30 NCs × fotos) por server function, timeout serverless e service key — o upload
usa o RLS do próprio usuário. A biblioteca decidida em D-C2 não muda.
**Se trocar para (a):** mover `gerarPdfBlob` para uma rota server e devolver base64;
custo: payload grande + credencial de service no server.
```

- [ ] **Step 2: Atualizar o ROADMAP** — marcar a trilha C como implementada aguardando validação, e remover/ajustar a nota "comporRti ainda anexa evidência por ponto" (resolvida na Task 4).

- [ ] **Step 3: Verificação final completa**

```bash
npx tsc --noEmit     # sem erros novos vs. baseline
npx vitest run       # suíte inteira verde (novos: rti-relatorio, campo-fotos-achado, rti-parecer-ai)
npm run build        # build verde
```

- [ ] **Step 4: Commit final**

```bash
git add docs/superpowers/specs/2026-07-09-decisoes-trilhas-c-a-d.md docs/superpowers/plans/ROADMAP.md
git commit -m "docs: trilha C implementada — emenda D-C2b (render client-side) e ROADMAP"
```

**Lembrete:** nenhum `git push` — validação de staging só quando o founder pedir o push.

---

## Self-review (feito na escrita do plano)

- **Cobertura da spec:** §3 fluxo/etapas → Tasks 9–10; §4 geração → Tasks 5, 7 (+ emenda D-C2b); §5 branding → Tasks 1, 8, 11; §6 dados → Tasks 1–3 (path adaptado à convenção real `{orgFolder}/{reportSlug}/relatorios/…` de `storage-paths.ts`, em vez do literal da spec); §7 IA → Task 6; §8 erros/testes → TDD nas Tasks 3, 4, 6 + autosave/toast nas 9–10 (o "teste visual de snapshot do PDF" da spec virou validação manual no preview — Task 11 Step 4 — porque o render é client-side; registrado como desvio consciente); §9 riscos → fonte (Task 5/11), fotos grandes (`wrap` nota na Task 7), iteração de design com relatório real fica para a validação com o founder. Fotos vinculadas por `finding_id` (§3 etapa 2) → Task 4 na origem (comporRti) + fallback natural via evidências.
- **Fora do plano (spec "não entra"):** dossiê multi-norma, white-label do app, transcrição de áudio, outros tipos de relatório — nada disso ganhou task. Foto de detalhe 2048px: decidir com evidência após o 1º PDF real (D-C5).
- **Consistência de nomes:** `NcParaPdf`/`NcsOverrides`/`buildPdfModel`/`proximaVersao`/`relatorioPdfPath` usados de forma idêntica nas Tasks 3, 8, 9, 10; `fotosParaAchado` nas 4; `registerPdfFonts` nas 5/7; `sugerirParecer`/`buildParecerInput` nas 6/9.
- **Pontos que o executor deve conferir no código real (sinalizados in-loco):** nomes exatos em `useAuth()` (user/profile), tipo `RtiReport` em `@/lib/rti`, padrão de chamada de server function no call site dos certificados, prop da org no `EditarEmpresaPanel`.
