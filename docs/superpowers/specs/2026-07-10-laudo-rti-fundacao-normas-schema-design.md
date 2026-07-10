# Laudo RTI — Sub-spec 1: Catálogo de normas + Schema da NC (Design)

**Data:** 2026-07-10
**Status:** Aprovado (brainstorming) — pronto para plano de implementação
**Autor:** Gustavo + Claude

---

## Contexto

A reformulação do laudo RTI nasceu da análise de **dois modelos reais** de relatório entregues à mesma usina (Água Emendada) por empresas diferentes:

- **DIAGNERG (2025, 592 pág):** catálogo de **NCs de campo por setor**, com fotos. Forte no operacional. Cada NC tem 8 campos nomeados (área, número, **título**, descrição, **norma(s)**, prioridade, recomendação, evidência).
- **DPST (2017, 31 pág):** **auditoria do sistema de gestão por requisito da NR-10**, em tabelas. Classifica cada achado com **dois eixos**: Infração NR-28 (I=1..4) × Prioridade. Enxuto porque não tem fotos.

Tese de produto (decidida): nosso produto entrega **as duas camadas num sistema só** — é o diferencial (o cliente hoje precisa contratar duas empresas). Mas a entrega será por **volumes derivados do mesmo dado** (Volume I Gestão / Volume II Campo / Compilado), não um PDF monolítico.

Esta sub-spec é a **fundação** dessa reformulação: o **dado** (catálogo de normas) e a **classificação** (schema da NC enriquecido). Não trata de PDF nem de telas — essas são sub-specs posteriores.

### Descobertas que moldam o design

1. **A NR-28 dá o eixo de gravidade de forma oficial.** O Anexo II da NR-28 é uma tabela `itens da NR | código | gravidade (1..4) | S/M` que classifica **cada item da NR-10**. A gravidade não é opinião — é derivável dos itens NR-10 que a NC viola. Ex.: `10.2.1→4`, `10.2.4 (a–g)→2`, `10.4.1→4`, `10.8.5/10.8.6→2`.

2. **A NR-10 será renumerada por inteiro.** A Portaria MTE nº 737, de 29/05/2026 (DOU 01/06/2026), aprova uma **nova redação completa** da NR-10, com **vigência a partir de 01/06/2027** (1 ano após publicação; um item, 10.6.4.e, +1 ano para instalações existentes). Revoga as Portarias 598/2004 e 508/2016. A numeração muda toda: o prontuário/RTI sai de **10.2.4** para **10.15**; habilitação de **10.8** para **10.10**; surgem capítulos novos (10.3 GRO, 10.16 GIR, Anexo IV arco elétrico, estudo de energia incidente).

3. **Consequência: um produto de compliance precisa ser versionado por norma.** A referência normativa de um laudo é **congelada na emissão** (documento legal). Um RTI de 2025 cita "10.2.4.g" para sempre; um de 2028 cita a numeração nova. Não se "migra" — carregam-se as duas versões e cada laudo se amarra à versão vigente na data.

4. **A gravidade NR-28 é sensível e não pode ir no entregável.** Um RTI que já traz o código de infração e a gravidade NR-28 ao lado de cada NC é um **auto de infração pré-preenchido** — incrimina o cliente na frente do fiscal. O dado existe e é útil (gestão de exposição), mas fica **atrás de login**, nunca no documento portátil. Regra nasce anotada no dado; a superfície (PDF/tela) é responsabilidade das sub-specs seguintes.

---

## Escopo

### Entra nesta sub-spec

- Catálogo de normas versionado (dado puro, TS): NR-10:2019, NR-10:2026, gravidade NR-28 (vigente), refs de NBR.
- Campos novos na NC: `titulo`, `normas[]`, override de gravidade NR-28; expor `situacao_atual` no modelo do PDF.
- `norma_versao` no report + binding por data de vigência.
- Lógica pura de derivação/validação + testes.
- Migração de banco + `types.ts` à mão.

### Fica para sub-specs seguintes (explícito, para não vazar escopo)

- **Sub-spec 2 (PDF/volumes):** renderização, volumes derivados, fix da foto (`cover`→`contain`), sumário navegável, front matter técnico, e a **regra "gravidade NR-28 nunca no entregável"**.
- **Sub-spec 3 (camada de gestão):** "Avaliação por requisito NR-10" (Volume I) a partir do `conformidade.ts`; tela **"Exposição regulatória (NR-28)"** com **permissão por usuário** controlada pelo consultor na provisão de acesso (default desligada).
- **Sub-spec 4 (branding):** UI de configuração de white-label da org (o motor de PDF já suporta `OrgBranding`).

---

## Design

### 1. Catálogo de normas (`src/lib/normas/`)

Constantes TS versionadas (read-only, versionam junto com o código, sem migração de banco). A NC guarda referências como strings validadas contra o catálogo em memória.

```
src/lib/normas/
  nr10-clausulas-2019.ts   ← árvore completa (numeração atual)
  nr10-clausulas-2026.ts   ← árvore completa (Portaria 737 — numeração nova)
  nr28-gravidade.ts        ← Anexo II vigente, linhas da NR-10 (chaveado em 2019)
  nbr-refs.ts              ← nº/itens de NBR citáveis (sem texto — copyright ABNT)
  index.ts                 ← registry de versões + helpers de lookup
  __tests__/normas.test.ts
```

**Tipos:**

```ts
export type NormaVersao = "nr10:2019" | "nr10:2026";

export interface ClausulaNR10 {
  item: string;      // "10.2.4" ou "10.2.4.g"
  titulo: string;    // rótulo curto do requisito
  capitulo: string;  // "10.2"
  grupo?: string;    // rótulo humano do bloco, ex.: "Prontuário"
}

export interface InfracaoNR28 {
  itens: string[];       // itens-base cobertos pela linha, ex.: ["10.2.4"]
  codigo: string;        // "210178-5"
  gravidade: 1 | 2 | 3 | 4;
  area: "S" | "M";       // Segurança | Medicina do Trabalho
}

export type NormaRefTipo = "nr10" | "nbr" | "outra";
export interface NormaRef {
  tipo: NormaRefTipo;
  ref: string;   // nr10: item ("10.2.4.g"); nbr/outra: texto livre ("NBR 5410 6.1.8.1")
}
```

**Regra de versão da NR-28:** o Anexo II está chaveado na numeração **NR-10:2019**. Portanto:

- Report em `nr10:2019` → gravidade derivável do mapa vigente.
- Report em `nr10:2026` → gravidade **`null` (indisponível)** — o governo ainda não publicou o Anexo II re-chaveado para a nova numeração. Comportamento correto e transparente, não bug. Quando publicar, adiciona-se como segunda versão do mapa.

**Semear:** um único mapa de gravidade da NR-10 (o vigente). Estrutura pronta para receber outra versão sem refactor.

### 2. Schema da NC e do Report

**`rti_ncs`** (migração via MCP do Supabase + `types.ts` à mão):

| Campo | Tipo | Semântica |
|---|---|---|
| `titulo` | `text` null | título curto (DIAGNERG Campo 3). Legado: `null`; UI incentiva preencher |
| `normas` | `jsonb not null default '[]'` | `NormaRef[]` |
| `gravidade_nr28_override` | `smallint` null, check 1..4 | `null` = automática (derivada); preenchido = override manual do auditor |
| `prioridade` | (já existe, 1..4) | **inalterado** = prioridade de correção, juízo do auditor (alimenta o plano de ação) |
| `situacao_atual` | (já existe) | passa a ser exposto no `NcParaPdf` (hoje vive no banco sem uso) |

**Dois eixos de naturezas diferentes** (não são o mesmo campo com nomes trocados):

- **Prioridade (1..4):** decisão técnica de *quando corrigir* (risco ao trabalhador × esforço/custo × prazo). É o que **aparece** no laudo.
- **Gravidade NR-28 (1..4):** exposição regulatória *objetiva*, derivada. É o que **não aparece** no entregável (sub-spec 2).

**Gravidade efetiva = `override ?? derivada(normas, versão)`**, computada na leitura (fonte única de verdade; só o override é persistido). Derivada = **máximo** dos I dos itens NR-10 citados — a infração mais grave rege. NBR não contribui (não tem classificação na NR-28).

**`rti_reports`:** `norma_versao text not null default 'nr10:2019'`. As `normas[]` das NCs validam contra a versão do report. Default via `normaVersaoVigente(data)`; o consultor pode apontar `nr10:2026` para recomendações prospectivas.

### 3. Lógica pura + validação (`src/lib/normas/index.ts`)

```ts
// Versão da NR-10 vigente numa data (fronteira: 2027-06-01).
export function normaVersaoVigente(data: Date): NormaVersao;

// Cláusulas da versão indicada (registry por versão).
export function clausulasNR10(versao: NormaVersao): ClausulaNR10[];

// Item existe no catálogo da versão?
export function validarNormaRef(ref: NormaRef, versao: NormaVersao): boolean;

// Gravidade derivada (máx dos itens NR-10) + códigos casados; null se
// indisponível (versão sem mapa NR-28, ou nenhuma ref NR-10).
export function gravidadeNR28(
  normas: NormaRef[],
  versao: NormaVersao,
): { gravidade: 1 | 2 | 3 | 4; codigos: string[]; area: "S" | "M" } | null;

// Aplica override manual sobre a derivada.
export function gravidadeEfetiva(
  nc: { normas: NormaRef[]; gravidade_nr28_override: number | null },
  versao: NormaVersao,
): number | null;
```

**Normalização do lookup NR-28:** o Anexo II agrupa itens ("10.2.4, alíneas a–g" numa linha só, código 210178-5, gravidade 2). O `nr28-gravidade.ts` guarda os **itens-base** por linha; o lookup casa a `ref` da NC se ela **for igual a** ou **for alínea/subitem de** um item-base listado (match por prefixo: `"10.2.4.g"` casa a linha de `"10.2.4"`).

### 4. Migração

```sql
alter table rti_ncs
  add column titulo text,
  add column normas jsonb not null default '[]'::jsonb,
  add column gravidade_nr28_override smallint
    check (gravidade_nr28_override between 1 and 4);

alter table rti_reports
  add column norma_versao text not null default 'nr10:2019';
```

Linhas existentes recebem os defaults (`normas=[]`, `norma_versao='nr10:2019'`, `titulo`/override `null`). Aplicar via `apply_migration`; manter `.sql` versionado em `supabase/migrations/`; atualizar `src/integrations/supabase/types.ts` à mão. Mudanças são **aditivas** — nada quebra o schema atual.

### 5. Testes

Testes unitários (`src/lib/normas/__tests__/normas.test.ts`), padrão dos testes puros de `rti-relatorio.ts`:

- `normaVersaoVigente`: antes de 2027-06-01 → `nr10:2019`; em/depois → `nr10:2026`.
- `gravidadeNR28`: regra do máximo entre itens; item desconhecido ignorado; NBR não contribui; `nr10:2026` → `null`; sem ref NR-10 → `null`.
- `gravidadeEfetiva`: override tem precedência; sem override cai na derivada.
- `validarNormaRef`: item válido/ inválido por versão.
- Lookup por prefixo (alínea casa item-base).

Testes existentes de `rti.ts` / `rti-relatorio.ts` continuam passando (aditivo).

---

## Decisões (registro auditável)

| # | Pergunta | Opções | Escolha | Razão |
|---|---|---|---|---|
| 1 | Modelo dos dois eixos | (A) gravidade derivada + prioridade manual; (B) ambos manuais; (C) um eixo só | **A** | Aproveita o mapeamento oficial da NR-28; mantém a prioridade como decisão técnica do auditor |
| 2 | Forma do catálogo | (a) constantes TS; (b) tabela no banco | **a** | Read-only, versiona com o código, sem migração/RLS/CRUD desnecessários |
| 3 | Granularidade | (a) árvore completa NR-10; (b) subconjunto curado | **a** | Valida qualquer citação e sustenta o Volume I "por requisito" |
| 4 | Exposição NR-28 no laudo | expor / não expor | **não expor no entregável; só na área logada** | Evita entregar auto de infração pré-preenchido contra o cliente |
| 5 | Visibilidade NR-28 na área logada | (i) consultor+cliente; (ii) só consultor | **(i), com permissão por usuário controlada pelo consultor** (default off) | É dado do cliente atrás de login; consultor decide quem vê, na provisão de acesso |
| 6 | Estrutura de entrega | PDF monolítico / volumes derivados | **volumes derivados do mesmo dado** | Completude sem os custos de peso/navegação/público de um único calhamaço |
| 7 | Versionamento de norma | migrar no futuro / versionar já | **versionar desde já** | Referência normativa congela na emissão; NR-10:2026 vige em 01/06/2027 |
| 8 | Versão de gravidade NR-28 | uma / duas | **uma (vigente), estrutura pronta p/ duas** | A Portaria 1.794/2024 só altera NR-22; não há segundo mapa de NR-10 à mão |

---

## Fontes capturadas nesta sessão

- Texto integral **NR-10:2019** (Portaria 508/2016 consolidada).
- Texto integral **NR-10:2026** (Portaria 737/2026).
- **NR-28** consolidada 2026 — Anexo II com as linhas da NR-10 (gravidade + código).
- Modelos de referência DIAGNERG e DPST (estrutura extraída).
- (Portaria 1.794/2024 — descartada: altera apenas NR-22.)

> Nota sobre copyright: os textos das **NR** (públicas) podem ser versionados em `docs/normas/`. Os textos de **NBR/IEC** (ABNT) **não** — referenciar só por número/item.

---

## Próximos passos

1. Plano de implementação desta sub-spec (skill writing-plans).
2. Sub-spec 2 (PDF/volumes + fix foto + sumário + front matter + regra de não-exposição NR-28).
3. Sub-spec 3 (camada de gestão / Volume I + tela de exposição NR-28 com permissão).
4. Sub-spec 4 (branding white-label).
