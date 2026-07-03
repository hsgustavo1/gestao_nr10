# Responsáveis do RTI capturados na entrega — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover a captura de responsáveis e datas da inspeção da criação do RTI para um pop-up disparado na entrega do relatório, com múltiplos responsáveis de campo (auto do PWA + manuais), responsável pelo relatório (auto), responsável técnico do RTI (ART, opcional) e responsável pelo plano de ação (opcional, aplicado às NCs sem responsável).

**Architecture:** As colunas de responsabilidade em `rti_reports` são reorganizadas (rename + 2 novas). A RPC `fn_entregar_rti_report` é estendida para gravar esses campos e aplicar o responsável do plano na mesma transação da entrega/selo. A UI de criação perde os campos; um novo `EntregarRtiDialog` os coleta. Um helper puro unifica `coletores_campo` (travado) com os nomes manuais para exibição.

**Tech Stack:** TanStack Start + React, shadcn/ui, Tailwind, Supabase (PostgreSQL + RLS + RPC), vitest. Migrations aplicadas via MCP do Supabase (`apply_migration`) no projeto `fumwovtzyhxrjhkjzujs`, com `.sql` versionado; `types.ts` atualizado à mão.

**Regra de commits (CLAUDE.md, 2026-07-02):** commits locais são livres — commit a cada task. **Nenhum `git push`** (staging/main) sem pedido explícito do usuário.

---

## File Structure

- `supabase/migrations/20260702000000_rti_responsaveis_entrega.sql` — **criar**. Rename de coluna, 2 colunas novas, DROP + CREATE da RPC estendida.
- `src/integrations/supabase/types.ts` — **modificar**. `rti_reports` Row/Insert/Update + `Functions.fn_entregar_rti_report.Args`.
- `src/lib/rti.ts` — **modificar**. Tipo `RtiReport` (rename + 2 campos) e novos helpers puros `responsaveisInspecaoCampo()` + `labelResponsaveisCampo()`.
- `src/lib/__tests__/rti-responsaveis.test.ts` — **criar**. Testa os 2 helpers puros.
- `src/lib/rti-queries.ts` — **modificar**. `useEntregarRtiReport` com nova assinatura.
- `src/routes/rti.importar.tsx` — **modificar**. Remover campos de responsável/datas do formulário de criação.
- `src/lib/campo-queries.ts` — **modificar**. `comporRti` larga o param `responsavelAuditoria` e para de gravar `responsavel_auditoria`.
- `src/routes/campo.inspecao.$id.tsx` — **modificar**. `ComporRtiDialog` remove o input/estado "Responsável pela auditoria".
- `src/routes/rti.plano.tsx` — **modificar**. Novo `EntregarRtiDialog` + fiação do botão "Entregar relatório".
- `src/routes/rti.index.tsx` — **modificar**. Exibir novos responsáveis no cabeçalho.

---

## Task 1: Helpers puros de responsáveis de campo (TDD)

**Files:**
- Modify: `src/lib/rti.ts` (fim do arquivo)
- Test: `src/lib/__tests__/rti-responsaveis.test.ts`

- [ ] **Step 1: Write the failing test**

Criar `src/lib/__tests__/rti-responsaveis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { responsaveisInspecaoCampo, labelResponsaveisCampo } from "../rti";

describe("responsaveisInspecaoCampo", () => {
  it("une coletores automáticos e extras manuais, sem duplicar", () => {
    expect(
      responsaveisInspecaoCampo(["Ana", "Bruno"], ["Bruno", "Carla"]),
    ).toEqual(["Ana", "Bruno", "Carla"]);
  });

  it("mantém a ordem: automáticos antes dos manuais", () => {
    expect(responsaveisInspecaoCampo(["Ana"], ["Zeca"])).toEqual(["Ana", "Zeca"]);
  });

  it("ignora nulos, vazios e espaços, e apara os nomes", () => {
    expect(
      responsaveisInspecaoCampo(["  Ana  ", "", null as unknown as string], [" ", "Bruno"]),
    ).toEqual(["Ana", "Bruno"]);
  });

  it("aceita listas nulas nos dois lados", () => {
    expect(responsaveisInspecaoCampo(null, null)).toEqual([]);
  });

  it("dedup é case- e acento-sensível apenas por igualdade exata aparada", () => {
    expect(responsaveisInspecaoCampo(["Ana"], ["ana"])).toEqual(["Ana", "ana"]);
  });
});

describe("labelResponsaveisCampo", () => {
  it("singular para 0 ou 1 nome", () => {
    expect(labelResponsaveisCampo(0)).toBe("Responsável pela inspeção em campo");
    expect(labelResponsaveisCampo(1)).toBe("Responsável pela inspeção em campo");
  });

  it("plural para mais de um nome", () => {
    expect(labelResponsaveisCampo(2)).toBe("Responsáveis pela inspeção em campo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/rti-responsaveis.test.ts`
Expected: FAIL — `responsaveisInspecaoCampo`/`labelResponsaveisCampo` não exportados.

- [ ] **Step 3: Write minimal implementation**

Adicionar ao fim de `src/lib/rti.ts`:

```ts
/**
 * Lista final de "Responsáveis pela inspeção em campo" exibida/gravada.
 * Une os coletores automáticos do PWA (`coletores_campo`, travados) com os
 * nomes adicionados manualmente na entrega (`responsaveis_campo_extra`),
 * aparando espaços, descartando vazios e deduplicando por igualdade exata.
 * Ordem: automáticos primeiro, depois manuais.
 */
export function responsaveisInspecaoCampo(
  coletores: string[] | null,
  extras: string[] | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const nome of [...(coletores ?? []), ...(extras ?? [])]) {
    const t = (nome ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Rótulo singular/plural do campo de responsáveis de campo. */
export function labelResponsaveisCampo(count: number): string {
  return count > 1
    ? "Responsáveis pela inspeção em campo"
    : "Responsável pela inspeção em campo";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/rti-responsaveis.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rti.ts src/lib/__tests__/rti-responsaveis.test.ts
git commit -m "feat(rti): helpers de responsáveis de inspeção em campo (união + rótulo plural)"
```

---

## Task 2: Migration — schema + RPC estendida

**Files:**
- Create: `supabase/migrations/20260702000000_rti_responsaveis_entrega.sql`

Aplicar via MCP do Supabase (`apply_migration`, projeto `fumwovtzyhxrjhkjzujs`) **e** versionar o arquivo. A RPC muda de assinatura → `DROP` da versão antiga antes do `CREATE`.

- [ ] **Step 1: Escrever o arquivo de migration**

Criar `supabase/migrations/20260702000000_rti_responsaveis_entrega.sql`:

```sql
-- ============================================================================
-- RTI — responsáveis capturados na entrega.
-- ----------------------------------------------------------------------------
-- 1) Renomeia responsavel_auditoria -> responsavel_tecnico_rti (emissor da ART).
-- 2) Adiciona responsaveis_campo_extra (nomes manuais) e responsavel_relatorio.
-- 3) Estende fn_entregar_rti_report para gravar esses campos + datas e aplicar
--    o responsável do plano nas NCs sem responsável, na mesma transação.
-- Idempotente.
-- ============================================================================

ALTER TABLE public.rti_reports
  RENAME COLUMN responsavel_auditoria TO responsavel_tecnico_rti;

ALTER TABLE public.rti_reports
  ADD COLUMN IF NOT EXISTS responsaveis_campo_extra text[] NULL,
  ADD COLUMN IF NOT EXISTS responsavel_relatorio text NULL;

-- A assinatura muda (novos parâmetros), então removemos a versão antiga.
DROP FUNCTION IF EXISTS public.fn_entregar_rti_report(uuid, uuid);

CREATE OR REPLACE FUNCTION public.fn_entregar_rti_report(
  _report_id uuid,
  _entregue_por_org uuid,
  _responsaveis_campo_extra text[],
  _responsavel_relatorio text,
  _responsavel_tecnico_rti text,
  _responsavel_plano text,
  _periodo_inicio date,
  _periodo_fim date
)
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

  IF EXISTS (SELECT 1 FROM public.rti_reports WHERE id = _report_id AND entregue_em IS NOT NULL) THEN
    RETURN;  -- idempotente: já entregue
  END IF;

  UPDATE public.rti_reports
     SET entregue_em = _ts,
         entregue_por_org = _entregue_por_org,
         responsaveis_campo_extra = _responsaveis_campo_extra,
         responsavel_relatorio = _responsavel_relatorio,
         responsavel_tecnico_rti = _responsavel_tecnico_rti,
         responsavel_plano = _responsavel_plano,
         periodo_inicio = _periodo_inicio,
         periodo_fim = _periodo_fim
   WHERE id = _report_id;

  -- Responsável do plano: aplica só nas NCs sem responsável (não sobrescreve).
  IF _responsavel_plano IS NOT NULL AND btrim(_responsavel_plano) <> '' THEN
    UPDATE public.rti_ncs
       SET responsavel = _responsavel_plano
     WHERE report_id = _report_id
       AND (responsavel IS NULL OR btrim(responsavel) = '');
  END IF;

  -- Cascata do selo aos filhos (inalterada).
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

GRANT EXECUTE ON FUNCTION public.fn_entregar_rti_report(
  uuid, uuid, text[], text, text, text, date, date
) TO authenticated;
```

- [ ] **Step 2: Aplicar via MCP do Supabase**

Usar a ferramenta MCP `apply_migration` com `name = "20260702000000_rti_responsaveis_entrega"` e o SQL acima, no projeto `fumwovtzyhxrjhkjzujs`.
Expected: sucesso, sem erro.

- [ ] **Step 3: Verificar o schema aplicado**

Usar MCP `execute_sql` no projeto `fumwovtzyhxrjhkjzujs`:

```sql
select column_name from information_schema.columns
where table_name = 'rti_reports'
  and column_name in ('responsavel_tecnico_rti','responsaveis_campo_extra','responsavel_relatorio','responsavel_auditoria')
order by column_name;
```

Expected: retorna `responsaveis_campo_extra`, `responsavel_relatorio`, `responsavel_tecnico_rti` — **não** retorna `responsavel_auditoria`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260702000000_rti_responsaveis_entrega.sql
git commit -m "feat(rti): schema+RPC — responsáveis/datas gravados na entrega"
```

---

## Task 3: Atualizar types.ts (rti_reports + Args da RPC)

**Files:**
- Modify: `src/integrations/supabase/types.ts` (bloco `rti_reports`, ~1929-1989; `Functions` da RPC, ~2239)

- [ ] **Step 1: Renomear a coluna e adicionar as novas em Row/Insert/Update**

Em cada um dos três blocos (`Row`, `Insert`, `Update`) de `rti_reports`, trocar a linha `responsavel_auditoria: string | null` (ou `?: string | null`) por `responsavel_tecnico_rti` e adicionar as duas novas. Após a edição, cada bloco deve conter:

```ts
          responsaveis_campo_extra: string[] | null   // Row
          responsavel_relatorio: string | null        // Row
          responsavel_tecnico_rti: string | null       // Row
```

```ts
          responsaveis_campo_extra?: string[] | null   // Insert
          responsavel_relatorio?: string | null        // Insert
          responsavel_tecnico_rti?: string | null       // Insert
```

```ts
          responsaveis_campo_extra?: string[] | null   // Update
          responsavel_relatorio?: string | null        // Update
          responsavel_tecnico_rti?: string | null       // Update
```

(Mantém a ordem alfabética existente do bloco; `responsavel_plano` continua como está.)

- [ ] **Step 2: Atualizar a assinatura da RPC em `Functions`**

Localizar o bloco:

```ts
      fn_entregar_rti_report: {
        Args: { _entregue_por_org: string; _report_id: string }
        Returns: undefined
      }
```

e substituir por:

```ts
      fn_entregar_rti_report: {
        Args: {
          _report_id: string
          _entregue_por_org: string
          _responsaveis_campo_extra: string[]
          _responsavel_relatorio: string
          _responsavel_tecnico_rti: string
          _responsavel_plano: string
          _periodo_inicio: string
          _periodo_fim: string
        }
        Returns: undefined
      }
```

- [ ] **Step 3: Verificar compilação de tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro **novo** referente a `rti_reports`/`responsavel_auditoria`. (Erros tsc pré-existentes são conhecidos — ver CLAUDE.md — e podem aparecer; não são desta task. Os únicos erros aceitáveis relacionados a esta mudança serão resolvidos nas Tasks 4-8, que ainda referenciam `responsavel_auditoria`.)

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "types(rti): rename responsavel_auditoria + colunas de entrega + Args da RPC"
```

---

## Task 4: Atualizar o tipo RtiReport (rti.ts)

**Files:**
- Modify: `src/lib/rti.ts:68-86`

- [ ] **Step 1: Ajustar o tipo**

No tipo `RtiReport`, trocar `responsavel_auditoria: string | null;` por `responsavel_tecnico_rti` e adicionar os dois novos campos:

```ts
export type RtiReport = {
  id: string;
  titulo: string;
  empresa_auditora: string | null;
  /** Emissor da ART do RTI (opcional). Pode diferir de coletores/entregador/criador. */
  responsavel_tecnico_rti: string | null;
  responsavel_plano: string | null;
  /** Lista deduplicada de field_points.collected_by_name no momento da composição. */
  coletores_campo: string[] | null;
  /** Responsáveis de campo adicionados manualmente na entrega. */
  responsaveis_campo_extra: string[] | null;
  /** Nome de quem entregou o relatório. */
  responsavel_relatorio: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  report_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  entregue_em?: string | null;
  entregue_por_org?: string | null;
};
```

- [ ] **Step 2: Rodar os testes dos helpers (garantir que o arquivo ainda compila/exporta)**

Run: `npx vitest run src/lib/__tests__/rti-responsaveis.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rti.ts
git commit -m "types(rti): RtiReport com responsavel_tecnico_rti + campos de entrega"
```

---

## Task 5: Remover campos da criação (rti.importar.tsx)

**Files:**
- Modify: `src/routes/rti.importar.tsx`

- [ ] **Step 1: Remover os estados dos campos que saem**

Remover estas linhas (`rti.importar.tsx:262-265`):

```ts
  const [responsavelAuditoria, setResponsavelAuditoria] = useState("");
  const [responsavelPlano, setResponsavelPlano] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
```

Manter `titulo` e `empresaAuditora`.

- [ ] **Step 2: Ajustar o payload de `importar()`**

No objeto `report` de `batchImportRti` (dentro de `importar()`), remover as chaves `responsavel_auditoria`, `responsavel_plano`, `periodo_inicio`, `periodo_fim`. Resultado:

```ts
        report: {
          titulo: titulo.trim(),
          empresa_auditora: empresaAuditora.trim() || null,
          coletores_campo: null,
          created_by: actorId,
          created_by_name: actorName,
        },
```

- [ ] **Step 3: Ajustar o payload de `criarVazio()`**

No `upsertReport.mutateAsync`, remover as mesmas quatro chaves. Resultado:

```ts
      await upsertReport.mutateAsync({
        titulo: titulo.trim(),
        empresa_auditora: empresaAuditora.trim() || null,
        coletores_campo: null,
        report_path: null,
        notes: null,
        created_by: actorId,
        created_by_name: actorName,
      });
```

- [ ] **Step 4: Remover os inputs do formulário**

Em "Novo relatório de inspeção", remover os blocos JSX dos campos "Responsável pela auditoria" (`imp-resp-aud`), "Responsável pelo plano de ação" (`imp-resp-plano`) e o `div.grid.grid-cols-2` com "Início da auditoria" (`imp-ini`) e "Fim da auditoria" (`imp-fim`) — linhas ~488-525. Manter o campo "Empresa auditora" (`imp-auditora`). O grid passa a ter só Título (span 2) + Empresa auditora.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos referentes a `rti.importar.tsx` (as chaves removidas eram opcionais em `RtiReport`/Insert).

- [ ] **Step 6: Verificar no preview local (porta 57010, servidor do usuário — só leitura/interação)**

Usar `preview_snapshot` em `http://localhost:57010/rti/importar`.
Expected: o formulário "Novo relatório de inspeção" mostra apenas Título, Empresa auditora e a área da planilha — sem os campos de responsável e datas.

- [ ] **Step 7: Commit**

```bash
git add src/routes/rti.importar.tsx
git commit -m "feat(rti): remover responsáveis/datas da criação do relatório"
```

---

## Task 6: Limpar o campo redundante no comporRti + ComporRtiDialog

**Files:**
- Modify: `src/lib/campo-queries.ts:798-889`
- Modify: `src/routes/campo.inspecao.$id.tsx:1386,1401,1504-1514`

- [ ] **Step 1: Remover o parâmetro de `comporRti`**

Em `campo-queries.ts`, no objeto de parâmetros de `comporRti` (linhas 798-810), remover `responsavelAuditoria` da desestruturação e do tipo:

```ts
export async function comporRti({
  inspection,
  destino,
  actorName,
  onProgress,
}: {
  inspection: FieldInspection;
  destino: ComporRtiDestino;
  actorName: string | null;
  onProgress?: (etapa: string, done: number, total: number) => void;
}): Promise<ComporRtiResult> {
```

- [ ] **Step 2: Parar de gravar o campo renomeado no insert**

No insert de `rti_reports` (linhas ~875-886), remover a linha `responsavel_auditoria: responsavelAuditoria,`. O comentário acima (linha 869-871) que cita `responsavel_auditoria` deve ser atualizado para não referenciar o campo removido:

```ts
    // coletores_campo só é gravado na criação — recompor pra um relatório
    // existente não atualiza metadados do relatório.
    const coletoresCampo = coletoresCampoDe(points);
    const { data: rep, error: rErr } = await supabase
      .from("rti_reports")
      .insert({
        ...(orgId ? { org_id: orgId } : {}),
        titulo: inspection.titulo,
        empresa_auditora: inspection.cliente,
        responsavel_plano: null,
        coletores_campo: coletoresCampo,
        periodo_inicio: inspection.data_inspecao,
        periodo_fim: inspection.data_inspecao,
        notes: `Composto a partir da coleta em campo "${inspection.titulo}".`,
        created_by_name: actorName,
      } as never)
```

- [ ] **Step 3: Remover o estado e o input do ComporRtiDialog**

Em `campo.inspecao.$id.tsx`:
- Remover a linha 1386: `const [responsavelAuditoria, setResponsavelAuditoria] = useState(actorName ?? "");`
- Na chamada `comporRti({ ... })` (linhas 1397-1403), remover `responsavelAuditoria: responsavelAuditoria.trim() || null,`.
- Remover o bloco JSX inteiro do input (linhas 1504-1514):

```tsx
          {destino === "novo" && (
            <div className="space-y-1.5">
              <Label htmlFor="responsavel-auditoria">Responsável pela auditoria</Label>
              <Input
                id="responsavel-auditoria"
                value={responsavelAuditoria}
                onChange={(e) => setResponsavelAuditoria(e.target.value)}
                disabled={busy}
              />
            </div>
          )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `campo-queries.ts` nem `campo.inspecao.$id.tsx`. (Se `actorName` ficar sem uso após a remoção, ele ainda é usado em `created_by_name`/`compor` — não remover.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/campo-queries.ts src/routes/campo.inspecao.$id.tsx
git commit -m "refactor(rti): comporRti/ComporRtiDialog largam responsável pela auditoria"
```

---

## Task 7: Hook useEntregarRtiReport com nova assinatura

**Files:**
- Modify: `src/lib/rti-queries.ts:99-114`

- [ ] **Step 1: Estender o payload e a chamada da RPC**

Substituir a função `useEntregarRtiReport` por:

```ts
export type EntregarRtiPayload = {
  reportId: string;
  orgId: string;
  responsaveisCampoExtra: string[];
  responsavelRelatorio: string | null;
  responsavelTecnicoRti: string | null;
  responsavelPlano: string | null;
  periodoInicio: string; // ISO date (yyyy-mm-dd)
  periodoFim: string;    // ISO date (yyyy-mm-dd)
};

export function useEntregarRtiReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: EntregarRtiPayload) => {
      const { error } = await (supabase as any).rpc("fn_entregar_rti_report", {
        _report_id: p.reportId,
        _entregue_por_org: p.orgId,
        _responsaveis_campo_extra: p.responsaveisCampoExtra,
        _responsavel_relatorio: p.responsavelRelatorio,
        _responsavel_tecnico_rti: p.responsavelTecnicoRti,
        _responsavel_plano: p.responsavelPlano,
        _periodo_inicio: p.periodoInicio,
        _periodo_fim: p.periodoFim,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rtiKeys.reports });
      qc.invalidateQueries({ queryKey: ["rti_ncs"] });
    },
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: `rti-queries.ts` sem erros novos. `rti.plano.tsx` **passará a ter erro** na chamada antiga de `entregar.mutate(...)` — esperado, será corrigido na Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rti-queries.ts
git commit -m "feat(rti): useEntregarRtiReport com payload de responsáveis/datas"
```

---

## Task 8: Pop-up EntregarRtiDialog + fiação do botão (rti.plano.tsx)

**Files:**
- Modify: `src/routes/rti.plano.tsx` (imports; botão ~326-357; novo componente no fim do arquivo)

Dialog, DialogContent/Header/Title/Description/Footer, Input, Label e Button já estão importados (`rti.plano.tsx:22-52`). Falta `X` (já importado, linha 19) e os helpers/hook.

- [ ] **Step 1: Importar helpers e o tipo do payload**

Garantir os imports no topo de `rti.plano.tsx`:
- De `@/lib/rti`: adicionar `responsaveisInspecaoCampo` e `labelResponsaveisCampo` ao import existente de `@/lib/rti` (o bloco que começa em `clampPrioridade,` na linha ~57).
- De `@/lib/rti-queries`: garantir `useEntregarRtiReport` já importado (está). Não é preciso importar `EntregarRtiPayload` (o dialog monta o objeto inline).

- [ ] **Step 2: Adicionar estado de abertura do dialog no componente da página**

Dentro de `RtiPlanoPage`, junto aos outros `useState` (perto da linha 153-154), adicionar:

```tsx
  const [entregarOpen, setEntregarOpen] = useState(false);
```

- [ ] **Step 3: Trocar o `onClick` do botão para abrir o dialog**

Substituir o bloco do botão "Entregar relatório" (linhas ~333-355) por:

```tsx
              {repAcc?.canEntregar && auth.currentOrgId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={entregar.isPending}
                  onClick={() => setEntregarOpen(true)}
                >
                  {entregar.isPending ? "Entregando…" : "Entregar relatório"}
                </Button>
              )}
```

- [ ] **Step 4: Renderizar o dialog**

Logo após o `<PageShell>` de abertura do return (ou ao final, antes de fechar `</PageShell>`), renderizar o dialog quando houver relatório ativo e o usuário puder entregar:

```tsx
      {activeReport && repAcc?.canEntregar && auth.currentOrgId && (
        <EntregarRtiDialog
          open={entregarOpen}
          onOpenChange={setEntregarOpen}
          report={activeReport}
          actorName={actorName}
          isPending={entregar.isPending}
          onConfirm={(dados) =>
            entregar.mutate(
              {
                reportId: activeReport.id,
                orgId: auth.currentOrg?.managed_by_org_id ?? auth.currentOrgId!,
                ...dados,
              },
              {
                onSuccess: () => {
                  setEntregarOpen(false);
                  toast.success("Relatório entregue.");
                },
                onError: (e) => toast.error("Falha ao entregar: " + (e as Error).message),
              },
            )
          }
        />
      )}
```

- [ ] **Step 5: Implementar o componente `EntregarRtiDialog` no fim do arquivo**

Adicionar ao final de `rti.plano.tsx` (após `RtiPlanoPage` e antes/depois dos outros componentes locais):

```tsx
function EntregarRtiDialog({
  open,
  onOpenChange,
  report,
  actorName,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  report: RtiReport;
  actorName: string | null;
  isPending: boolean;
  onConfirm: (dados: {
    responsaveisCampoExtra: string[];
    responsavelRelatorio: string | null;
    responsavelTecnicoRti: string | null;
    responsavelPlano: string | null;
    periodoInicio: string;
    periodoFim: string;
  }) => void;
}) {
  const auto = useMemo(() => responsaveisInspecaoCampo(report.coletores_campo, null), [report]);
  const [extras, setExtras] = useState<string[]>([]);
  const [novo, setNovo] = useState("");
  const [tecnicoRti, setTecnicoRti] = useState("");
  const [respPlano, setRespPlano] = useState("");
  const [inicio, setInicio] = useState(report.periodo_inicio ?? "");
  const [fim, setFim] = useState(report.periodo_fim ?? "");

  const totalCampo = auto.length + extras.length;
  const podeEntregar = totalCampo >= 1 && inicio !== "" && fim !== "";
  const hoje = formatDatePtBR(new Date().toISOString().slice(0, 10));

  function addExtra() {
    const t = novo.trim();
    if (!t) return;
    // não duplica com auto nem com extras já adicionados
    if (auto.includes(t) || extras.includes(t)) {
      setNovo("");
      return;
    }
    setExtras((prev) => [...prev, t]);
    setNovo("");
  }

  function submit() {
    if (!podeEntregar) return;
    if (
      !window.confirm(
        "Após entregar, o cliente não poderá mais alterar o registro técnico " +
          "(criticidade, recomendações, evidências de constatação) deste relatório. Continuar?",
      )
    )
      return;
    onConfirm({
      responsaveisCampoExtra: extras,
      responsavelRelatorio: actorName,
      responsavelTecnicoRti: tecnicoRti.trim() || null,
      responsavelPlano: respPlano.trim() || null,
      periodoInicio: inicio,
      periodoFim: fim,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!isPending ? onOpenChange(o) : null)}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entregar relatório</DialogTitle>
          <DialogDescription>
            Informe os responsáveis e o período da inspeção. A data de entrega é registrada
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Responsáveis pela inspeção em campo */}
          <div className="space-y-1.5">
            <Label>{labelResponsaveisCampo(totalCampo)} *</Label>
            <div className="flex flex-wrap gap-1.5">
              {auto.map((nome) => (
                <span
                  key={`auto-${nome}`}
                  className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs"
                  title="Coletado em campo (PWA) — não removível"
                >
                  {nome}
                </span>
              ))}
              {extras.map((nome) => (
                <span
                  key={`extra-${nome}`}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                >
                  {nome}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setExtras((prev) => prev.filter((n) => n !== nome))}
                    aria-label={`Remover ${nome}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addExtra();
                  }
                }}
                placeholder="Adicionar responsável…"
              />
              <Button type="button" variant="outline" onClick={addExtra} disabled={!novo.trim()}>
                Adicionar
              </Button>
            </div>
          </div>

          {/* Responsável pelo relatório (travado) */}
          <div className="space-y-1.5">
            <Label>Responsável pelo relatório</Label>
            <Input value={actorName ?? ""} disabled readOnly />
          </div>

          {/* Responsável Técnico do RTI (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="ent-tecnico-rti">Responsável Técnico do RTI</Label>
            <Input
              id="ent-tecnico-rti"
              value={tecnicoRti}
              onChange={(e) => setTecnicoRti(e.target.value)}
              placeholder="Opcional"
            />
            <p className="text-[11px] text-muted-foreground">
              Pessoa que emitirá a ART do RTI. Pode ser diferente de quem coletou em campo,
              entregou ou criou o relatório.
            </p>
          </div>

          {/* Responsável pelo plano de ação (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="ent-resp-plano">Responsável pelo plano de ação</Label>
            <Input
              id="ent-resp-plano"
              value={respPlano}
              onChange={(e) => setRespPlano(e.target.value)}
              placeholder="Opcional"
            />
            <p className="text-[11px] text-muted-foreground">
              Se preenchido, será aplicado às ações sem responsável definido.
            </p>
          </div>

          {/* Período da inspeção */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ent-inicio">Início da inspeção *</Label>
              <Input
                id="ent-inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ent-fim">Término da inspeção *</Label>
              <Input
                id="ent-fim"
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
          </div>

          {/* Data de entrega (automática) */}
          <div className="space-y-1.5">
            <Label>Data de entrega</Label>
            <Input value={hoje} disabled readOnly />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!podeEntregar || isPending}>
            {isPending ? "Entregando…" : "Entregar relatório"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Garantir o import do tipo `RtiReport`**

No topo de `rti.plano.tsx`, confirmar que `RtiReport` está importado de `@/lib/rti` (o import de tipos do RTI). Se não estiver, adicionar `type RtiReport` ao import. (`RtiNc`, `RtiNcStatus` já são importados desse módulo.)

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: `rti.plano.tsx` sem erros novos.

- [ ] **Step 8: Verificar no preview local (porta 57010)**

Abrir `http://localhost:57010/rti/plano?report=<id de um relatório NÃO entregue>` com `preview_snapshot`; usar `preview_click` no botão "Entregar relatório".
Expected:
- Dialog abre com: campo de responsáveis (chips de `coletores_campo` sem X, se houver), "Responsável pelo relatório" preenchido e desabilitado, campos opcionais, início/término (pré-preenchidos se o relatório tiver período), "Data de entrega" = hoje desabilitado.
- Com nenhum responsável de campo e/ou datas vazias → botão "Entregar relatório" (do rodapé) desabilitado.
- Adicionar um nome manual via `preview_fill` + clicar "Adicionar" → vira chip removível; com ≥1 nome + datas, o botão habilita.
- Label muda para "Responsáveis…" (plural) com 2+ nomes.

- [ ] **Step 9: Commit**

```bash
git add src/routes/rti.plano.tsx
git commit -m "feat(rti): pop-up de entrega com responsáveis, técnico do RTI e período"
```

---

## Task 9: Exibir responsáveis no cabeçalho do relatório (rti.index.tsx)

**Files:**
- Modify: `src/routes/rti.index.tsx` (cabeçalho ~209-226)

- [ ] **Step 1: Importar o helper**

No import de `@/lib/rti` em `rti.index.tsx`, adicionar `responsaveisInspecaoCampo` e `labelResponsaveisCampo`.

- [ ] **Step 2: Adicionar as linhas de responsáveis abaixo do parágrafo de período**

Logo após o `</p>` que fecha o subtítulo (linha ~226), adicionar um bloco condicional que só aparece quando o relatório foi entregue ou tem algum desses dados:

```tsx
          {activeReport &&
            (() => {
              const respCampo = responsaveisInspecaoCampo(
                activeReport.coletores_campo,
                activeReport.responsaveis_campo_extra,
              );
              const temAlgo =
                respCampo.length > 0 ||
                activeReport.responsavel_relatorio ||
                activeReport.responsavel_tecnico_rti ||
                activeReport.entregue_em;
              if (!temAlgo) return null;
              return (
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {respCampo.length > 0 && (
                    <span>
                      {labelResponsaveisCampo(respCampo.length)}: {respCampo.join(", ")}
                    </span>
                  )}
                  {activeReport.responsavel_tecnico_rti && (
                    <span>Responsável Técnico do RTI: {activeReport.responsavel_tecnico_rti}</span>
                  )}
                  {activeReport.responsavel_relatorio && (
                    <span>Responsável pelo relatório: {activeReport.responsavel_relatorio}</span>
                  )}
                  {activeReport.entregue_em && (
                    <span>Entregue em {formatDatePtBR(activeReport.entregue_em)}</span>
                  )}
                </div>
              );
            })()}
```

(`formatDatePtBR` já está importado em `rti.index.tsx`.)

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: `rti.index.tsx` sem erros novos.

- [ ] **Step 4: Verificar no preview local (porta 57010)**

Abrir `http://localhost:57010/rti?report=<id de um relatório já entregue no teste da Task 8>` com `preview_snapshot`.
Expected: cabeçalho mostra "Responsáveis pela inspeção em campo: …", "Responsável Técnico do RTI: …" (se preenchido), "Responsável pelo relatório: …" e "Entregue em DD/MM/AAAA".

- [ ] **Step 5: Commit**

```bash
git add src/routes/rti.index.tsx
git commit -m "feat(rti): cabeçalho exibe responsáveis e data de entrega"
```

---

## Task 10: Validação end-to-end + suíte de testes

**Files:** nenhum (verificação).

- [ ] **Step 1: Rodar a suíte de testes**

Run: `npx vitest run`
Expected: verde (inclui `rti-responsaveis.test.ts`). Falhas pré-existentes não relacionadas, se houver, devem ser as mesmas de antes desta fatia.

- [ ] **Step 2: Type-check completo**

Run: `npx tsc --noEmit`
Expected: nenhum erro **novo** em relação à baseline conhecida (CLAUDE.md: erros tsc pré-existentes são conhecidos). Nenhuma referência remanescente a `responsavel_auditoria`.

- [ ] **Step 3: Grep de resíduo**

Run: `git grep -n "responsavel_auditoria\|responsavelAuditoria"`
Expected: sem resultados em `src/` (só possivelmente em docs/specs antigos e no arquivo de migration do rename — aceitável).

- [ ] **Step 4: Fluxo manual no preview (porta 57010)**

Com `preview_*` no servidor do usuário:
1. Criar relatório em branco em `/rti/importar` (só título) → confirmar que salvou.
2. Em `/rti/plano?report=<id>`, adicionar 1 NC sem responsável (ou importar planilha com uma NC com responsável e outra sem).
3. Entregar via pop-up: preencher 2 responsáveis de campo (label vira plural), Responsável Técnico do RTI, Responsável pelo plano de ação, início/término. Confirmar o `window.confirm`.
4. Após entrega: via MCP `execute_sql`, conferir que `rti_ncs.responsavel` foi preenchido **apenas** na NC que estava vazia, e que a NC que já tinha responsável foi preservada:
   ```sql
   select numero, responsavel from public.rti_ncs where report_id = '<id>' order by numero;
   ```
5. Em `/rti?report=<id>`, conferir o cabeçalho com os responsáveis e "Entregue em".
6. Conferir que o botão "Entregar relatório" some (relatório já entregue) e o badge/linha de entrega aparece.

- [ ] **Step 5: Commit (se algum ajuste de validação foi necessário)**

Somente se houve correção. Caso contrário, nada a commitar.

---

## Notas finais

- **Push:** este plano **não** inclui `git push`. Deploys de staging/main só sob pedido explícito do usuário (CLAUDE.md 2026-07-02).
- **PWA:** nenhuma mudança no `campo-pwa` (o app offline não entrega RTI). A dependência do campo é só a leitura de `coletores_campo`, já populada por `comporRti`.
- **Selo:** a cascata de congelamento permanece idêntica; `rti_ncs.responsavel` é coluna livre, então o preenchimento do responsável do plano na entrega não é bloqueado pelo trigger.
