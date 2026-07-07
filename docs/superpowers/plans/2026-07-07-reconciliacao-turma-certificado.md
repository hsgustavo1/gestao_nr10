# Reconciliação Turma ↔ Certificado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a turma de treinamento um evento de 1ª classe (`nr10_turmas`) onde lançamento manual (ART, metadados) e importação de certificados (PDF por pessoa) se encontram, independente da ordem de entrada.

**Architecture:** Migração **aditiva** (nova tabela `nr10_turmas`, coluna `turma_id` em `nr10_trainings`, coluna `data_realizacao` em `training_certificates`) — nenhuma coluna é removida, então o app em uso continua funcionando. A turma é a **fonte da verdade** de ART/instrutor/carga/data; as linhas `nr10_trainings` filhas **espelham** esses campos por compatibilidade com os caminhos de leitura existentes (God node de qualificações). Import usa **casamento sugerido** contra turmas existentes; a turma é autoritativa em conflito. Duas datas do certificado: `data_realizacao` (confrontada com a turma, gera alerta) e `issue_date` (emissão, informativa).

**Tech Stack:** TanStack Start/Router, React Query, Supabase (PostgreSQL + RLS + Storage), shadcn/ui, Tailwind, Vitest. Migrations aplicadas via MCP Supabase (`apply_migration`), `types.ts` à mão.

---

## File Structure

- `supabase/migrations/20260707140000_nr10_turmas.sql` — **novo**: tabela `nr10_turmas`, `turma_id` em `nr10_trainings`, `data_realizacao` em `training_certificates`, RLS, backfill.
- `src/integrations/supabase/types.ts` — **modificado à mão**: bloco `nr10_turmas`, coluna `turma_id`, coluna `data_realizacao`.
- `src/lib/qualificacoes.ts` — **modificado**: tipo `NR10Turma`, `NR10Training.turma_id`, `TrainingCertificate.data_realizacao`.
- `src/lib/turmas.ts` — **novo**: lógica pura de casamento (`suggestTurmaForBatch`) e discrepância (`detectTurmaDiscrepancies`).
- `src/lib/__tests__/turmas.test.ts` — **novo**: testes das funções puras.
- `src/lib/qualificacoes-queries.ts` — **modificado**: `useTurmas`, `upsertTurma` (cria turma + espelha filhos), refactor `useRegistrarTurma`, refactor `importCertificateAsTraining` (turma-aware), `uploadCertificateForEmployee` no anexo manual.
- `src/components/nr10-turma-dialog.tsx` — **modificado**: grava via `upsertTurma`.
- `src/components/nr10-training-dialog.tsx` — **modificado**: herda cabeçalho da turma; anexo manual usa pasta `{matricula}_{nome}/`.
- `src/routes/admin.certificados.importar.tsx` — **modificado**: passo de casamento sugerido; passa `dataRealizacao`.
- `src/lib/certificados-ai.ts` — **modificado**: `training_date_read` em `PageAnalysis`, propagado no grupo.
- `src/lib/certificados-ai-server.ts` — **modificado**: prompt pede data de realização separada da emissão.
- `src/lib/__tests__/certificados-ai.test.ts` — **modificado**: cobre `training_date_read`.

---

## Task 1: Migração — tabela `nr10_turmas` + colunas + backfill

**Files:**
- Create: `supabase/migrations/20260707140000_nr10_turmas.sql`

- [ ] **Step 1: Escrever a migração (aditiva)**

```sql
-- ============ NR-10 TURMAS ============
-- Evento de treinamento de 1a classe: 1 turma agrupa N participacoes
-- (nr10_trainings). ART/instrutor/carga/conteudo passam a ter a turma como
-- fonte da verdade; as linhas filhas continuam espelhando por compatibilidade.
-- RLS multi-tenant no padrao de training_certificates (can_access_org p/ SELECT,
-- org_role_at_least(...,'member') OR fn_org_is_manager p/ escrita). Nao usa
-- gating legado is_staff()/has_role().
CREATE TABLE public.nr10_turmas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id),
  training_type         text NOT NULL,   -- nr10_basico | nr10_areas_classificadas | sep
  category              text NOT NULL,   -- formacao | reciclagem
  data                  date,            -- data de realizacao/conclusao
  art                   text,            -- opcional (nem toda empresa usa ART)
  art_arquivo_url       text,
  instrutor             text,
  entidade              text,
  responsavel_tecnico   text,
  carga_horaria         integer,
  conteudo_programatico text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nr10_turmas ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_turmas_org ON public.nr10_turmas(org_id);
CREATE INDEX idx_turmas_match ON public.nr10_turmas(org_id, training_type, category, data);

CREATE POLICY "nr10_turmas_org_select" ON public.nr10_turmas FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id));
CREATE POLICY "nr10_turmas_org_insert" ON public.nr10_turmas FOR INSERT
  WITH CHECK (public.org_role_at_least(auth.uid(), org_id, 'member')
             OR public.fn_org_is_manager(auth.uid(), org_id));
CREATE POLICY "nr10_turmas_org_update" ON public.nr10_turmas FOR UPDATE
  USING (public.org_role_at_least(auth.uid(), org_id, 'member')
         OR public.fn_org_is_manager(auth.uid(), org_id));
CREATE POLICY "nr10_turmas_org_delete" ON public.nr10_turmas FOR DELETE
  USING (public.org_role_at_least(auth.uid(), org_id, 'member')
         OR public.fn_org_is_manager(auth.uid(), org_id));

-- Vinculo participacao -> turma (nullable: legados nao agrupados ficam null).
ALTER TABLE public.nr10_trainings
  ADD COLUMN turma_id uuid REFERENCES public.nr10_turmas(id) ON DELETE SET NULL;
CREATE INDEX idx_nr10_trainings_turma ON public.nr10_trainings(turma_id);

-- Duas datas no certificado: data_realizacao (confrontada com a turma) e a ja
-- existente issue_date (emissao, informativa).
ALTER TABLE public.training_certificates
  ADD COLUMN data_realizacao date;

-- Backfill: agrupa linhas existentes por (org, tipo, categoria, data, art) e cria
-- uma turma por grupo, herdando os metadados de uma linha representativa.
WITH grupos AS (
  SELECT org_id, training_type, category, training_date AS data,
         art,
         (array_agg(art_arquivo_url) FILTER (WHERE art_arquivo_url IS NOT NULL))[1] AS art_arquivo_url,
         (array_agg(instrutor)       FILTER (WHERE instrutor IS NOT NULL))[1]       AS instrutor,
         (array_agg(entidade)        FILTER (WHERE entidade IS NOT NULL))[1]        AS entidade,
         (array_agg(responsavel_tecnico) FILTER (WHERE responsavel_tecnico IS NOT NULL))[1] AS responsavel_tecnico,
         (array_agg(carga_horaria)   FILTER (WHERE carga_horaria IS NOT NULL))[1]   AS carga_horaria,
         (array_agg(conteudo_programatico) FILTER (WHERE conteudo_programatico IS NOT NULL))[1] AS conteudo_programatico
  FROM public.nr10_trainings
  GROUP BY org_id, training_type, category, training_date, art
),
inseridas AS (
  INSERT INTO public.nr10_turmas
    (org_id, training_type, category, data, art, art_arquivo_url, instrutor,
     entidade, responsavel_tecnico, carga_horaria, conteudo_programatico)
  SELECT org_id, training_type, category, data, art, art_arquivo_url, instrutor,
         entidade, responsavel_tecnico, carga_horaria, conteudo_programatico
  FROM grupos
  RETURNING id, org_id, training_type, category, data, art
)
UPDATE public.nr10_trainings t
SET turma_id = i.id
FROM inseridas i
WHERE t.org_id = i.org_id
  AND t.training_type = i.training_type
  AND t.category = i.category
  AND t.training_date IS NOT DISTINCT FROM i.data
  AND t.art IS NOT DISTINCT FROM i.art;

-- Backfill data_realizacao dos certificados existentes a partir da issue_date
-- (melhor aproximacao ate reprocessar; issue_date era usada como data do treino).
UPDATE public.training_certificates
SET data_realizacao = issue_date
WHERE data_realizacao IS NULL;
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Aplicar com `mcp__...__apply_migration` (project `fumwovtzyhxrjhkjzujs`, name `nr10_turmas`) usando exatamente o SQL acima.
Expected: `{"success": true}`.

- [ ] **Step 3: Verificar backfill**

Rodar via `execute_sql`:
```sql
SELECT
  (SELECT count(*) FROM nr10_turmas) AS turmas,
  (SELECT count(*) FROM nr10_trainings WHERE turma_id IS NULL) AS trainings_sem_turma,
  (SELECT count(*) FROM training_certificates WHERE data_realizacao IS NULL) AS certs_sem_data_real;
```
Expected: `trainings_sem_turma = 0` e `certs_sem_data_real = 0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260707140000_nr10_turmas.sql
git commit -m "feat(nr10): migration nr10_turmas + turma_id + data_realizacao (aditiva, backfill)"
```

---

## Task 2: Tipos — `types.ts` (à mão) + `qualificacoes.ts`

**Files:**
- Modify: `src/integrations/supabase/types.ts`
- Modify: `src/lib/qualificacoes.ts:153-171` (NR10Training) e bloco de `TrainingCertificate`

- [ ] **Step 1: Adicionar bloco `nr10_turmas` em types.ts**

Inserir junto às demais tabelas (padrão Row/Insert/Update), com as colunas da Task 1. Adicionar `turma_id: string | null` em Row/Insert/Update de `nr10_trainings` e `data_realizacao: string | null` em `training_certificates`.

```ts
nr10_turmas: {
  Row: {
    id: string; org_id: string; training_type: string; category: string;
    data: string | null; art: string | null; art_arquivo_url: string | null;
    instrutor: string | null; entidade: string | null;
    responsavel_tecnico: string | null; carga_horaria: number | null;
    conteudo_programatico: string | null; created_at: string; updated_at: string;
  };
  Insert: {
    id?: string; org_id: string; training_type: string; category: string;
    data?: string | null; art?: string | null; art_arquivo_url?: string | null;
    instrutor?: string | null; entidade?: string | null;
    responsavel_tecnico?: string | null; carga_horaria?: number | null;
    conteudo_programatico?: string | null; created_at?: string; updated_at?: string;
  };
  Update: {
    id?: string; org_id?: string; training_type?: string; category?: string;
    data?: string | null; art?: string | null; art_arquivo_url?: string | null;
    instrutor?: string | null; entidade?: string | null;
    responsavel_tecnico?: string | null; carga_horaria?: number | null;
    conteudo_programatico?: string | null; created_at?: string; updated_at?: string;
  };
  Relationships: [];
};
```

- [ ] **Step 2: Tipos de domínio em qualificacoes.ts**

Adicionar `turma_id?: string | null;` em `NR10Training`. Adicionar `data_realizacao?: string | null;` em `TrainingCertificate`. Novo tipo:

```ts
export type NR10Turma = {
  id: string;
  org_id: string;
  training_type: TrainingType;
  category: "formacao" | "reciclagem";
  data: string | null;
  art: string | null;
  art_arquivo_url: string | null;
  instrutor: string | null;
  entidade: string | null;
  responsavel_tecnico: string | null;
  carga_horaria: number | null;
  conteudo_programatico: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros (erros pré-existentes conhecidos permanecem).

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts src/lib/qualificacoes.ts
git commit -m "feat(nr10): tipos NR10Turma, turma_id e data_realizacao"
```

---

## Task 3: Lógica pura — casamento de turma (TDD)

**Files:**
- Create: `src/lib/turmas.ts`
- Test: `src/lib/__tests__/turmas.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { suggestTurmaForBatch, type TurmaCandidate } from "../turmas";

const turma = (o: Partial<TurmaCandidate>): TurmaCandidate => ({
  id: "t1", training_type: "nr10_basico", category: "reciclagem",
  data: "2026-03-12", art: null, ...o,
});

describe("suggestTurmaForBatch", () => {
  it("casa por tipo+categoria+data dentro da janela de ±3 dias", () => {
    const res = suggestTurmaForBatch(
      { trainingType: "nr10_basico", category: "reciclagem", dataRealizacao: "2026-03-13" },
      [turma({ id: "t1", data: "2026-03-12" }), turma({ id: "t2", data: "2026-05-01" })],
    );
    expect(res?.id).toBe("t1");
  });

  it("prioriza match exato por número de ART quando presente", () => {
    const res = suggestTurmaForBatch(
      { trainingType: "nr10_basico", category: "reciclagem", dataRealizacao: "2026-05-30", art: "ART-123" },
      [turma({ id: "t1", data: "2026-03-12", art: "ART-123" }), turma({ id: "t2", data: "2026-05-29" })],
    );
    expect(res?.id).toBe("t1");
  });

  it("não sugere nada fora da janela e sem ART", () => {
    const res = suggestTurmaForBatch(
      { trainingType: "nr10_basico", category: "reciclagem", dataRealizacao: "2026-01-01" },
      [turma({ id: "t1", data: "2026-03-12" })],
    );
    expect(res).toBeNull();
  });

  it("não casa categoria diferente", () => {
    const res = suggestTurmaForBatch(
      { trainingType: "nr10_basico", category: "formacao", dataRealizacao: "2026-03-12" },
      [turma({ id: "t1", category: "reciclagem", data: "2026-03-12" })],
    );
    expect(res).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/turmas.test.ts`
Expected: FAIL (módulo `../turmas` não existe).

- [ ] **Step 3: Implementar `suggestTurmaForBatch`**

```ts
import type { TrainingType } from "./qualificacoes";

export type TurmaCandidate = {
  id: string;
  training_type: TrainingType;
  category: "formacao" | "reciclagem";
  data: string | null;
  art: string | null;
};

export type BatchKey = {
  trainingType: TrainingType;
  category: "formacao" | "reciclagem";
  dataRealizacao: string | null;
  art?: string | null;
};

const MATCH_WINDOW_DAYS = 3;

function daysBetween(a: string, b: string): number {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

/**
 * Sugere a turma existente à qual um lote de certificados provavelmente pertence.
 * Match por tipo+categoria obrigatório; ART igual vence direto; senão, a data de
 * realização precisa estar dentro de ±3 dias. Retorna a mais próxima em data.
 */
export function suggestTurmaForBatch(
  key: BatchKey,
  candidates: TurmaCandidate[],
): TurmaCandidate | null {
  const mesmoTipo = candidates.filter(
    (c) => c.training_type === key.trainingType && c.category === key.category,
  );
  if (key.art?.trim()) {
    const porArt = mesmoTipo.find((c) => c.art?.trim() === key.art!.trim());
    if (porArt) return porArt;
  }
  if (!key.dataRealizacao) return null;
  let best: { c: TurmaCandidate; d: number } | null = null;
  for (const c of mesmoTipo) {
    if (!c.data) continue;
    const d = daysBetween(c.data, key.dataRealizacao);
    if (d <= MATCH_WINDOW_DAYS && (!best || d < best.d)) best = { c, d };
  }
  return best?.c ?? null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/turmas.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/turmas.ts src/lib/__tests__/turmas.test.ts
git commit -m "feat(nr10): suggestTurmaForBatch (casamento de lote a turma)"
```

---

## Task 4: Lógica pura — discrepância turma × certificado (TDD)

**Files:**
- Modify: `src/lib/turmas.ts`
- Test: `src/lib/__tests__/turmas.test.ts`

- [ ] **Step 1: Adicionar testes que falham**

```ts
import { detectTurmaDiscrepancies } from "../turmas";

describe("detectTurmaDiscrepancies", () => {
  const base = { data: "2026-03-12", carga_horaria: 16 as number | null };

  it("alerta forte quando data de realização diverge da turma", () => {
    const d = detectTurmaDiscrepancies(base, { dataRealizacao: "2026-04-20", workloadHours: 16 });
    expect(d.some((x) => x.field === "data_realizacao" && x.severity === "alta")).toBe(true);
  });

  it("não alerta quando data de realização bate", () => {
    const d = detectTurmaDiscrepancies(base, { dataRealizacao: "2026-03-12", workloadHours: 16 });
    expect(d.find((x) => x.field === "data_realizacao")).toBeUndefined();
  });

  it("alerta médio quando carga horária diverge", () => {
    const d = detectTurmaDiscrepancies(base, { dataRealizacao: "2026-03-12", workloadHours: 40 });
    expect(d.some((x) => x.field === "carga_horaria" && x.severity === "media")).toBe(true);
  });

  it("ignora datas ausentes (sem dado, sem alerta)", () => {
    const d = detectTurmaDiscrepancies({ data: null, carga_horaria: null }, { dataRealizacao: null, workloadHours: null });
    expect(d).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/turmas.test.ts`
Expected: FAIL (`detectTurmaDiscrepancies` não existe).

- [ ] **Step 3: Implementar `detectTurmaDiscrepancies`**

```ts
export type Discrepancy = {
  field: "data_realizacao" | "carga_horaria";
  severity: "alta" | "media";
  turmaValue: string | number | null;
  certValue: string | number | null;
};

/**
 * Compara os dados lidos do certificado contra a turma que ele será vinculado.
 * Data de realização divergente = alerta ALTO (o certificado não deveria ter
 * data de conclusão diferente da turma). Carga horária divergente = alerta MÉDIO.
 * A data de EMISSÃO nunca é comparada aqui. Ausência de dado não gera alerta.
 */
export function detectTurmaDiscrepancies(
  turma: { data: string | null; carga_horaria: number | null },
  cert: { dataRealizacao: string | null; workloadHours: number | null },
): Discrepancy[] {
  const out: Discrepancy[] = [];
  if (turma.data && cert.dataRealizacao && turma.data !== cert.dataRealizacao) {
    out.push({ field: "data_realizacao", severity: "alta", turmaValue: turma.data, certValue: cert.dataRealizacao });
  }
  if (turma.carga_horaria != null && cert.workloadHours != null && turma.carga_horaria !== cert.workloadHours) {
    out.push({ field: "carga_horaria", severity: "media", turmaValue: turma.carga_horaria, certValue: cert.workloadHours });
  }
  return out;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/turmas.test.ts`
Expected: PASS (8 testes no total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/turmas.ts src/lib/__tests__/turmas.test.ts
git commit -m "feat(nr10): detectTurmaDiscrepancies (alerta data realizacao/carga)"
```

---

## Task 5: Query — `useTurmas` + `upsertTurma` (turma como fonte, espelha filhos)

**Files:**
- Modify: `src/lib/qualificacoes-queries.ts` (após `useRegistrarTurma`, ~linha 651)

- [ ] **Step 1: Implementar `useTurmas` e `upsertTurma`**

`upsertTurma` insere/atualiza a turma e **sincroniza (espelha)** os campos nas linhas `nr10_trainings` filhas dos participantes, mantendo a chave única `employee_id,training_type,category` e setando `turma_id`.

```ts
// ── NR-10 Turmas ─────────────────────────────────────────────────────────────
import type { NR10Turma } from "./qualificacoes"; // (adicionar ao import existente de ./qualificacoes)

export function useTurmas() {
  const { currentOrgId } = useAuth();
  return useQuery({
    queryKey: ["nr10_turmas", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nr10_turmas").select("*").eq("org_id", currentOrgId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return data as NR10Turma[];
    },
  });
}

/** Espelha os campos da turma nas participacoes (compat com leituras existentes). */
function turmaMirror(turma: Pick<NR10Turma,
  "training_type" | "category" | "data" | "art" | "art_arquivo_url" |
  "instrutor" | "entidade" | "responsavel_tecnico" | "carga_horaria" | "conteudo_programatico">) {
  return {
    training_type: turma.training_type,
    category: turma.category,
    training_date: turma.data,
    art: turma.art,
    art_arquivo_url: turma.art_arquivo_url,
    instrutor: turma.instrutor,
    entidade: turma.entidade,
    responsavel_tecnico: turma.responsavel_tecnico,
    carga_horaria: turma.carga_horaria,
    conteudo_programatico: turma.conteudo_programatico,
  };
}

/** Cria/atualiza a turma e sincroniza as participacoes selecionadas. */
export async function upsertTurma(params: {
  orgId: string;
  turma: Omit<NR10Turma, "id" | "created_at" | "updated_at" | "org_id"> & { id?: string };
  employeeIds: string[];
}): Promise<string> {
  const { orgId, turma, employeeIds } = params;
  const { data: saved, error } = await supabase
    .from("nr10_turmas")
    .upsert({ ...turma, org_id: orgId } as never)
    .select("id")
    .single();
  if (error) throw error;
  const turmaId = (saved as { id: string }).id;

  if (employeeIds.length > 0) {
    const rows = employeeIds.map((employee_id) => ({
      employee_id, org_id: orgId, turma_id: turmaId, valid: true,
      ...turmaMirror(turma),
    }));
    const { error: upErr } = await supabase
      .from("nr10_trainings")
      .upsert(rows as never, { onConflict: "employee_id,training_type,category" });
    if (upErr) throw upErr;
  }
  return turmaId;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/qualificacoes-queries.ts
git commit -m "feat(nr10): useTurmas + upsertTurma (fonte da verdade, espelha filhos)"
```

---

## Task 6: Refactor `useRegistrarTurma` → grava via turma

**Files:**
- Modify: `src/lib/qualificacoes-queries.ts:616-651`
- Modify: `src/components/nr10-turma-dialog.tsx:116-131`

- [ ] **Step 1: Reescrever `useRegistrarTurma` sobre `upsertTurma`**

```ts
export function useRegistrarTurma() {
  const qc = useQueryClient();
  const { currentOrgId } = useAuth();
  return useMutation({
    mutationFn: async ({
      employeeIds,
      turma,
    }: {
      employeeIds: string[];
      turma: Omit<NR10Turma, "id" | "created_at" | "updated_at" | "org_id">;
    }) => {
      if (!currentOrgId) throw new Error("Selecione uma organização.");
      await upsertTurma({ orgId: currentOrgId, turma, employeeIds });
      if (turma.category === "reciclagem" && employeeIds.length > 0) {
        await supabase.from("employees")
          .update({ reciclagem_requerida: false, reciclagem_motivo: null })
          .in("id", employeeIds);
      }
      return employeeIds.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nr10_trainings"] });
      qc.invalidateQueries({ queryKey: ["nr10_turmas"] });
      qc.invalidateQueries({ queryKey: qualKeys.employees });
    },
  });
}
```

- [ ] **Step 2: Ajustar a chamada no diálogo**

Em `nr10-turma-dialog.tsx`, trocar o objeto `training:` por `turma:` com os mesmos campos (o `training_date` da turma vira `data`):

```tsx
await registrar.mutateAsync({
  employeeIds: Array.from(selected),
  turma: {
    training_type: trainingType as TrainingType,
    category: category as "formacao" | "reciclagem",
    data: trainingDate,
    art: art.trim() || null,
    art_arquivo_url: artArquivoUrl,
    instrutor: instrutores.map((s) => s.trim()).filter(Boolean).join(" · ") || null,
    entidade: entidade.trim() || null,
    responsavel_tecnico: responsavelTecnico.trim() || null,
    carga_horaria: carga ? parseInt(carga, 10) : null,
    conteudo_programatico: conteudo.trim() || null,
  },
});
```

- [ ] **Step 3: Verificar tipos + suíte**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem novos erros; testes passam.

- [ ] **Step 4: Verificar no preview (porta 57010, já rodando)**

Abrir o diálogo "Registrar turma", lançar uma turma de teste com 2 colaboradores, confirmar toast de sucesso. Via `execute_sql`: `SELECT count(*) FROM nr10_turmas WHERE ...` mostra 1 nova turma e 2 `nr10_trainings` com `turma_id` setado.

- [ ] **Step 5: Commit**

```bash
git add src/lib/qualificacoes-queries.ts src/components/nr10-turma-dialog.tsx
git commit -m "refactor(nr10): registrar turma grava a turma e espelha participacoes"
```

---

## Task 7: Extração — separar data de realização da emissão

**Files:**
- Modify: `src/lib/certificados-ai.ts:7-19` (PageAnalysis), `:107-156` (grupo)
- Modify: `src/lib/certificados-ai-server.ts` (prompt)
- Test: `src/lib/__tests__/certificados-ai.test.ts`

- [ ] **Step 1: Teste que falha para `training_date_read` no grupo**

```ts
it("propaga a data de realização (training_date_read) para o grupo", () => {
  const a = analysis({ page_type: "frente", employee_name_read: "JOAO",
    training_date_read: "2026-03-12", dates_read: ["Emitido em 20/03/2026"] });
  const [g] = groupPagesByFrenteVerso([a], [{ id: "e1", name: "JOAO SILVA" } as never]);
  expect(g.dataRealizacao).toBe("2026-03-12");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/certificados-ai.test.ts`
Expected: FAIL (`training_date_read` / `dataRealizacao` inexistentes).

- [ ] **Step 3: Adicionar campo em PageAnalysis, grupo e prompt**

Em `PageAnalysis`, adicionar `training_date_read: string | null;` (data de conclusão/realização, ISO ou dd/mm/aaaa). Em `CertificatePageGroup`, adicionar `dataRealizacao: string | null;`. Em `groupPagesByFrenteVerso`, preencher:

```ts
dataRealizacao: normalizeDateGuess(a?.training_date_read) ?? extractLatestDateGuess(a?.dates_read ?? []) ?? "",
```

Adicionar helper `normalizeDateGuess(raw: string | null): string | null` que aceita ISO ou `dd/mm/aaaa` e retorna ISO. No factory `analysis()` do teste, adicionar `training_date_read: null` default. No prompt de `certificados-ai-server.ts`, instruir: extraia **duas datas separadas** — `training_date_read` = data de realização/conclusão do treinamento; a data de emissão do certificado vai só em `dates_read`. Não confundir as duas.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/certificados-ai.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/certificados-ai.ts src/lib/certificados-ai-server.ts src/lib/__tests__/certificados-ai.test.ts
git commit -m "feat(certificados): extrai data de realizacao separada da emissao"
```

---

## Task 8: Import turma-aware — `importCertificateAsTraining` + passo de casamento

**Files:**
- Modify: `src/lib/qualificacoes-queries.ts:961-1035`
- Modify: `src/routes/admin.certificados.importar.tsx` (handleImport + UI de sugestão)

- [ ] **Step 1: Tornar `importCertificateAsTraining` turma-aware**

Adicionar params `turmaId: string | null` e `dataRealizacao: string | null`. Regras: se `turmaId` presente, a participação recebe `turma_id` e **não sobrescreve** `training_date` (turma é autoritativa); se ausente (criando avulso), mantém comportamento atual. O certificado grava `data_realizacao` além de `issue_date`.

```ts
export async function importCertificateAsTraining(params: {
  employee: { id: string; name: string; matricula: string };
  orgId: string; trainingType: TrainingType;
  category: "formacao" | "reciclagem"; issueDate: string | null;
  dataRealizacao: string | null; workloadHours: number | null;
  turmaId: string | null;
  file: File; baseName: string; sourceLabel: string; pagesInSource: string;
}): Promise<void> {
  const { url } = await uploadCertificateForEmployee(params.employee, params.file, params.baseName);

  const { data: existing, error: selErr } = await supabase
    .from("nr10_trainings").select("id, carga_horaria, turma_id")
    .eq("employee_id", params.employee.id).eq("training_type", params.trainingType)
    .eq("category", params.category).eq("org_id", params.orgId).maybeSingle();
  if (selErr) throw selErr;

  let trainingId: string;
  if (existing) {
    trainingId = existing.id as string;
    const patch: Record<string, unknown> = {};
    if (params.turmaId) {
      patch.turma_id = params.turmaId;                 // vincula à turma
    } else if (params.dataRealizacao) {
      patch.training_date = params.dataRealizacao;     // avulso: data do cert prevalece
    }
    if ((existing as { carga_horaria: number | null }).carga_horaria == null && params.workloadHours != null) {
      patch.carga_horaria = params.workloadHours;
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("nr10_trainings").update(patch as never).eq("id", trainingId);
      if (error) throw error;
    }
  } else {
    const { data, error } = await supabase.from("nr10_trainings").insert({
      employee_id: params.employee.id, org_id: params.orgId,
      training_type: params.trainingType, category: params.category,
      training_date: params.dataRealizacao, carga_horaria: params.workloadHours,
      turma_id: params.turmaId, valid: true,
    } as never).select("id").single();
    if (error) throw error;
    trainingId = (data as { id: string }).id;
  }

  const { error: certErr } = await supabase.from("training_certificates").insert({
    employee_id: params.employee.id, org_id: params.orgId, nr10_training_id: trainingId,
    training_type: params.trainingType, category: params.category, file_url: url,
    file_name: `${params.baseName}.pdf`, issue_date: params.issueDate,
    data_realizacao: params.dataRealizacao,
    source_file: params.sourceLabel, pages_in_source: params.pagesInSource,
  } as never);
  if (certErr) throw certErr;
}
```

- [ ] **Step 2: Passo de casamento sugerido no wizard**

Antes do `handleImport`, computar a chave do lote (tipo/categoria/data de realização mais comum entre os grupos; ART se algum grupo trouxer) e chamar `suggestTurmaForBatch(key, turmas)` com `useTurmas()`. Renderizar um card acima da lista:
- Sem sugestão → "Nenhuma turma correspondente. Uma nova turma será criada." + campos mínimos (ART opcional, instrutor) pré-preenchidos do que a IA extraiu.
- Com sugestão → "N certificados → turma {tipo} {data} · ART {art} · {instrutor}" + botões **[Vincular] · [Escolher outra turma] · [Criar nova]**. Rodar `detectTurmaDiscrepancies` por grupo e exibir aviso âmbar (data de realização) / neutro (carga) quando houver.

Estado novo: `selectedTurmaId: string | null` e `turmaMode: "link" | "new"`. `handleImport` passa `turmaId: turmaMode === "link" ? selectedTurmaId : createdTurmaId` e `dataRealizacao: group.dataRealizacao || null`. Quando "criar nova", chamar `upsertTurma` uma vez (com os `employeeIds` dos grupos que casaram colaborador) antes do loop e usar o id retornado.

- [ ] **Step 3: Verificar tipos + suíte**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem novos erros; testes passam.

- [ ] **Step 4: Verificar no preview**

Importar um lote de teste: (a) com turma já lançada (Task 6) → card sugere vincular; após importar, `execute_sql` confirma certificados com `data_realizacao` e participações com `turma_id` da turma existente, **sem** nova turma criada. (b) sem turma → cria nova turma e vincula.

- [ ] **Step 5: Commit**

```bash
git add src/lib/qualificacoes-queries.ts src/routes/admin.certificados.importar.tsx
git commit -m "feat(certificados): import turma-aware com casamento sugerido e data de realizacao"
```

---

## Task 9: Diálogo de treinamento — herança da turma + anexo manual unificado

**Files:**
- Modify: `src/components/nr10-training-dialog.tsx`

- [ ] **Step 1: Exibir cabeçalho herdado da turma**

Quando o treinamento tem `turma_id`, buscar a turma (via `useTurmas()` filtrando por id, ou `useNR10Trainings` já traz os campos espelhados) e exibir ART/instrutor/entidade num bloco de leitura acima da lista de certificados. Como os campos são espelhados na própria linha, usar `training.art` / `training.instrutor` diretamente já resolve a exibição sem query extra.

- [ ] **Step 2: Unificar o anexo manual para a pasta `{matricula}_{nome}/`**

Trocar `uploadCertificateFile(employeeId, file)` por `uploadCertificateForEmployee(employee, file, baseName)` no `handleCertUpload`, exportando `uploadCertificateForEmployee` se ainda não exportada. Gravar o certificado com `nr10_training_id: training.id` para já nascer vinculado.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 4: Verificar no preview**

Abrir o treinamento do colaborador de teste (ex.: o caso Alexsandro): o cabeçalho da turma aparece e o certificado anexado é listado com "Abrir". Anexar um novo manualmente cai na pasta `{matricula}_{nome}/` (confirmar via Storage/`execute_sql` do `file_url`).

- [ ] **Step 5: Commit**

```bash
git add src/components/nr10-training-dialog.tsx src/lib/qualificacoes-queries.ts
git commit -m "feat(nr10): dialogo de treinamento herda turma e unifica pasta de anexo"
```

---

## Task 10: Visibilidade — selo de completude + filtros de turma

**Files:**
- Modify: a rota/tela de listagem de turmas ou capacitações (identificar a que consome `useNR10Trainings`); adicionar consumo de `useTurmas` + `useCertificates`.

- [ ] **Step 1: Computar completude por turma (lógica pura, TDD)**

Em `src/lib/turmas.ts`, adicionar `turmaCompleteness(participantes, certificadosPorTraining)` → `{ hasArt: boolean; certs: number; total: number; complete: boolean }` onde `complete = total > 0 && certs === total` (ART **não** entra). Testar 3 casos: completa, faltando cert, sem ART mas completa.

```ts
export function turmaCompleteness(
  turma: { art: string | null },
  participantTrainingIds: string[],
  trainingIdsComCert: Set<string>,
): { hasArt: boolean; certs: number; total: number; complete: boolean } {
  const total = participantTrainingIds.length;
  const certs = participantTrainingIds.filter((id) => trainingIdsComCert.has(id)).length;
  return { hasArt: !!turma.art?.trim(), certs, total, complete: total > 0 && certs === total };
}
```

- [ ] **Step 2: Renderizar o selo**

Na linha/card da turma: 🎓 `ART` presente (neutro, cinza) / "sem ART" (neutro, **não** vermelho); 📎 `{certs}/{total}`. Turma completa recebe um check discreto.

- [ ] **Step 3: Filtros**

Adicionar toggles/segments: "Todas" · "Sem ART" · "Certificados faltando". "Sem ART" filtra `!hasArt`; "Certificados faltando" filtra `!complete`. Não exibir "Sem ART" como alerta — só filtro.

- [ ] **Step 4: Verificar tipos + suíte + preview**

Run: `npx tsc --noEmit && npx vitest run`
Expected: passa. No preview, os selos refletem o estado real das turmas de teste; os filtros funcionam.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(nr10): selo de completude e filtros de turma (ART opcional, neutro)"
```

---

## Self-Review

- **Cobertura do spec:** modelo de dados (Task 1-2), turma explícita como fonte + espelho (Task 5-6), casamento sugerido (Task 3, 8), duas datas / autoridade em conflito (Task 4, 7, 8), selo de completude com ART opcional/neutro + filtros (Task 10), herança no diálogo + pasta unificada (Task 9). Coberto.
- **Placeholders:** nenhum passo com "TODO"/"handle edge cases" sem código; janela de matching fixada em 3 dias com constante nomeada.
- **Consistência de tipos:** `NR10Turma`, `TurmaCandidate`, `BatchKey`, `Discrepancy` definidos na Task 2-4 e reusados nas Tasks 8-10; `upsertTurma`/`turmaMirror` definidos na Task 5 e reusados na 6 e 8; `dataRealizacao` propagado de `CertificatePageGroup` (Task 7) ao import (Task 8).
- **Risco:** migração é aditiva (sem drop), backfill não-destrutivo; app em uso não quebra porque as linhas filhas continuam com os campos espelhados.
