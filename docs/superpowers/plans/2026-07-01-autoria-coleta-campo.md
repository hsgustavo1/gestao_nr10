# Autoria de coleta em campo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada `field_points` passa a carregar quem o coletou (capturado automaticamente, sem ação manual do técnico), e o RTI composto separa "responsável pela auditoria" (escolha explícita de quem consolida) de "coletado em campo por" (lista automática derivada dos pontos).

**Architecture:** Duas colunas novas via migration (`field_points.collected_by_user_id`/`collected_by_name`, `rti_reports.coletores_campo`). Captura no PWA: sessão Supabase já autenticada é cacheada em `localStorage` (mesmo padrão de `org.ts`) no único ponto de entrada autenticado (`Layout.tsx`), lida de forma síncrona no único call site que cria pontos (`InspectionDetail.tsx:handleAddPoint`). No app principal: `comporRti()` para de copiar `inspection.engenheiro` para `responsavel_auditoria` e passa a receber esse valor como parâmetro explícito vindo de um novo campo no `ComporRtiDialog`; a mesma função calcula `coletores_campo` a partir dos `field_points` carregados.

**Tech Stack:** React + TanStack Router (app principal), React Router (campo-pwa), Dexie.js (IndexedDB), Supabase (Postgres + RLS), vitest.

---

## Contexto para quem for implementar

- Duplicação de tipos já existente e não relacionada a esta fatia: `FieldPoint`
  existe em **dois lugares** — `packages/campo-core/src/types.ts` (usado pelo
  PWA) e `src/lib/campo.ts` (usado pelo app principal / `campo-queries.ts`).
  Os dois precisam ganhar os campos novos em paralelo; não são o mesmo
  arquivo.
- `responsavel_auditoria` (RTI) **não é renderizado em nenhuma tela de
  leitura hoje** neste repo (só é escrito em `rti.importar.tsx` e
  `campo-queries.ts`). Não é escopo desta fatia inventar uma tela de leitura
  para ele nem para `coletores_campo` — só persistir corretamente. Se
  aparecer necessidade de exibir depois, é item futuro (P2 da spec).
- Spec completa: `docs/superpowers/specs/2026-07-01-autoria-coleta-campo-design.md`.

---

### Task 1: Migration — `field_points.collected_by_*`

**Files:**
- Create: `supabase/migrations/20260701010000_field_points_collected_by.sql`

- [ ] **Step 1: Escrever o arquivo de migration**

```sql
-- Autoria de coleta em campo: quem estava logado quando o ponto foi criado.
-- Nullable — pontos existentes (pré-migração) ficam com autor desconhecido,
-- tratado como "não registrado" no lado da leitura (não é erro).
alter table public.field_points
  add column collected_by_user_id uuid references auth.users(id),
  add column collected_by_name text;
```

- [ ] **Step 2: Aplicar via MCP do Supabase**

Use a tool `mcp__61ec2be3-08ad-4929-baea-9c87b8595ac0__apply_migration` com
`name: "field_points_collected_by"` e o SQL do Step 1, no projeto
`fumwovtzyhxrjhkjzujs`.

- [ ] **Step 3: Confirmar a coluna existe**

Use `mcp__61ec2be3-08ad-4929-baea-9c87b8595ac0__execute_sql` com:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'field_points' and column_name like 'collected_by%';
```

Esperado: duas linhas, `collected_by_user_id` (`uuid`, `YES`) e
`collected_by_name` (`text`, `YES`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260701010000_field_points_collected_by.sql
git commit -m "feat(campo): adiciona autoria de coleta por ponto (collected_by_*)"
```

---

### Task 2: Migration — `rti_reports.coletores_campo`

**Files:**
- Create: `supabase/migrations/20260701020000_rti_reports_coletores_campo.sql`

- [ ] **Step 1: Escrever o arquivo de migration**

```sql
-- Lista deduplicada de quem coletou evidências em campo para este relatório,
-- derivada de field_points.collected_by_name no momento da composição do RTI.
-- Distinto de responsavel_auditoria (quem assina/consolida o relatório).
alter table public.rti_reports
  add column coletores_campo text[];
```

- [ ] **Step 2: Aplicar via MCP do Supabase**

`mcp__61ec2be3-08ad-4929-baea-9c87b8595ac0__apply_migration`,
`name: "rti_reports_coletores_campo"`, projeto `fumwovtzyhxrjhkjzujs`.

- [ ] **Step 3: Confirmar a coluna existe**

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'rti_reports' and column_name = 'coletores_campo';
```

Esperado: uma linha, `data_type = 'ARRAY'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260701020000_rti_reports_coletores_campo.sql
git commit -m "feat(rti): adiciona coletores_campo em rti_reports"
```

---

### Task 3: Tipos — `FieldPoint` (campo-core, usado pelo PWA)

**Files:**
- Modify: `packages/campo-core/src/types.ts:77-87`

- [ ] **Step 1: Adicionar os campos ao tipo**

Substituir o bloco atual:

```ts
export type FieldPoint = {
  id: string;
  org_id?: string;
  inspection_id: string;
  node_id: string;
  titulo: string | null;
  observacoes: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};
```

por:

```ts
export type FieldPoint = {
  id: string;
  org_id?: string;
  inspection_id: string;
  node_id: string;
  titulo: string | null;
  observacoes: string | null;
  ordem: number;
  /** Quem estava logado quando o ponto foi criado — null em dados pré-migração. */
  collected_by_user_id: string | null;
  collected_by_name: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2: Typecheck do pacote**

Run: `cd packages/campo-core && npx tsc --noEmit`
Expected: sem erros (o tipo é só consumido, ainda não há call site quebrado
nesta etapa isolada — os call sites são corrigidos nas Tasks 5 e 6).

- [ ] **Step 3: Commit**

```bash
git add packages/campo-core/src/types.ts
git commit -m "feat(campo-core): adiciona collected_by_* ao tipo FieldPoint"
```

---

### Task 4: Tipos — `FieldPoint` (app principal) + `RtiReport`

**Files:**
- Modify: `src/lib/campo.ts:103-113`
- Modify: `src/lib/rti.ts:68-84`

- [ ] **Step 1: Adicionar os campos ao `FieldPoint` do app principal**

Em `src/lib/campo.ts`, substituir:

```ts
export type FieldPoint = {
  id: string;
  org_id?: string;
  inspection_id: string;
  node_id: string;
  titulo: string | null;
  observacoes: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};
```

por:

```ts
export type FieldPoint = {
  id: string;
  org_id?: string;
  inspection_id: string;
  node_id: string;
  titulo: string | null;
  observacoes: string | null;
  ordem: number;
  /** Quem estava logado quando o ponto foi criado — null em dados pré-migração. */
  collected_by_user_id: string | null;
  collected_by_name: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2: Adicionar `coletores_campo` ao `RtiReport`**

Em `src/lib/rti.ts`, dentro do tipo `RtiReport` (linha 68), adicionar o
campo após `responsavel_plano`:

```ts
export type RtiReport = {
  id: string;
  titulo: string;
  empresa_auditora: string | null;
  responsavel_auditoria: string | null;
  responsavel_plano: string | null;
  /** Lista deduplicada de field_points.collected_by_name no momento da composição. */
  coletores_campo: string[] | null;
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

- [ ] **Step 3: Typecheck (vai falhar — esperado)**

Run: `npx tsc --noEmit`
Expected: FAIL — `campo-queries.ts` monta objetos `FieldPoint` incompletos
em pontos que ainda não existem no código atual, e o insert de
`rti_reports` na Task 6 ainda não passa `coletores_campo`. Confirmar que os
erros reportados são exatamente sobre esses dois pontos (não sobre outra
coisa) antes de seguir para a Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/lib/campo.ts src/lib/rti.ts
git commit -m "feat(rti): adiciona collected_by_* e coletores_campo aos tipos do app principal"
```

---

### Task 5: `src/integrations/supabase/types.ts` — alinhar com o schema

**Files:**
- Modify: `src/integrations/supabase/types.ts:711-768` (`field_points`)
- Modify: `src/integrations/supabase/types.ts:1923-1980` (`rti_reports`)

- [ ] **Step 1: Adicionar as colunas em `field_points`**

Nos três blocos (`Row`, `Insert`, `Update`) de `field_points`
(linhas 712-744), adicionar as duas colunas novas em ordem alfabética junto
das existentes. `Row`:

```ts
        Row: {
          collected_by_name: string | null
          collected_by_user_id: string | null
          created_at: string
          id: string
          inspection_id: string
          node_id: string
          observacoes: string | null
          ordem: number
          org_id: string
          titulo: string | null
          updated_at: string
        }
```

`Insert` e `Update` (mesmo padrão, ambas opcionais):

```ts
          collected_by_name?: string | null
          collected_by_user_id?: string | null
```

(inserir essas duas linhas em ordem alfabética dentro dos blocos `Insert` e
`Update` existentes, mantendo o restante inalterado).

- [ ] **Step 2: Adicionar `coletores_campo` em `rti_reports`**

Nos três blocos (`Row`, `Insert`, `Update`) de `rti_reports`
(linhas 1924-1980), adicionar `coletores_campo: string[] | null` (Row) /
`coletores_campo?: string[] | null` (Insert, Update) em ordem alfabética
(entre `report_path` e `responsavel_auditoria`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: os erros da Task 4 relacionados a `field_points`/`rti_reports`
desaparecem; podem sobrar os erros esperados de `campo-queries.ts` e
`campo.inspecao.$id.tsx`, resolvidos nas próximas tasks.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(types): alinha types.ts do Supabase com collected_by_* e coletores_campo"
```

---

### Task 6: Autor de campo — cache no PWA (`campo-pwa/src/lib/actor.ts`)

**Files:**
- Create: `campo-pwa/src/lib/actor.ts`
- Modify: `campo-pwa/src/components/Layout.tsx`
- Modify: `campo-pwa/src/pages/InspectionList.tsx` (logout limpa o cache)

- [ ] **Step 1: Criar `actor.ts`**

```ts
// Autor (usuário logado) que coleta os dados em campo neste device.
//
// Cacheado em localStorage a partir da sessão Supabase (mesmo padrão de
// org.ts) — evita repetir uma chamada de sessão em todo ponto criado, e
// mantém o nome disponível mesmo se o refresh de sessão falhar
// momentaneamente offline.

import { supabase } from "./supabase";

const ACTOR_ID_KEY = "campo_actor_id";
const ACTOR_NAME_KEY = "campo_actor_name";

/** Lê a sessão atual e atualiza o cache do autor. Chamar 1x por navegação autenticada. */
export async function cacheActor(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    const name = (user.user_metadata?.full_name as string | undefined) || user.email || null;
    localStorage.setItem(ACTOR_ID_KEY, user.id);
    if (name) localStorage.setItem(ACTOR_NAME_KEY, name);
    else localStorage.removeItem(ACTOR_NAME_KEY);
  } catch {
    // Offline ou sessão inválida — mantém o cache existente.
  }
}

/** id do autor cacheado, ou null se nunca logou neste device. */
export function getActorId(): string | null {
  return localStorage.getItem(ACTOR_ID_KEY);
}

/** Nome do autor cacheado, ou null se nunca logou neste device. */
export function getActorName(): string | null {
  return localStorage.getItem(ACTOR_NAME_KEY);
}

/** Limpa o cache do autor (chamar no logout). */
export function clearActor(): void {
  localStorage.removeItem(ACTOR_ID_KEY);
  localStorage.removeItem(ACTOR_NAME_KEY);
}
```

- [ ] **Step 2: Chamar `cacheActor()` no `Layout.tsx`**

Ler `campo-pwa/src/components/Layout.tsx` primeiro para confirmar que o
trecho abaixo bate com o estado atual do arquivo. Substituir:

```tsx
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/login", { replace: true });
      else setChecked(true);
    });
  }, [navigate]);
```

por:

```tsx
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/login", { replace: true });
      else {
        setChecked(true);
        void cacheActor();
      }
    });
  }, [navigate]);
```

e adicionar o import no topo do arquivo:

```ts
import { cacheActor } from "@/lib/actor";
```

- [ ] **Step 3: Limpar o cache no logout (`InspectionList.tsx`)**

Ler `campo-pwa/src/pages/InspectionList.tsx` primeiro para confirmar o
estado atual de `handleLogout`. Adicionar a chamada de limpeza junto da
existente:

```tsx
    clearOrgContext();
    clearActor();
    await supabase.auth.signOut();
```

e o import:

```ts
import { clearActor } from "@/lib/actor";
```

- [ ] **Step 4: Typecheck**

Run: `cd campo-pwa && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add campo-pwa/src/lib/actor.ts campo-pwa/src/components/Layout.tsx campo-pwa/src/pages/InspectionList.tsx
git commit -m "feat(campo-pwa): cacheia autor da sessão para autoria de coleta"
```

---

### Task 7: Carimbar `collected_by_*` na criação do ponto (PWA)

**Files:**
- Modify: `campo-pwa/src/pages/InspectionDetail.tsx:315-339` (`handleAddPoint`)

- [ ] **Step 1: Adicionar o import**

No topo de `InspectionDetail.tsx`, junto dos demais imports de `@/lib`:

```ts
import { getActorId, getActorName } from "@/lib/actor";
```

- [ ] **Step 2: Carimbar o ponto**

Substituir o objeto `point` dentro de `handleAddPoint`:

```ts
      const point = {
        id: pointId,
        inspection_id: id,
        node_id: currentNodeId,
        titulo: null,
        observacoes: null,
        ordem: existing,
        created_at: now,
        updated_at: now,
        _synced: false,
      };
```

por:

```ts
      const point = {
        id: pointId,
        inspection_id: id,
        node_id: currentNodeId,
        titulo: null,
        observacoes: null,
        ordem: existing,
        collected_by_user_id: getActorId(),
        collected_by_name: getActorName(),
        created_at: now,
        updated_at: now,
        _synced: false,
      };
```

- [ ] **Step 3: Typecheck**

Run: `cd campo-pwa && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificação manual no preview**

O servidor do PWA já roda na porta 8082/57011 (`preview_list` confirma).
Fazer login, abrir uma inspeção, criar um ponto novo. Depois, checar via
`mcp__61ec2be3-08ad-4929-baea-9c87b8595ac0__execute_sql`:

```sql
select id, collected_by_user_id, collected_by_name, created_at
from field_points
order by created_at desc
limit 1;
```

Expected: o ponto recém-criado tem `collected_by_name` preenchido com o
nome/email do usuário logado (não null).

- [ ] **Step 5: Commit**

```bash
git add campo-pwa/src/pages/InspectionDetail.tsx
git commit -m "feat(campo-pwa): carimba autor do ponto na criação"
```

---

### Task 8: Função pura — deduplicar coletores de campo

**Files:**
- Modify: `src/lib/campo.ts` (adicionar função após `caminhoAbaixoDoSetor`, linha 176)
- Test: `src/lib/__tests__/campo-arvore.test.ts`

- [ ] **Step 1: Escrever o teste primeiro**

Adicionar ao final de `src/lib/__tests__/campo-arvore.test.ts`:

```ts
describe("coletoresCampoDe", () => {
  function ponto(collected_by_name: string | null): FieldPoint {
    return {
      id: "p",
      inspection_id: "i",
      node_id: "n",
      titulo: null,
      observacoes: null,
      ordem: 0,
      collected_by_user_id: null,
      collected_by_name,
      created_at: "",
      updated_at: "",
    };
  }

  it("deduplica nomes repetidos preservando a ordem de primeira aparição", () => {
    const pontos = [ponto("Ana"), ponto("Beto"), ponto("Ana")];
    expect(coletoresCampoDe(pontos)).toEqual(["Ana", "Beto"]);
  });

  it("ignora entradas null (dado legado pré-migração)", () => {
    const pontos = [ponto(null), ponto("Ana"), ponto(null)];
    expect(coletoresCampoDe(pontos)).toEqual(["Ana"]);
  });

  it("retorna null quando nenhum ponto tem coletor registrado", () => {
    expect(coletoresCampoDe([ponto(null), ponto(null)])).toBeNull();
  });

  it("retorna null para lista vazia", () => {
    expect(coletoresCampoDe([])).toBeNull();
  });
});
```

Adicionar `coletoresCampoDe` e `type FieldPoint` ao import de `../campo` no
topo do arquivo de teste (mesmo bloco de import dos outros itens, ordem
alfabética — `FieldPoint` já não está importado hoje nesse arquivo, só
`FieldNode`).

- [ ] **Step 2: Rodar o teste — confirmar que falha**

Run: `npx vitest run src/lib/__tests__/campo-arvore.test.ts`
Expected: FAIL — `coletoresCampoDe` não existe em `../campo`.

- [ ] **Step 3: Implementar a função**

Em `src/lib/campo.ts`, adicionar após `caminhoAbaixoDoSetor` (linha 176):

```ts
/**
 * Lista deduplicada de coletores de campo (field_points.collected_by_name),
 * na ordem de primeira aparição. null quando nenhum ponto tem coletor
 * registrado (dado legado pré-migração, ou lista vazia).
 */
export function coletoresCampoDe(points: FieldPoint[]): string[] | null {
  const nomes: string[] = [];
  for (const p of points) {
    if (p.collected_by_name && !nomes.includes(p.collected_by_name)) {
      nomes.push(p.collected_by_name);
    }
  }
  return nomes.length > 0 ? nomes : null;
}
```

- [ ] **Step 4: Rodar o teste — confirmar que passa**

Run: `npx vitest run src/lib/__tests__/campo-arvore.test.ts`
Expected: PASS, todos os testes incluindo os 4 novos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/campo.ts src/lib/__tests__/campo-arvore.test.ts
git commit -m "feat(rti): adiciona coletoresCampoDe para deduplicar autoria de campo"
```

---

### Task 9: `comporRti()` — parar de herdar `engenheiro`, usar `coletoresCampoDe`

**Files:**
- Modify: `src/lib/campo-queries.ts:797-883`

- [ ] **Step 1: Adicionar o import**

No topo de `campo-queries.ts`, dentro do import existente de `./campo`,
adicionar `coletoresCampoDe` à lista (mesma linha 19 mencionada no Task 4).

- [ ] **Step 2: Adicionar o parâmetro `responsavelAuditoria`**

Substituir a assinatura da função (linhas 797-807):

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

por:

```ts
export async function comporRti({
  inspection,
  destino,
  actorName,
  responsavelAuditoria,
  onProgress,
}: {
  inspection: FieldInspection;
  destino: ComporRtiDestino;
  actorName: string | null;
  responsavelAuditoria: string | null;
  onProgress?: (etapa: string, done: number, total: number) => void;
}): Promise<ComporRtiResult> {
```

- [ ] **Step 3: Usar o parâmetro em vez de `inspection.engenheiro`, e calcular `coletores_campo`**

Substituir o bloco de criação do relatório (linhas 861-883):

```ts
  // 2) Relatório de destino
  let reportId: string;
  if (destino.mode === "existente") {
    reportId = destino.reportId;
  } else {
    const { data: rep, error: rErr } = await supabase
      .from("rti_reports")
      .insert({
        ...(orgId ? { org_id: orgId } : {}),
        titulo: inspection.titulo,
        empresa_auditora: inspection.cliente,
        responsavel_auditoria: inspection.engenheiro,
        responsavel_plano: null,
        periodo_inicio: inspection.data_inspecao,
        periodo_fim: inspection.data_inspecao,
        notes: `Composto a partir da coleta em campo "${inspection.titulo}".`,
        created_by_name: actorName,
      } as never)
      .select()
      .single();
    if (rErr) throw rErr;
    reportId = (rep as RtiReport).id;
  }
```

por:

```ts
  // 2) Relatório de destino
  let reportId: string;
  if (destino.mode === "existente") {
    reportId = destino.reportId;
  } else {
    // coletores_campo só é gravado na criação — mesmo comportamento que os
    // demais campos deste insert (empresa_auditora, responsavel_auditoria):
    // recompor pra um relatório existente não atualiza metadados do relatório.
    const coletoresCampo = coletoresCampoDe(points);
    const { data: rep, error: rErr } = await supabase
      .from("rti_reports")
      .insert({
        ...(orgId ? { org_id: orgId } : {}),
        titulo: inspection.titulo,
        empresa_auditora: inspection.cliente,
        responsavel_auditoria: responsavelAuditoria,
        responsavel_plano: null,
        coletores_campo: coletoresCampo,
        periodo_inicio: inspection.data_inspecao,
        periodo_fim: inspection.data_inspecao,
        notes: `Composto a partir da coleta em campo "${inspection.titulo}".`,
        created_by_name: actorName,
      } as never)
      .select()
      .single();
    if (rErr) throw rErr;
    reportId = (rep as RtiReport).id;
  }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: os erros de `campo-queries.ts` da Task 4 desaparecem. Deve sobrar
só o erro esperado em `campo.inspecao.$id.tsx` (call site de `comporRti`
ainda não passa `responsavelAuditoria`), resolvido na Task 10.

- [ ] **Step 5: Commit**

```bash
git add src/lib/campo-queries.ts
git commit -m "feat(rti): comporRti separa responsavel_auditoria de engenheiro e grava coletores_campo"
```

---

### Task 10: `ComporRtiDialog` — campo explícito "Responsável pela auditoria"

**Files:**
- Modify: `src/routes/campo.inspecao.$id.tsx:1365-1537`

- [ ] **Step 1: Adicionar o state, pré-preenchido com `actorName`**

Após a linha `const [destino, setDestino] = useState<string>(defaultDestino ?? "novo");`
(linha 1385), adicionar:

```tsx
  const [responsavelAuditoria, setResponsavelAuditoria] = useState(actorName ?? "");
```

- [ ] **Step 2: Passar o valor para `comporRti()`**

Dentro de `compor()`, no `await comporRti({...})` (linha 1396-1401),
adicionar o campo:

```tsx
      const result = await comporRti({
        inspection,
        destino: destino === "novo" ? { mode: "novo" } : { mode: "existente", reportId: destino },
        actorName,
        responsavelAuditoria: responsavelAuditoria.trim() || null,
        onProgress: (etapa, done, total) => setProgresso({ etapa, done, total }),
      });
```

- [ ] **Step 3: Adicionar o campo no formulário**

Só faz sentido quando está criando um relatório novo (é onde o valor é
usado — ver Task 9, Step 3). Adicionar depois do bloco do `Select` de
Destino (após a linha 1501, `</div>` que fecha o bloco de Destino, antes do
bloco `{progresso && (`):

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

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros — nenhum pendente das tasks anteriores.

- [ ] **Step 5: Verificação manual no preview**

Servidor já roda na porta 57010 (gerenciado pelo usuário — só ler/interagir,
nunca reiniciar). Abrir uma inspeção de campo finalizada com achados, clicar
em "Compor RTI", confirmar que:
- O campo "Responsável pela auditoria" aparece pré-preenchido com o nome do
  usuário logado, e é editável.
- Ao trocar `destino` para "Anexar a: ..." (relatório existente), o campo
  desaparece.
- Compor o RTI e checar via `execute_sql` que `rti_reports.responsavel_auditoria`
  e `rti_reports.coletores_campo` do relatório recém-criado batem com o
  valor digitado e com os coletores dos pontos, respectivamente.

- [ ] **Step 6: Commit**

```bash
git add src/routes/campo.inspecao.$id.tsx
git commit -m "feat(rti): campo explícito de responsável pela auditoria no diálogo de composição"
```

---

## Self-Review (já executado ao escrever este plano)

**Cobertura da spec:**
- P0-1 (coluna em `field_points`) → Task 1.
- P0-2 (captura automática na criação do ponto) → Tasks 6-7.
- P0-3 (tipos `FieldPoint`/`LocalPoint` ganham os campos) → Tasks 3-5 (nota:
  Dexie não precisa de bump de versão — campos não-indexados não fazem parte
  do schema versionado do Dexie, só os índices explícitos em
  `stores()`; isso é uma correção de mecanismo em relação à spec, que
  supunha incorretamente que seria necessário `db.version(3)`).
- P0-4 (`comporRti` para de copiar `engenheiro`) → Task 9.
- P0-5 (campo explícito no diálogo, pré-preenchido e editável) → Task 10.
- P0-6 (`coletores_campo` estruturado) → Tasks 2, 8, 9.
- P1 (exibir coletor por ponto nas telas de detalhe) — **não incluído neste
  plano**, é P1/nice-to-have na spec; abrir como fatia separada se
  priorizado.

**Placeholders:** nenhum "TBD"/"implementar depois" — todo passo tem
código completo.

**Consistência de tipos:** `collected_by_user_id`/`collected_by_name` usam
o mesmo nome nas Tasks 3, 4, 5, 7. `coletores_campo`/`coletoresCampoDe`
usam o mesmo nome nas Tasks 2, 4, 8, 9. `responsavelAuditoria` (camelCase,
parâmetro/state) vs. `responsavel_auditoria` (snake_case, coluna) — mesma
convenção já usada no resto do arquivo para outros campos.
