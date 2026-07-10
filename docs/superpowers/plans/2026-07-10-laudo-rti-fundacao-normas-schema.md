# Fundação do Laudo RTI — Catálogo de normas + Schema da NC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a fundação de dados da reformulação do laudo RTI — um catálogo de normas versionado (NR-10:2019, NR-10:2026, gravidade NR-28) em TypeScript puro, mais os campos novos da NC (`titulo`, `normas[]`, override de gravidade NR-28) e o `norma_versao` no report.

**Architecture:** O catálogo vive em `src/lib/normas/` como constantes TS read-only (versionam com o código, sem tabela/RLS). Um registry por versão expõe funções puras de derivação/validação. A NC ganha colunas aditivas no Postgres (migração via MCP do Supabase) e os tipos correspondentes à mão em `rti.ts` e `types.ts`. O modelo do PDF (`NcParaPdf`) passa a carregar os campos novos — mas **renderização é sub-spec 2, não entra aqui**.

**Tech Stack:** TypeScript, Vitest (`vitest run`), Supabase (Postgres, migração via MCP `apply_migration`), TanStack Start.

**Fonte da verdade:** `docs/superpowers/specs/2026-07-10-laudo-rti-fundacao-normas-schema-design.md`.

---

## Regras do projeto que este plano respeita

- **Migração via MCP do Supabase** (`apply_migration` para DDL) no projeto `fumwovtzyhxrjhkjzujs` **e** arquivo `.sql` versionado em `supabase/migrations/`. Mudanças são **aditivas** (nenhuma coluna removida/renomeada).
- **`src/integrations/supabase/types.ts` é editado à mão** (não regerar).
- **Push remoto só sob comando explícito.** Commits locais são livres — cada task termina com commit local. **Nenhum `git push`** neste plano.
- **Copyright:** textos de **NR** (públicas) podem ser versionados em `docs/normas/`. Textos de **NBR/IEC** (ABNT) **não** — só referência por número/item.
- **Gravidade NR-28 é sensível:** o dado nasce anotado aqui, mas **não há renderização em entregável nesta sub-spec** (a regra "nunca no PDF" é responsabilidade da sub-spec 2). Nada neste plano expõe NR-28 num PDF/tela.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `docs/normas/README.md` + textos | Material de referência público (NR-10:2019, NR-10:2026, NR-28 Anexo II) para transcrição/consulta |
| `src/lib/normas/types.ts` | Tipos puros (`NormaVersao`, `ClausulaNR10`, `InfracaoNR28`, `NormaRef`, `NbrRef`) |
| `src/lib/normas/nr10-clausulas-2019.ts` | Cláusulas NR-10 numeração 2019 |
| `src/lib/normas/nr10-clausulas-2026.ts` | Cláusulas NR-10 numeração 2026 (Portaria 737) |
| `src/lib/normas/nr28-gravidade.ts` | Anexo II NR-28 — linhas da NR-10 (gravidade + código), chaveado em 2019 |
| `src/lib/normas/nbr-refs.ts` | Refs de NBR citáveis (só nº/item — sem texto) |
| `src/lib/normas/index.ts` | Registry por versão + funções puras (vigência, validação, derivação de gravidade) |
| `src/lib/normas/__tests__/normas.test.ts` | Testes unitários das funções puras |
| `supabase/migrations/20260710120000_rti_normas_versao_nc.sql` | DDL aditivo (rti_ncs + rti_reports) |
| `src/integrations/supabase/types.ts` | Row/Insert/Update das duas tabelas (à mão) |
| `src/lib/rti.ts` | `RtiNc`/`RtiReport` com os campos novos |
| `src/lib/rti-relatorio.ts` | `NcParaPdf` carrega `titulo`, `normas`, `situacaoAtual` |
| `src/lib/rti-relatorio-server.tsx` | Mapeamento DB→`NcParaPdf` popula os campos novos |

---

## Task 1: Material de referência das normas em `docs/normas/`

Cumpre o pedido do fundador de ter as NRs originais numa pasta do projeto para consulta/transcrição. Só NRs públicas — nada de NBR/IEC.

**Files:**
- Create: `docs/normas/README.md`
- Create: `docs/normas/nr-10-2019.md` (texto público da NR-10 vigente)
- Create: `docs/normas/nr-10-2026.md` (Portaria MTE 737/2026)
- Create: `docs/normas/nr-28-anexo-ii.md` (Anexo II — linhas da NR-10)

- [ ] **Step 1: Criar o README da pasta**

Escreva `docs/normas/README.md` com exatamente este conteúdo:

```markdown
# Normas de referência (textos públicos)

Material-fonte para o catálogo em `src/lib/normas/`. **Apenas Normas Regulamentadoras
(NR) — de acesso público.**

| Arquivo | Norma | Vigência |
|---|---|---|
| `nr-10-2019.md` | NR-10 (Portaria 508/2016 consolidada) | vigente até 31/05/2027 |
| `nr-10-2026.md` | NR-10 nova redação (Portaria MTE 737, 29/05/2026) | a partir de 01/06/2027 |
| `nr-28-anexo-ii.md` | NR-28 Anexo II — linhas que classificam itens da NR-10 | vigente |

## Proibido versionar aqui

Textos de **NBR/IEC (ABNT)** são protegidos por direito autoral. Referenciar
essas normas **somente por número e item** (ex.: "NBR 5410, item 6.1.8.1"),
nunca reproduzir o texto.
```

- [ ] **Step 2: Salvar os textos das NRs**

Os PDFs-fonte já estão de posse do usuário (NR-10:2019, Portaria 737/2026, NR-28 consolidada). Converta cada um com `markitdown:convert_to_markdown` e salve o Markdown resultante em `docs/normas/nr-10-2019.md`, `docs/normas/nr-10-2026.md` e `docs/normas/nr-28-anexo-ii.md` respectivamente. Para `nr-28-anexo-ii.md`, recorte apenas a seção do **Anexo II** que lista itens da **NR-10** (código / gravidade / S-M).

Se algum PDF-fonte não estiver acessível no momento da execução, crie o arquivo `.md` com um cabeçalho de título e uma linha `> Texto a transcrever do PDF oficial da norma.` — o catálogo em código (Tasks 2–5) traz a seed verificada e não depende destes arquivos para compilar ou passar nos testes; eles são consulta humana.

- [ ] **Step 3: Commit**

```bash
git add docs/normas
git commit -m "docs(normas): pasta de referência das NR (10:2019, 10:2026, 28 anexo II)"
```

---

## Task 2: Tipos do catálogo + cláusulas NR-10:2019

**Files:**
- Create: `src/lib/normas/types.ts`
- Create: `src/lib/normas/nr10-clausulas-2019.ts`
- Create: `src/lib/normas/__tests__/normas.test.ts`

- [ ] **Step 1: Escrever o teste que falha (seed 2019 íntegra)**

Crie `src/lib/normas/__tests__/normas.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { CLAUSULAS_NR10_2019 } from "../nr10-clausulas-2019";

describe("CLAUSULAS_NR10_2019", () => {
  test("contém os itens que a NR-28 classifica", () => {
    const itens = new Set(CLAUSULAS_NR10_2019.map((c) => c.item));
    for (const req of ["10.2.1", "10.2.4", "10.4.1", "10.8.5", "10.8.6"]) {
      expect(itens.has(req)).toBe(true);
    }
  });

  test("todo item declara capítulo coerente com o próprio número", () => {
    for (const c of CLAUSULAS_NR10_2019) {
      expect(c.item.startsWith(c.capitulo)).toBe(true);
      expect(c.titulo.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/normas/__tests__/normas.test.ts`
Expected: FAIL — "Cannot find module '../nr10-clausulas-2019'".

- [ ] **Step 3: Escrever os tipos**

Crie `src/lib/normas/types.ts`:

```ts
// Catálogo de normas — tipos puros. Sem Supabase/React; versiona com o código.

export type NormaVersao = "nr10:2019" | "nr10:2026";

export interface ClausulaNR10 {
  item: string; // "10.2.4" ou "10.2.4.g"
  titulo: string; // rótulo curto do requisito
  capitulo: string; // "10.2"
  grupo?: string; // rótulo humano do bloco, ex.: "Prontuário"
}

export interface InfracaoNR28 {
  itens: string[]; // itens-base da NR-10 cobertos pela linha, ex.: ["10.2.4"]
  codigo: string; // código de infração do Anexo II (ex.: "210178-5"); "" se ainda não transcrito
  gravidade: 1 | 2 | 3 | 4;
  area: "S" | "M"; // Segurança | Medicina do Trabalho
}

export type NormaRefTipo = "nr10" | "nbr" | "outra";

export interface NormaRef {
  tipo: NormaRefTipo;
  ref: string; // nr10: item ("10.2.4.g"); nbr/outra: texto livre ("NBR 5410 6.1.8.1")
}

export interface NbrRef {
  norma: string; // "NBR 5410"
  item: string; // "6.1.8.1" ou "" para citar a norma inteira
  descricao: string; // rótulo humano do requisito citado
}
```

- [ ] **Step 4: Escrever a seed de cláusulas 2019**

Crie `src/lib/normas/nr10-clausulas-2019.ts`. Estas são as cláusulas de compliance da NR-10 na numeração vigente (2019). Inclui todos os itens que a NR-28 classifica (Task 4) e os capítulos citáveis. Pode ser estendida transcrevendo mais itens de `docs/normas/nr-10-2019.md` no mesmo formato — o prefixo em `validarNormaRef` já aceita alíneas (Task 6), então só os itens-base são necessários.

```ts
import type { ClausulaNR10 } from "./types";

// NR-10 numeração 2019 (Portaria 508/2016). Itens-base de compliance.
export const CLAUSULAS_NR10_2019: ClausulaNR10[] = [
  { item: "10.1", titulo: "Objetivo e campo de aplicação", capitulo: "10.1" },
  { item: "10.2", titulo: "Medidas de controle do risco elétrico", capitulo: "10.2", grupo: "Medidas de controle" },
  { item: "10.2.1", titulo: "Medidas de proteção coletiva", capitulo: "10.2", grupo: "Medidas de controle" },
  { item: "10.2.3", titulo: "Medidas de proteção individual", capitulo: "10.2", grupo: "Medidas de controle" },
  { item: "10.2.4", titulo: "Prontuário de Instalações Elétricas", capitulo: "10.2", grupo: "Prontuário" },
  { item: "10.2.5", titulo: "Documentação das instalações elétricas", capitulo: "10.2", grupo: "Prontuário" },
  { item: "10.2.8", titulo: "Aterramento das instalações elétricas", capitulo: "10.2", grupo: "Medidas de controle" },
  { item: "10.3", titulo: "Segurança em projetos", capitulo: "10.3" },
  { item: "10.4", titulo: "Segurança na construção, montagem, operação e manutenção", capitulo: "10.4" },
  { item: "10.4.1", titulo: "Prontuário e memorial descritivo das instalações", capitulo: "10.4" },
  { item: "10.5", titulo: "Segurança em instalações elétricas desergizadas", capitulo: "10.5" },
  { item: "10.6", titulo: "Segurança em instalações elétricas energizadas", capitulo: "10.6" },
  { item: "10.7", titulo: "Trabalho envolvendo alta tensão (AT)", capitulo: "10.7" },
  { item: "10.8", titulo: "Habilitação, qualificação, capacitação e autorização", capitulo: "10.8", grupo: "Pessoas" },
  { item: "10.8.1", titulo: "Trabalhador qualificado", capitulo: "10.8", grupo: "Pessoas" },
  { item: "10.8.2", titulo: "Profissional legalmente habilitado", capitulo: "10.8", grupo: "Pessoas" },
  { item: "10.8.3", titulo: "Trabalhador capacitado", capitulo: "10.8", grupo: "Pessoas" },
  { item: "10.8.4", titulo: "Trabalhador autorizado", capitulo: "10.8", grupo: "Pessoas" },
  { item: "10.8.5", titulo: "Treinamento — curso básico/complementar", capitulo: "10.8", grupo: "Pessoas" },
  { item: "10.8.6", titulo: "Reciclagem do treinamento", capitulo: "10.8", grupo: "Pessoas" },
  { item: "10.9", titulo: "Proteção contra incêndio e explosão", capitulo: "10.9" },
  { item: "10.10", titulo: "Sinalização de segurança", capitulo: "10.10" },
  { item: "10.11", titulo: "Procedimentos de trabalho", capitulo: "10.11" },
  { item: "10.12", titulo: "Situação de emergência", capitulo: "10.12" },
  { item: "10.13", titulo: "Responsabilidades", capitulo: "10.13" },
  { item: "10.14", titulo: "Disposições finais", capitulo: "10.14" },
];
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/normas/__tests__/normas.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add src/lib/normas/types.ts src/lib/normas/nr10-clausulas-2019.ts src/lib/normas/__tests__/normas.test.ts
git commit -m "feat(normas): tipos do catálogo + cláusulas NR-10:2019"
```

---

## Task 3: Cláusulas NR-10:2026 (Portaria 737)

**Files:**
- Create: `src/lib/normas/nr10-clausulas-2026.ts`
- Modify: `src/lib/normas/__tests__/normas.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicione ao fim de `src/lib/normas/__tests__/normas.test.ts`:

```ts
import { CLAUSULAS_NR10_2026 } from "../nr10-clausulas-2026";

describe("CLAUSULAS_NR10_2026", () => {
  test("reflete a renumeração da Portaria 737", () => {
    const itens = new Set(CLAUSULAS_NR10_2026.map((c) => c.item));
    // Prontuário migra de 10.2.4 para 10.15; habilitação de 10.8 para 10.10.
    expect(itens.has("10.15")).toBe(true);
    expect(itens.has("10.10")).toBe(true);
    // Capítulos novos.
    expect(itens.has("10.3")).toBe(true); // GRO
    expect(itens.has("10.16")).toBe(true); // GIR
  });

  test("todo item declara capítulo coerente e título não vazio", () => {
    for (const c of CLAUSULAS_NR10_2026) {
      expect(c.item.startsWith(c.capitulo)).toBe(true);
      expect(c.titulo.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/normas/__tests__/normas.test.ts`
Expected: FAIL — "Cannot find module '../nr10-clausulas-2026'".

- [ ] **Step 3: Escrever a seed de cláusulas 2026**

Crie `src/lib/normas/nr10-clausulas-2026.ts`. Capítulos da nova redação (Portaria MTE 737/2026). Estender transcrevendo de `docs/normas/nr-10-2026.md`.

```ts
import type { ClausulaNR10 } from "./types";

// NR-10 nova redação (Portaria MTE 737, 29/05/2026; vigência 01/06/2027).
// Numeração completamente renumerada em relação a 2019.
export const CLAUSULAS_NR10_2026: ClausulaNR10[] = [
  { item: "10.1", titulo: "Objetivo", capitulo: "10.1" },
  { item: "10.2", titulo: "Campo de aplicação", capitulo: "10.2" },
  { item: "10.3", titulo: "Gerenciamento de Riscos Ocupacionais (GRO)", capitulo: "10.3", grupo: "GRO" },
  { item: "10.4", titulo: "Medidas de proteção coletiva", capitulo: "10.4", grupo: "Medidas de controle" },
  { item: "10.5", titulo: "Medidas de proteção individual", capitulo: "10.5", grupo: "Medidas de controle" },
  { item: "10.6", titulo: "Segurança em instalações elétricas", capitulo: "10.6" },
  { item: "10.7", titulo: "Segurança em instalações desenergizadas", capitulo: "10.7" },
  { item: "10.8", titulo: "Segurança em instalações energizadas", capitulo: "10.8" },
  { item: "10.9", titulo: "Trabalho envolvendo alta tensão", capitulo: "10.9" },
  { item: "10.10", titulo: "Habilitação, qualificação, capacitação e autorização", capitulo: "10.10", grupo: "Pessoas" },
  { item: "10.11", titulo: "Proteção contra incêndio e explosão", capitulo: "10.11" },
  { item: "10.12", titulo: "Sinalização de segurança", capitulo: "10.12" },
  { item: "10.13", titulo: "Procedimentos de trabalho", capitulo: "10.13" },
  { item: "10.14", titulo: "Situação de emergência", capitulo: "10.14" },
  { item: "10.15", titulo: "Documentação e prontuário das instalações elétricas", capitulo: "10.15", grupo: "Prontuário" },
  { item: "10.16", titulo: "Gestão de Integridade e Riscos (GIR)", capitulo: "10.16", grupo: "GIR" },
];
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/normas/__tests__/normas.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/normas/nr10-clausulas-2026.ts src/lib/normas/__tests__/normas.test.ts
git commit -m "feat(normas): cláusulas NR-10:2026 (renumeração Portaria 737)"
```

---

## Task 4: Mapa de gravidade NR-28 (Anexo II)

**Files:**
- Create: `src/lib/normas/nr28-gravidade.ts`
- Modify: `src/lib/normas/__tests__/normas.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicione ao fim de `src/lib/normas/__tests__/normas.test.ts`:

```ts
import { NR28_GRAVIDADE } from "../nr28-gravidade";

describe("NR28_GRAVIDADE", () => {
  test("classifica os itens verificados nesta sessão", () => {
    const porItem = (base: string) =>
      NR28_GRAVIDADE.find((l) => l.itens.includes(base));
    expect(porItem("10.2.1")?.gravidade).toBe(4);
    expect(porItem("10.2.4")?.gravidade).toBe(2);
    expect(porItem("10.4.1")?.gravidade).toBe(4);
    expect(porItem("10.8.5")?.gravidade).toBe(2);
  });

  test("gravidade sempre entre 1 e 4 e área S ou M", () => {
    for (const l of NR28_GRAVIDADE) {
      expect(l.gravidade).toBeGreaterThanOrEqual(1);
      expect(l.gravidade).toBeLessThanOrEqual(4);
      expect(["S", "M"]).toContain(l.area);
      expect(l.itens.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/normas/__tests__/normas.test.ts`
Expected: FAIL — "Cannot find module '../nr28-gravidade'".

- [ ] **Step 3: Escrever o mapa de gravidade**

Crie `src/lib/normas/nr28-gravidade.ts`. As linhas abaixo são a seed verificada nesta sessão. **Transcreva as linhas restantes** da tabela em `docs/normas/nr-28-anexo-ii.md` no mesmo formato: cada linha tem `itens` (itens-base da NR-10), `codigo` (coluna "código" do Anexo II — deixe `""` se não localizar), `gravidade` (coluna 1..4) e `area` ("S" segurança / "M" medicina). Nenhuma lógica depende de `codigo`; ele é metadado de exibição para a sub-spec 3.

```ts
import type { InfracaoNR28 } from "./types";

// NR-28 Anexo II — linhas que classificam itens da NR-10.
// CHAVEADO NA NUMERAÇÃO NR-10:2019 (o governo ainda não re-chaveou p/ 2026).
// A gravidade da NC deriva do MÁXIMO das linhas casadas (ver gravidadeNR28).
export const NR28_GRAVIDADE: InfracaoNR28[] = [
  { itens: ["10.2.1"], codigo: "", gravidade: 4, area: "S" },
  { itens: ["10.2.4"], codigo: "210178-5", gravidade: 2, area: "S" },
  { itens: ["10.4.1"], codigo: "", gravidade: 4, area: "S" },
  { itens: ["10.8.5", "10.8.6"], codigo: "", gravidade: 2, area: "S" },
];
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/normas/__tests__/normas.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/normas/nr28-gravidade.ts src/lib/normas/__tests__/normas.test.ts
git commit -m "feat(normas): mapa de gravidade NR-28 (Anexo II, chaveado em 2019)"
```

---

## Task 5: Refs de NBR citáveis

**Files:**
- Create: `src/lib/normas/nbr-refs.ts`
- Modify: `src/lib/normas/__tests__/normas.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicione ao fim de `src/lib/normas/__tests__/normas.test.ts`:

```ts
import { NBR_REFS } from "../nbr-refs";

describe("NBR_REFS", () => {
  test("lista NBRs citáveis sem reproduzir texto da norma", () => {
    expect(NBR_REFS.length).toBeGreaterThan(0);
    for (const r of NBR_REFS) {
      expect(r.norma.startsWith("NBR")).toBe(true);
      expect(r.descricao.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/normas/__tests__/normas.test.ts`
Expected: FAIL — "Cannot find module '../nbr-refs'".

- [ ] **Step 3: Escrever as refs de NBR**

Crie `src/lib/normas/nbr-refs.ts`. **Só número/item + rótulo humano — nunca o texto da NBR (copyright ABNT).**

```ts
import type { NbrRef } from "./types";

// NBRs frequentemente citadas em RTI de instalações elétricas.
// APENAS número/item + rótulo — o texto da norma é protegido (ABNT).
export const NBR_REFS: NbrRef[] = [
  { norma: "NBR 5410", item: "", descricao: "Instalações elétricas de baixa tensão" },
  { norma: "NBR 5410", item: "6.1.8.1", descricao: "Proteção contra choques — seccionamento" },
  { norma: "NBR 14039", item: "", descricao: "Instalações elétricas de média tensão (1,0 kV a 36,2 kV)" },
  { norma: "NBR 5419", item: "", descricao: "Proteção contra descargas atmosféricas (SPDA)" },
  { norma: "NBR IEC 60947", item: "", descricao: "Dispositivos de manobra e comando de baixa tensão" },
];
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/normas/__tests__/normas.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/normas/nbr-refs.ts src/lib/normas/__tests__/normas.test.ts
git commit -m "feat(normas): refs de NBR citáveis (só nº/item — copyright ABNT)"
```

---

## Task 6: Registry por versão + funções puras

**Files:**
- Create: `src/lib/normas/index.ts`
- Modify: `src/lib/normas/__tests__/normas.test.ts`

- [ ] **Step 1: Escrever os testes das funções puras**

Adicione ao fim de `src/lib/normas/__tests__/normas.test.ts`:

```ts
import {
  normaVersaoVigente,
  clausulasNR10,
  itemCasaBase,
  validarNormaRef,
  gravidadeNR28,
  gravidadeEfetiva,
} from "../index";

describe("normaVersaoVigente", () => {
  test("antes de 01/06/2027 → nr10:2019", () => {
    expect(normaVersaoVigente(new Date("2027-05-31T23:59:59Z"))).toBe("nr10:2019");
  });
  test("em/depois de 01/06/2027 → nr10:2026", () => {
    expect(normaVersaoVigente(new Date("2027-06-01T00:00:00Z"))).toBe("nr10:2026");
    expect(normaVersaoVigente(new Date("2028-01-10T12:00:00Z"))).toBe("nr10:2026");
  });
});

describe("itemCasaBase", () => {
  test("igual ou subitem casa; vizinho numérico não", () => {
    expect(itemCasaBase("10.2.4", "10.2.4")).toBe(true);
    expect(itemCasaBase("10.2.4.g", "10.2.4")).toBe(true);
    expect(itemCasaBase("10.2.40", "10.2.4")).toBe(false);
    expect(itemCasaBase("10.2.5", "10.2.4")).toBe(false);
  });
});

describe("clausulasNR10", () => {
  test("devolve o catálogo da versão pedida", () => {
    expect(clausulasNR10("nr10:2019").some((c) => c.item === "10.2.4")).toBe(true);
    expect(clausulasNR10("nr10:2026").some((c) => c.item === "10.15")).toBe(true);
  });
});

describe("validarNormaRef", () => {
  test("item NR-10 válido/ inválido por versão", () => {
    expect(validarNormaRef({ tipo: "nr10", ref: "10.2.4.g" }, "nr10:2019")).toBe(true);
    expect(validarNormaRef({ tipo: "nr10", ref: "10.15" }, "nr10:2019")).toBe(false);
    expect(validarNormaRef({ tipo: "nr10", ref: "10.15" }, "nr10:2026")).toBe(true);
  });
  test("nbr/outra: texto não-vazio é válido", () => {
    expect(validarNormaRef({ tipo: "nbr", ref: "NBR 5410 6.1.8.1" }, "nr10:2019")).toBe(true);
    expect(validarNormaRef({ tipo: "outra", ref: "" }, "nr10:2019")).toBe(false);
  });
});

describe("gravidadeNR28", () => {
  test("máximo entre itens citados", () => {
    const r = gravidadeNR28(
      [
        { tipo: "nr10", ref: "10.2.4.g" }, // gravidade 2
        { tipo: "nr10", ref: "10.4.1" }, // gravidade 4
      ],
      "nr10:2019",
    );
    expect(r?.gravidade).toBe(4);
    expect(r?.codigos).toContain("210178-5");
  });
  test("item desconhecido é ignorado", () => {
    expect(gravidadeNR28([{ tipo: "nr10", ref: "10.99" }], "nr10:2019")).toBeNull();
  });
  test("NBR não contribui", () => {
    expect(gravidadeNR28([{ tipo: "nbr", ref: "NBR 5410" }], "nr10:2019")).toBeNull();
  });
  test("versão 2026 → indisponível (null)", () => {
    expect(gravidadeNR28([{ tipo: "nr10", ref: "10.15" }], "nr10:2026")).toBeNull();
  });
});

describe("gravidadeEfetiva", () => {
  test("override tem precedência sobre a derivada", () => {
    const nc = { normas: [{ tipo: "nr10" as const, ref: "10.2.4" }], gravidade_nr28_override: 3 };
    expect(gravidadeEfetiva(nc, "nr10:2019")).toBe(3);
  });
  test("sem override cai na derivada", () => {
    const nc = { normas: [{ tipo: "nr10" as const, ref: "10.4.1" }], gravidade_nr28_override: null };
    expect(gravidadeEfetiva(nc, "nr10:2019")).toBe(4);
  });
  test("sem override e sem ref NR-10 → null", () => {
    const nc = { normas: [{ tipo: "nbr" as const, ref: "NBR 5410" }], gravidade_nr28_override: null };
    expect(gravidadeEfetiva(nc, "nr10:2019")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/normas/__tests__/normas.test.ts`
Expected: FAIL — "Cannot find module '../index'".

- [ ] **Step 3: Escrever o registry e as funções puras**

Crie `src/lib/normas/index.ts`:

```ts
import { CLAUSULAS_NR10_2019 } from "./nr10-clausulas-2019";
import { CLAUSULAS_NR10_2026 } from "./nr10-clausulas-2026";
import { NR28_GRAVIDADE } from "./nr28-gravidade";
import type { ClausulaNR10, InfracaoNR28, NormaRef, NormaVersao } from "./types";

export * from "./types";
export { CLAUSULAS_NR10_2019 } from "./nr10-clausulas-2019";
export { CLAUSULAS_NR10_2026 } from "./nr10-clausulas-2026";
export { NR28_GRAVIDADE } from "./nr28-gravidade";
export { NBR_REFS } from "./nbr-refs";

// Fronteira de vigência da nova NR-10 (Portaria 737/2026): 01/06/2027.
export const VIGENCIA_NR10_2026 = new Date("2027-06-01T00:00:00Z");

const REGISTRY: Record<NormaVersao, ClausulaNR10[]> = {
  "nr10:2019": CLAUSULAS_NR10_2019,
  "nr10:2026": CLAUSULAS_NR10_2026,
};

// O Anexo II da NR-28 só existe chaveado na numeração 2019. A versão 2026 fica
// sem mapa (gravidade indisponível) até o governo re-publicar a tabela.
const NR28_POR_VERSAO: Partial<Record<NormaVersao, InfracaoNR28[]>> = {
  "nr10:2019": NR28_GRAVIDADE,
};

/** Versão da NR-10 vigente numa data (fronteira 01/06/2027). */
export function normaVersaoVigente(data: Date): NormaVersao {
  return data.getTime() >= VIGENCIA_NR10_2026.getTime() ? "nr10:2026" : "nr10:2019";
}

/** Cláusulas da versão indicada. */
export function clausulasNR10(versao: NormaVersao): ClausulaNR10[] {
  return REGISTRY[versao];
}

/**
 * `item` casa `base` se for igual ou for subitem/alínea dele.
 * "10.2.4.g" casa "10.2.4"; "10.2.40" NÃO casa "10.2.4" (guarda pelo ponto).
 */
export function itemCasaBase(item: string, base: string): boolean {
  return item === base || item.startsWith(base + ".");
}

/** Referência válida? NR-10: casa um item do catálogo da versão. NBR/outra: texto não-vazio. */
export function validarNormaRef(ref: NormaRef, versao: NormaVersao): boolean {
  if (ref.tipo !== "nr10") return ref.ref.trim().length > 0;
  return clausulasNR10(versao).some((c) => itemCasaBase(ref.ref, c.item));
}

/**
 * Gravidade NR-28 derivada dos itens NR-10 citados: o MÁXIMO das linhas casadas
 * rege. `null` se a versão não tem mapa (2026) ou nenhuma ref NR-10 casa.
 */
export function gravidadeNR28(
  normas: NormaRef[],
  versao: NormaVersao,
): { gravidade: 1 | 2 | 3 | 4; codigos: string[]; area: "S" | "M" } | null {
  const mapa = NR28_POR_VERSAO[versao];
  if (!mapa) return null;
  const itensNr10 = normas.filter((n) => n.tipo === "nr10").map((n) => n.ref);
  const casadas = mapa.filter((linha) =>
    itensNr10.some((it) => linha.itens.some((base) => itemCasaBase(it, base))),
  );
  if (casadas.length === 0) return null;
  const gravidade = Math.max(...casadas.map((l) => l.gravidade)) as 1 | 2 | 3 | 4;
  const codigos = [...new Set(casadas.map((l) => l.codigo).filter((c) => c.length > 0))];
  // Área da(s) linha(s) de maior gravidade; desempate por "S".
  const daMaior = casadas.filter((l) => l.gravidade === gravidade);
  const area: "S" | "M" = daMaior.some((l) => l.area === "S") ? "S" : "M";
  return { gravidade, codigos, area };
}

/** Gravidade efetiva = override manual ?? derivada. `null` = indisponível. */
export function gravidadeEfetiva(
  nc: { normas: NormaRef[]; gravidade_nr28_override: number | null },
  versao: NormaVersao,
): number | null {
  if (nc.gravidade_nr28_override != null) return nc.gravidade_nr28_override;
  return gravidadeNR28(nc.normas, versao)?.gravidade ?? null;
}
```

- [ ] **Step 4: Rodar e ver passar (toda a suíte de normas)**

Run: `npx vitest run src/lib/normas/__tests__/normas.test.ts`
Expected: PASS — todos os describes (vigência, itemCasaBase, clausulasNR10, validarNormaRef, gravidadeNR28, gravidadeEfetiva + seeds).

- [ ] **Step 5: Commit**

```bash
git add src/lib/normas/index.ts src/lib/normas/__tests__/normas.test.ts
git commit -m "feat(normas): registry por versão + derivação/validação puras"
```

---

## Task 7: Migração de banco + tipos gerados à mão

Colunas **aditivas** — nada quebra o schema atual. `rti_ncs` ganha `titulo`, `normas`, `gravidade_nr28_override`; `rti_reports` ganha `norma_versao`.

**Files:**
- Create: `supabase/migrations/20260710120000_rti_normas_versao_nc.sql`
- Modify: `src/integrations/supabase/types.ts` (blocos `rti_ncs` ~2227 e `rti_reports` ~2410)

- [ ] **Step 1: Escrever o arquivo de migração versionado**

Crie `supabase/migrations/20260710120000_rti_normas_versao_nc.sql`:

```sql
-- Fundação do laudo RTI: campos de norma na NC + versão de norma no report.
-- Aditivo; linhas existentes recebem defaults.

alter table rti_ncs
  add column titulo text,
  add column normas jsonb not null default '[]'::jsonb,
  add column gravidade_nr28_override smallint
    check (gravidade_nr28_override between 1 and 4);

alter table rti_reports
  add column norma_versao text not null default 'nr10:2019';
```

- [ ] **Step 2: Aplicar a migração via MCP do Supabase**

Aplique o mesmo DDL no projeto `fumwovtzyhxrjhkjzujs` com a ferramenta MCP `apply_migration`, nome `rti_normas_versao_nc`, com o corpo SQL do Step 1 (sem o comentário inicial, se preferir). Esta é a convenção do projeto para DDL. É aditivo e reversível conceitualmente (colunas novas), então seguro.

- [ ] **Step 3: Verificar que as colunas existem**

Rode via MCP `execute_sql` no projeto:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name in ('rti_ncs', 'rti_reports')
  and column_name in ('titulo', 'normas', 'gravidade_nr28_override', 'norma_versao')
order by table_name, column_name;
```

Expected: 4 linhas — `rti_ncs.gravidade_nr28_override` (smallint), `rti_ncs.normas` (jsonb, default `'[]'::jsonb`), `rti_ncs.titulo` (text), `rti_reports.norma_versao` (text, default `'nr10:2019'::text`).

- [ ] **Step 4: Editar `types.ts` à mão — bloco `rti_ncs`**

No bloco `rti_ncs` (Row, Insert e Update — começa em ~linha 2227), adicione as três chaves em ordem alfabética dentro de cada objeto. Em **Row**, após `finding_id: string | null` e antes de `id: string`, e para os demais na posição alfabética correta:

- `gravidade_nr28_override: number | null` (Row) / `gravidade_nr28_override?: number | null` (Insert, Update)
- `normas: Json` (Row) / `normas?: Json` (Insert, Update)
- `titulo: string | null` (Row) / `titulo?: string | null` (Insert, Update)

Exemplo do trecho **Row** já com as chaves (mantendo a ordem alfabética existente):

```ts
          descricao: string
          entregue_em: string | null
          entregue_por_org: string | null
          finding_id: string | null
          gravidade_nr28_override: number | null
          id: string
          normas: Json
          numero: number
          org_id: string
          os_numero: string | null
          prazo: string | null
          prioridade: number
          progresso: number
          recomendacao: string | null
          report_id: string
          responsavel: string | null
          situacao_atual: string | null
          status: string
          tipo_execucao: string
          titulo: string | null
          updated_at: string
```

Replique as três chaves nos objetos **Insert** e **Update** do mesmo bloco, com `?:` (opcionais). `Json` já é o tipo exportado no topo de `types.ts` — não precisa importar nada.

- [ ] **Step 5: Editar `types.ts` à mão — bloco `rti_reports`**

No bloco `rti_reports` (~linha 2410), adicione em ordem alfabética:

- `norma_versao: string` (Row) / `norma_versao?: string` (Insert, Update)

- [ ] **Step 6: Verificar tipagem (sem novos erros)**

Run: `npx tsc --noEmit`
Expected: nenhum **novo** erro relativo a `rti_ncs`/`rti_reports`/`normas`. (Erros pré-existentes do projeto são conhecidos — ignore-os; compare com o baseline antes desta task se necessário.)

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260710120000_rti_normas_versao_nc.sql src/integrations/supabase/types.ts
git commit -m "feat(rti): migração — normas/titulo/override na NC + norma_versao no report"
```

---

## Task 8: Campos novos nos tipos de domínio + modelo do PDF

Estende os tipos TS de domínio e faz o `NcParaPdf` **carregar** `titulo`, `normas` e `situacaoAtual`. **Sem renderização** — o `RtiPdfDocument.tsx` não muda (isso é sub-spec 2). Objetivo: o dado flui do banco até o modelo, pronto para a sub-spec 2 consumir.

**Files:**
- Modify: `src/lib/rti.ts` (`RtiNc` ~107, `RtiReport` ~68)
- Modify: `src/lib/rti-relatorio.ts` (`NcParaPdf` ~62)
- Modify: `src/lib/rti-relatorio-server.tsx` (mapeamento ~171)
- Modify: `src/lib/__tests__/rti-relatorio.test.ts` (helper `nc` ~12)

- [ ] **Step 1: Escrever o teste que falha (modelo carrega os campos novos)**

Adicione ao fim de `src/lib/__tests__/rti-relatorio.test.ts`:

```ts
import { mergeNcOverrides as _merge } from "../rti-relatorio";

describe("NcParaPdf carrega titulo/normas/situacaoAtual", () => {
  test("mergeNcOverrides preserva os campos novos", () => {
    const entrada = nc({
      titulo: "Painel sem identificação de circuitos",
      normas: [{ tipo: "nr10", ref: "10.2.4.g" }],
      situacaoAtual: "Aguardando peça",
    });
    const [saida] = _merge([entrada], {});
    expect(saida.titulo).toBe("Painel sem identificação de circuitos");
    expect(saida.normas).toEqual([{ tipo: "nr10", ref: "10.2.4.g" }]);
    expect(saida.situacaoAtual).toBe("Aguardando peça");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: FAIL — o objeto `nc()` não aceita `titulo`/`normas`/`situacaoAtual` (erro de tipo), ou os campos vêm `undefined`.

- [ ] **Step 3: Estender `NcParaPdf` em `rti-relatorio.ts`**

No topo de `src/lib/rti-relatorio.ts`, adicione o import do tipo:

```ts
import type { NormaRef } from "./normas/types";
```

E dentro de `interface NcParaPdf` (após `fotos: PdfFoto[];`), adicione:

```ts
  titulo: string | null; // título curto do achado (DIAGNERG Campo 3); null = legado
  normas: NormaRef[]; // referências normativas da NC
  situacaoAtual: string | null; // andamento textual (hoje no banco, agora exposto)
```

- [ ] **Step 4: Atualizar o helper `nc` do teste**

Em `src/lib/__tests__/rti-relatorio.test.ts`, no objeto base do helper `nc` (após `fotos: [],`), adicione os defaults para que os testes existentes continuem construindo `NcParaPdf` completos:

```ts
  titulo: null,
  normas: [],
  situacaoAtual: null,
```

- [ ] **Step 5: Popular os campos no mapeamento do servidor**

Em `src/lib/rti-relatorio-server.tsx`, no `.map` que constrói `ncsPdf: NcParaPdf[]` (~linha 171), adicione as três chaves dentro do objeto (após `custoPlanejado: Number(nc.custo_planejado ?? 0),` e antes de `fotos:`):

```ts
      titulo: (nc.titulo as string) ?? null,
      normas: Array.isArray(nc.normas) ? (nc.normas as import("./normas/types").NormaRef[]) : [],
      situacaoAtual: (nc.situacao_atual as string) ?? null,
```

O `select("*")` em `rti_ncs` (~linha 131) já traz `titulo`, `normas` e `situacao_atual` após a migração — nenhuma mudança na query é necessária.

- [ ] **Step 6: Estender os tipos de domínio em `rti.ts`**

No topo de `src/lib/rti.ts`, adicione:

```ts
import type { NormaRef } from "./normas/types";
```

Em `type RtiNc` (após `situacao_atual: string | null;`), adicione:

```ts
  titulo: string | null;
  normas: NormaRef[];
  gravidade_nr28_override: number | null;
```

Em `type RtiReport` (após `periodo_fim: string | null;`), adicione:

```ts
  norma_versao: string;
```

- [ ] **Step 7: Rodar os testes do modelo e ver passar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: PASS — inclusive o novo describe e todos os pré-existentes.

- [ ] **Step 8: Rodar a suíte completa + tsc**

Run: `npx vitest run`
Expected: PASS em toda a suíte (normas + rti-relatorio + demais).

Run: `npx tsc --noEmit`
Expected: nenhum **novo** erro (erros pré-existentes conhecidos permanecem).

- [ ] **Step 9: Commit**

```bash
git add src/lib/rti.ts src/lib/rti-relatorio.ts src/lib/rti-relatorio-server.tsx src/lib/__tests__/rti-relatorio.test.ts
git commit -m "feat(rti): NC/report carregam normas/titulo/override + situacaoAtual no modelo do PDF"
```

---

## Notas de escopo (o que este plano NÃO faz)

- **Não renderiza** `titulo`/`normas`/gravidade em nenhum PDF ou tela — sub-spec 2 (PDF/volumes) e sub-spec 3 (camada de gestão).
- **Não cria UI** para editar `normas`/`titulo`/override na NC — a captura desses dados no wizard/edição da NC é das sub-specs seguintes; aqui os campos aceitam default (`normas=[]`, `titulo=null`).
- **Não expõe gravidade NR-28** em superfície nenhuma — a regra "nunca no entregável" e a tela de exposição com permissão por usuário são sub-specs 2/3.
- **Não versiona texto de NBR/IEC** — só número/item.

---

## Self-review (rodado pelo autor do plano)

**Cobertura da spec:**
- Catálogo versionado (NR-10:2019/2026, NR-28, NBR) → Tasks 2–5. ✔
- Registry + funções puras (`normaVersaoVigente`, `clausulasNR10`, `validarNormaRef`, `gravidadeNR28`, `gravidadeEfetiva`, lookup por prefixo) → Task 6. ✔
- Regra "gravidade 2026 = null" → Task 6 (`NR28_POR_VERSAO` sem entrada 2026) + teste. ✔
- Máximo entre itens, NBR não contribui, item desconhecido ignorado → Task 6 testes. ✔
- Campos novos na NC (`titulo`, `normas`, `gravidade_nr28_override`) + `norma_versao` no report → Tasks 7–8. ✔
- Expor `situacao_atual` no `NcParaPdf` → Task 8. ✔
- Migração aditiva via MCP + `.sql` versionado + `types.ts` à mão → Task 7. ✔
- NRs públicas em pasta do projeto (pedido do fundador) → Task 1. ✔
- Registro auditável de decisões → já na spec (seção Decisões); não se repete no plano.

**Placeholders:** nenhum passo de lógica sem código. As arrays de catálogo trazem seed verificada e real; a expansão exaustiva (transcrição de itens/linhas adicionais) aponta para `docs/normas/` como fonte, e **nenhuma função ou teste depende dessa expansão** — a lógica é 100% coberta pela seed. `codigo` da NR-28 é metadado sem uso lógico (só exibição na sub-spec 3).

**Consistência de tipos:** `NormaRef`, `NormaVersao`, `ClausulaNR10`, `InfracaoNR28`, `NbrRef` definidos em Task 2 e usados idênticos em Tasks 4–8. Funções (`itemCasaBase`, `gravidadeNR28`, `gravidadeEfetiva`) têm a mesma assinatura no teste (Task 6 Step 1) e na implementação (Step 3). `NcParaPdf.normas: NormaRef[]` casa o import em `rti-relatorio.ts` e o cast no servidor.
