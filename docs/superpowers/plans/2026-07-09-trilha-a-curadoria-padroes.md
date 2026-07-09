# Trilha A — Curadoria de Padrões: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Founder cura estruturas Setor→Ativo→Componente de inspeções reais em `/admin/padroes`, publica modelos por segmento, e o consultor aplica um modelo ao criar inspeção.

**Architecture:** Tabela `estrutura_modelos` (árvore em jsonb, snapshot sem ids); painel platform-admin lista estruturas existentes e promove com **editor de generalização obrigatório** (renomear/remover nós — anonimização D-A3); aplicar modelo = converter árvore em `EstruturaLinha[]` e reusar `bulkCreateNodes` (que já deduplica e **soma** — requisito §7 da spec de graça). Funções puras TDD em `src/lib/estrutura-modelos.ts`.

**Tech Stack:** Supabase (RLS `is_platform_admin` p/ escrita, publicados p/ leitura), TanStack Router (rota `admin.padroes.tsx`), React Query, shadcn/ui.

> **Decisão nova (D-A6, registrar na Task 7):** o editor de generalização v1 é uma
> lista indentada (um Input + botão remover por nó), sem drag-and-drop nem adição de
> nós — quem quiser nó novo edita a inspeção de origem antes de promover. Menor
> custo que um tree-editor e suficiente para renomear/remover (o trabalho real da
> anonimização).

**Fatos do código usados (verificados):** `bulkCreateNodes(inspectionId, EstruturaLinha[])` em `campo-queries.ts:320` (dedupe por `parent|nome`, soma a árvores existentes); `EstruturaLinha {setor, ativo, componente}` e `normalizarEstrutura` em `campo.ts`; `FieldNode {parent_id, nivel: "setor"|"ativo"|"componente", nome, ordem}`; criação de inspeção no dialog de `campo.index.tsx:~530` (`upsert.mutateAsync` → navigate); `useAuth().isPlatformAdmin`.

---

### Task 1: Migration + tipos

**Files:**
- Create: `supabase/migrations/20260709110000_estrutura_modelos.sql`
- Modify: `src/integrations/supabase/types.ts`, `src/lib/campo.ts` (tipo `FieldInspection`), `packages/campo-core/src/types.ts` (idem, campo opcional)

- [ ] **Step 1: SQL** (aplicar via MCP `apply_migration` no projeto `fumwovtzyhxrjhkjzujs` + versionar):

```sql
-- ============================================================================
-- Trilha A — Curadoria de Padrões (2026-07-09)
-- estrutura_modelos: modelos de árvore Setor→Ativo→Componente por segmento,
-- curados pelo platform admin. Regra dura: nenhum conteúdo de uma org é sugerido
-- a outra sem passar pela curadoria da raiz (spec §3). Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.estrutura_modelos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  segmento           text NOT NULL,
  descricao          text,
  arvore             jsonb NOT NULL,   -- [{nome, filhos:[{nome, filhos:[{nome}]}]}] — snapshot, sem ids
  publicado          boolean NOT NULL DEFAULT false,
  -- rastreabilidade interna da curadoria; o RLS de field_inspections impede
  -- não-admins de resolverem este id para dados do cliente de origem.
  origem_inspecao_id uuid REFERENCES public.field_inspections(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estrutura_modelos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_estrutura_modelos_segmento ON public.estrutura_modelos(segmento);

DROP TRIGGER IF EXISTS estrutura_modelos_touch ON public.estrutura_modelos;
CREATE TRIGGER estrutura_modelos_touch
  BEFORE UPDATE ON public.estrutura_modelos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Publicados: qualquer autenticado lê. Rascunhos e escrita: só platform admin.
DROP POLICY IF EXISTS "estrutura_modelos_select" ON public.estrutura_modelos;
CREATE POLICY "estrutura_modelos_select" ON public.estrutura_modelos FOR SELECT
  USING (publicado OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "estrutura_modelos_admin_write" ON public.estrutura_modelos;
CREATE POLICY "estrutura_modelos_admin_write" ON public.estrutura_modelos FOR ALL
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Segmento na inspeção (agrupa no painel e dispara a sugestão de modelo).
ALTER TABLE public.field_inspections
  ADD COLUMN IF NOT EXISTS segmento text;
```

- [ ] **Step 2: Verificar via `execute_sql`** — colunas de `estrutura_modelos` e `field_inspections.segmento` presentes.

- [ ] **Step 3: Tipos.** Em `src/integrations/supabase/types.ts`, tabela `estrutura_modelos` (Row/Insert/Update, `arvore: Json`, Relationships com fk `estrutura_modelos_origem_inspecao_id_fkey` → `field_inspections`) inserida em ordem alfabética; `segmento: string | null` em `field_inspections` (Row) e `segmento?: string | null` (Insert/Update). Em `src/lib/campo.ts` e `packages/campo-core/src/types.ts`: `segmento?: string | null` no tipo `FieldInspection`.

- [ ] **Step 4: `npx tsc --noEmit` limpo → commit** `feat(padroes): schema estrutura_modelos + segmento em field_inspections`.

---

### Task 2: Lib pura (TDD)

**Files:**
- Create: `src/lib/estrutura-modelos.ts`
- Test: `src/lib/__tests__/estrutura-modelos.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, test } from "vitest";
import {
  arvoreFromNodes,
  contarNos,
  linhasFromArvore,
  validarArvore,
  type ArvoreNo,
} from "../estrutura-modelos";

const nodes = [
  { id: "s1", parent_id: null, nivel: "setor" as const, nome: "Extração", ordem: 1 },
  { id: "s2", parent_id: null, nivel: "setor" as const, nome: "Caldeira", ordem: 2 },
  { id: "a1", parent_id: "s1", nivel: "ativo" as const, nome: "CCM-02", ordem: 1 },
  { id: "c1", parent_id: "a1", nivel: "componente" as const, nome: "Gaveta G4", ordem: 1 },
];

describe("arvoreFromNodes", () => {
  test("monta a árvore aninhada na ordem dos nós", () => {
    const arvore = arvoreFromNodes(nodes);
    expect(arvore).toEqual([
      { nome: "Extração", filhos: [{ nome: "CCM-02", filhos: [{ nome: "Gaveta G4", filhos: [] }] }] },
      { nome: "Caldeira", filhos: [] },
    ]);
  });

  test("órfão (parent inexistente) é ignorado sem quebrar", () => {
    const arvore = arvoreFromNodes([
      ...nodes,
      { id: "x", parent_id: "nao-existe", nivel: "ativo" as const, nome: "Fantasma", ordem: 9 },
    ]);
    expect(contarNos(arvore)).toBe(4);
  });
});

describe("linhasFromArvore (roundtrip com bulkCreateNodes)", () => {
  test("achata a árvore em linhas Setor/Ativo/Componente", () => {
    const arvore = arvoreFromNodes(nodes);
    expect(linhasFromArvore(arvore)).toEqual([
      { setor: "Extração", ativo: "CCM-02", componente: "Gaveta G4" },
      { setor: "Caldeira", ativo: null, componente: null },
    ]);
  });

  test("ativo sem componente vira linha própria", () => {
    const arvore: ArvoreNo[] = [{ nome: "SE 01", filhos: [{ nome: "QGBT", filhos: [] }] }];
    expect(linhasFromArvore(arvore)).toEqual([{ setor: "SE 01", ativo: "QGBT", componente: null }]);
  });
});

describe("validarArvore", () => {
  test("aceita árvore válida", () => {
    expect(validarArvore(arvoreFromNodes(nodes))).toEqual([]);
  });
  test("acusa nome vazio e profundidade > 3", () => {
    const ruim: ArvoreNo[] = [
      { nome: "  ", filhos: [] },
      { nome: "S", filhos: [{ nome: "A", filhos: [{ nome: "C", filhos: [{ nome: "D", filhos: [] }] }] }] },
    ];
    const erros = validarArvore(ruim);
    expect(erros.length).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar → FAIL.** `npx vitest run src/lib/__tests__/estrutura-modelos.test.ts`

- [ ] **Step 3: Implementar**

```ts
// Trilha A — árvore de modelo (jsonb) ⇄ nós/linhas de estrutura. Puro, TDD.
import type { EstruturaLinha } from "./campo";

export interface ArvoreNo {
  nome: string;
  filhos: ArvoreNo[];
}

/** nós do banco (field_nodes) → árvore aninhada por ordem; órfãos são ignorados. */
export function arvoreFromNodes(
  nodes: { id: string; parent_id: string | null; nome: string; ordem: number }[],
): ArvoreNo[] {
  const sorted = [...nodes].sort((a, b) => a.ordem - b.ordem);
  const noDe = new Map<string, ArvoreNo>();
  for (const n of sorted) noDe.set(n.id, { nome: n.nome, filhos: [] });
  const raiz: ArvoreNo[] = [];
  for (const n of sorted) {
    const eu = noDe.get(n.id)!;
    if (n.parent_id === null) raiz.push(eu);
    else noDe.get(n.parent_id)?.filhos.push(eu); // parent fora do conjunto → ignora
  }
  // remove órfãos de raiz falsa: só entram os parent_id === null (já garantido acima)
  return raiz;
}

/** árvore → linhas para bulkCreateNodes (que deduplica e SOMA à árvore existente). */
export function linhasFromArvore(arvore: ArvoreNo[]): EstruturaLinha[] {
  const linhas: EstruturaLinha[] = [];
  for (const setor of arvore) {
    if (setor.filhos.length === 0) {
      linhas.push({ setor: setor.nome, ativo: null, componente: null });
      continue;
    }
    for (const ativo of setor.filhos) {
      if (ativo.filhos.length === 0) {
        linhas.push({ setor: setor.nome, ativo: ativo.nome, componente: null });
        continue;
      }
      for (const comp of ativo.filhos) {
        linhas.push({ setor: setor.nome, ativo: ativo.nome, componente: comp.nome });
      }
    }
  }
  return linhas;
}

export function contarNos(arvore: ArvoreNo[]): number {
  let n = 0;
  const walk = (nos: ArvoreNo[]) => {
    for (const x of nos) {
      n += 1;
      walk(x.filhos);
    }
  };
  walk(arvore);
  return n;
}

/** Erros humanos de validação (vazio = ok). Níveis: setor→ativo→componente (máx. 3). */
export function validarArvore(arvore: ArvoreNo[]): string[] {
  const erros: string[] = [];
  const walk = (nos: ArvoreNo[], profundidade: number, caminho: string) => {
    for (const x of nos) {
      const rotulo = caminho ? `${caminho} › ${x.nome}` : x.nome;
      if (!x.nome.trim()) erros.push(`Nó com nome vazio em "${caminho || "raiz"}"`);
      if (profundidade === 3 && x.filhos.length > 0)
        erros.push(`"${rotulo}" passa de 3 níveis (setor→ativo→componente)`);
      walk(x.filhos, profundidade + 1, rotulo);
    }
  };
  walk(arvore, 1, "");
  return erros;
}

/** Remove um nó pelo caminho de índices (ex.: [0,2] = 3º filho do 1º setor). Imutável. */
export function removerNo(arvore: ArvoreNo[], caminho: number[]): ArvoreNo[] {
  if (caminho.length === 0) return arvore;
  const [i, ...resto] = caminho;
  return arvore.flatMap((no, idx) => {
    if (idx !== i) return [no];
    if (resto.length === 0) return [];
    return [{ ...no, filhos: removerNo(no.filhos, resto) }];
  });
}

/** Renomeia um nó pelo caminho de índices. Imutável. */
export function renomearNo(arvore: ArvoreNo[], caminho: number[], nome: string): ArvoreNo[] {
  if (caminho.length === 0) return arvore;
  const [i, ...resto] = caminho;
  return arvore.map((no, idx) => {
    if (idx !== i) return no;
    if (resto.length === 0) return { ...no, nome };
    return { ...no, filhos: renomearNo(no.filhos, resto, nome) };
  });
}
```

Adicionar ao teste (mesmo arquivo, antes do Step 2 rodar): casos de `removerNo`/`renomearNo`:

```ts
describe("edição imutável (editor de generalização)", () => {
  test("removerNo tira o nó e a subárvore", () => {
    const arvore = arvoreFromNodes(nodes);
    const sem = removerNo(arvore, [0, 0]); // CCM-02 (e Gaveta G4 junto)
    expect(contarNos(sem)).toBe(2);
  });
  test("renomearNo troca só o alvo", () => {
    const arvore = arvoreFromNodes(nodes);
    const ren = renomearNo(arvore, [0, 0, 0], "Gaveta genérica");
    expect(ren[0].filhos[0].filhos[0].nome).toBe("Gaveta genérica");
    expect(arvore[0].filhos[0].filhos[0].nome).toBe("Gaveta G4"); // original intacto
  });
});
```

(importar `removerNo, renomearNo` no teste.)

- [ ] **Step 4: Rodar → PASS. Commit** `feat(padroes): arvore de modelo pura (from/para nós, validacao, edicao imutavel) com TDD`.

---

### Task 3: Queries

**Files:**
- Create: `src/lib/estrutura-modelos-queries.ts`

- [ ] **Step 1: Implementar**

```ts
// Trilha A — React Query + Supabase dos modelos de estrutura.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bulkCreateNodes } from "@/lib/campo-queries";
import { linhasFromArvore, type ArvoreNo } from "@/lib/estrutura-modelos";

export interface EstruturaModelo {
  id: string;
  nome: string;
  segmento: string;
  descricao: string | null;
  arvore: ArvoreNo[];
  publicado: boolean;
  origem_inspecao_id: string | null;
  created_at: string;
  updated_at: string;
}

const parse = (row: Record<string, unknown>): EstruturaModelo =>
  ({ ...row, arvore: (row.arvore ?? []) as ArvoreNo[] }) as EstruturaModelo;

/** Modelos publicados de um segmento (consumo na criação de inspeção). */
export function useModelosDoSegmento(segmento?: string | null) {
  return useQuery({
    queryKey: ["estrutura_modelos", "segmento", segmento ?? "none"],
    enabled: !!segmento?.trim(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estrutura_modelos")
        .select("*")
        .eq("publicado", true)
        .ilike("segmento", segmento!.trim())
        .order("nome");
      if (error) throw error;
      return (data ?? []).map(parse);
    },
  });
}

/** Todos os modelos (painel de curadoria — platform admin enxerga rascunhos via RLS). */
export function useModelosAdmin() {
  return useQuery({
    queryKey: ["estrutura_modelos", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estrutura_modelos")
        .select("*")
        .order("segmento")
        .order("nome");
      if (error) throw error;
      return (data ?? []).map(parse);
    },
  });
}

/** Segmentos distintos (autocomplete): dos modelos publicados + inspeções visíveis. */
export function useSegmentosExistentes() {
  return useQuery({
    queryKey: ["segmentos_existentes"],
    queryFn: async () => {
      const set = new Set<string>();
      const { data: modelos } = await supabase.from("estrutura_modelos").select("segmento");
      for (const m of (modelos ?? []) as { segmento: string }[]) {
        if (m.segmento?.trim()) set.add(m.segmento.trim());
      }
      const { data: insps } = await supabase
        .from("field_inspections")
        .select("segmento")
        .not("segmento", "is", null);
      for (const i of (insps ?? []) as { segmento: string | null }[]) {
        if (i.segmento?.trim()) set.add(i.segmento.trim());
      }
      return [...set].sort((a, b) => a.localeCompare(b));
    },
  });
}

/** Estruturas candidatas à curadoria: inspeções com contagem de nós (platform admin). */
export function useEstruturasParaCurar() {
  return useQuery({
    queryKey: ["estruturas_para_curar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_inspections")
        .select("id, titulo, cliente, segmento, org_id, created_at, field_nodes(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Raw = {
        id: string;
        titulo: string;
        cliente: string | null;
        segmento: string | null;
        org_id: string | null;
        created_at: string;
        field_nodes: { id: string }[];
      };
      return ((data ?? []) as unknown as Raw[])
        .map((r) => ({ ...r, nos: r.field_nodes?.length ?? 0 }))
        .filter((r) => r.nos > 0);
    },
  });
}

/** Nós de uma inspeção (para montar a árvore no editor de promoção). */
export function useNodesDaInspecao(inspectionId?: string) {
  return useQuery({
    queryKey: ["field_nodes_curadoria", inspectionId ?? "none"],
    enabled: !!inspectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_nodes")
        .select("id, parent_id, nivel, nome, ordem")
        .eq("inspection_id", inspectionId!)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: {
      id?: string;
      nome: string;
      segmento: string;
      descricao: string | null;
      arvore: ArvoreNo[];
      publicado: boolean;
      origem_inspecao_id?: string | null;
    }) => {
      const payload = {
        nome: m.nome,
        segmento: m.segmento,
        descricao: m.descricao,
        arvore: m.arvore as never,
        publicado: m.publicado,
        origem_inspecao_id: m.origem_inspecao_id ?? null,
      };
      if (m.id) {
        const { error } = await supabase.from("estrutura_modelos").update(payload as never).eq("id", m.id);
        if (error) throw error;
        return m.id;
      }
      const { data, error } = await supabase
        .from("estrutura_modelos")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estrutura_modelos"] });
      qc.invalidateQueries({ queryKey: ["segmentos_existentes"] });
    },
  });
}

export function useSetPublicado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; publicado: boolean }) => {
      const { error } = await supabase
        .from("estrutura_modelos")
        .update({ publicado: args.publicado } as never)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estrutura_modelos"] }),
  });
}

export function useDeleteModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estrutura_modelos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estrutura_modelos"] }),
  });
}

/** Aplicar = copiar (D-A5): expande a árvore em field_nodes novos; soma, nunca substitui. */
export async function aplicarModelo(inspectionId: string, arvore: ArvoreNo[]): Promise<number> {
  return bulkCreateNodes(inspectionId, linhasFromArvore(arvore));
}
```

- [ ] **Step 2: `npx tsc --noEmit` limpo → commit** `feat(padroes): queries de modelos de estrutura + aplicar via bulkCreateNodes`.

---

### Task 4: Painel `/admin/padroes` com editor de generalização

**Files:**
- Create: `src/routes/admin.padroes.tsx`
- Create: `src/components/estrutura-modelo-editor.tsx`

- [ ] **Step 1: Editor (dialog)** — `estrutura-modelo-editor.tsx`: recebe `{open, onOpenChange, inicial: {nome, segmento, descricao, arvore, id?, origem_inspecao_id?}}`; estado local da árvore; lista indentada recursiva com Input (renomearNo) e botão ✕ (removerNo); campos nome/segmento/descricao; `validarArvore` bloqueia salvar; botões "Salvar rascunho" (publicado=false) e "Salvar e publicar" (publicado=true) via `useSaveModelo`. Aviso fixo de anonimização: "Remova nomes de linhas, produtos e referências identificáveis do cliente."

- [ ] **Step 2: Rota** — `admin.padroes.tsx`: gate `useAuth().isPlatformAdmin` (senão, card "Acesso restrito ao dono da plataforma"); duas seções:
  1. **Modelos** (`useModelosAdmin`): tabela nome/segmento/nós/publicado com ações Editar (abre editor), Publicar/Despublicar (`useSetPublicado`), Excluir (`useDeleteModelo`, com AlertDialog).
  2. **Estruturas de inspeções** (`useEstruturasParaCurar`): tabela título/cliente/segmento/nós/data com ação **"Promover a modelo"** → carrega `useNodesDaInspecao`, monta `arvoreFromNodes`, abre o editor com `origem_inspecao_id` preenchido e nome sugerido `Modelo — {segmento || titulo}`.

- [ ] **Step 3: Sidebar** — adicionar item "Padrões" no grupo Configurações do `AppSidebar` (mesmo gate dos itens platform-admin existentes; conferir como "Empresas" é gateado e replicar).

- [ ] **Step 4: `npm run build` (regenera routeTree) + `npx tsc --noEmit` → commit** `feat(padroes): painel /admin/padroes — curadoria, editor de generalizacao e publicacao`.

---

### Task 5: Consumo na criação de inspeção

**Files:**
- Modify: `src/routes/campo.index.tsx` (dialog "Nova inspeção de campo", ~linha 530–651)

- [ ] **Step 1:** No dialog: campo **Segmento** (Input com `<datalist>` de `useSegmentosExistentes`); quando `useModelosDoSegmento(segmento)` retornar modelos, mostrar select "Começar de um modelo (opcional)" com preview `{nome} — {contarNos(arvore)} itens`. No `submit`: incluir `segmento: segmento.trim() || null` no payload do upsert; após criar, se modelo selecionado → `await aplicarModelo(insp.id, modelo.arvore)` + toast `"Estrutura do modelo aplicada (N itens)."`; navegar como hoje. Falha em `aplicarModelo` não pode perder a inspeção criada: try/catch com toast de erro e navegação mesmo assim.

- [ ] **Step 2:** Conferir que o mutation de upsert aceita `segmento` (payload tipado em `campo-queries.ts` — se o tipo do payload for restrito, adicionar o campo).

- [ ] **Step 3: `npx tsc --noEmit` → commit** `feat(padroes): segmento + comecar de um modelo na criacao de inspecao`.

---

### Task 6: Verificação

- [ ] `npx vitest run` (suíte inteira verde), `npx tsc --noEmit`, `npm run build`.
- [ ] Preview (servidor 57010): rota `/admin/padroes` responde (login-gated ok), console sem erros novos.

### Task 7: Docs

- [ ] Registrar **D-A6** (editor v1 = lista indentada sem drag) no arquivo de decisões de implementação; atualizar ROADMAP (trilha A implementada, aguardando curadoria real do founder). Commit `docs: trilha A implementada — D-A6 e ROADMAP`.

---

## Self-review

- **Spec §3 (funil):** painel lê inspeções existentes (Task 4.2), promoção com editor obrigatório (não existe "publicar direto" — o botão sempre abre o editor), publicação/despublicação (Task 4). §3-anonimização: aviso no editor + sem org de origem exposta (só `origem_inspecao_id`, RLS impede resolução por não-admin — documentado na migration).
- **Spec §4 (consumo):** segmento com autocomplete + aplicar=copiar via `bulkCreateNodes` (Task 5); PWA intocado (estrutura desce pelo sync como hoje; `segmento` opcional no tipo compartilhado).
- **Spec §5 (dados):** tabela conforme (jsonb, publicado, origem_inspecao_id, RLS). `field_inspections.segmento` ok.
- **Spec §7 (erros/testes):** aplicar soma (comportamento nativo de `bulkCreateNodes`, coberto pelo teste existente de dedupe em campo-arvore.test.ts), validador de níveis (Task 2), puras com TDD (arvoreFromNodes/linhasFromArvore/validar/remover/renomear).
- **Fora de escopo honrado:** sem clustering, sem templates completos, sem modelos por consultoria.
