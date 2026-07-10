# Laudo RTI — PDF entregável — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformular o PDF entregável do RTI — foto inteira (sem corte), render de título/normas/situação por NC, sumário por setor + bookmarks navegáveis, front matter técnico, e um guard que impede a gravidade NR-28 de vazar para o entregável.

**Architecture:** Helpers puros novos em `rti-relatorio.ts` (formatação de normas, agrupamento por setor, texto de limitações) com testes unitários; o componente `RtiPdfDocument.tsx` consome esses helpers e o dado que a sub-spec 1 já entrega no `NcParaPdf` (`titulo`, `normas`, `situacaoAtual`). Um teste de fumaça renderiza o documento para buffer (`renderToBuffer`, ambiente node do vitest) e garante que não quebra em runtime.

**Tech Stack:** TypeScript, Vitest (`vitest run`, ambiente node), `@react-pdf/renderer` 4.5.1 (prop `bookmark` = `string`; `objectFit:"contain"`; sem resolução confiável de nº de página em conteúdo).

**Fonte da verdade:** `docs/superpowers/specs/2026-07-10-laudo-rti-pdf-entregavel-design.md`.

---

## Regras do projeto que este plano respeita

- **Push remoto só sob comando explícito.** Commits locais livres — cada task termina em commit local. Nenhum `git push`.
- **Sem hardcode de hex fora dos tokens** — exceção conhecida e já existente: dentro do `@react-pdf` o hex é inevitável (não lê CSS variables); segue o padrão do arquivo (`PINE`, `#666`, `#ddd`…).
- **Gravidade NR-28 nunca no entregável** — nenhuma mudança deste plano renderiza gravidade/código NR-28; a Task 3 adiciona um teste que trava isso.
- **Erros tsc pré-existentes são conhecidos** — o baseline atual está limpo (validado na sub-spec 1); comparar contra "nenhum novo erro".

---

## Estrutura de arquivos

| Arquivo | Responsabilidade / mudança |
|---|---|
| `src/lib/rti-relatorio.ts` | + `formatNormasRef`, `rotuloNc`, `sumarioPorSetor`, `SumarioSetor`, `LIMITACOES_PADRAO` (helpers puros) |
| `src/lib/__tests__/rti-relatorio.test.ts` | testes dos helpers novos + guard NR-28 |
| `src/components/rti/pdf/RtiPdfDocument.tsx` | foto `contain`; cabeçalho/normas/situação por NC; front matter (referencial + limitações); página de sumário; bookmarks |
| `src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx` | teste de fumaça: renderiza o documento a buffer sem erro |

O `RtiPdfDocument.tsx` já existe e é o único componente de render do laudo; todas as mudanças de layout ficam nele (não se cria novo componente nesta passada — a divisão em volumes é da sub-spec 3).

---

## Task 1: Helper `formatNormasRef` (formatação das referências normativas)

**Files:**
- Modify: `src/lib/rti-relatorio.ts`
- Test: `src/lib/__tests__/rti-relatorio.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicione ao fim de `src/lib/__tests__/rti-relatorio.test.ts`:

```ts
import { formatNormasRef } from "../rti-relatorio";

describe("formatNormasRef", () => {
  test("prefixa itens NR-10 com 'NR-10 ' e mantém nbr/outra como estão", () => {
    const s = formatNormasRef([
      { tipo: "nr10", ref: "10.2.4.g" },
      { tipo: "nbr", ref: "NBR 5410 6.1.8.1" },
      { tipo: "outra", ref: "IEC 60364" },
    ]);
    expect(s).toBe("NR-10 10.2.4.g; NBR 5410 6.1.8.1; IEC 60364");
  });

  test("ignora refs vazias e devolve string vazia para lista vazia", () => {
    expect(formatNormasRef([{ tipo: "nr10", ref: "  " }])).toBe("");
    expect(formatNormasRef([])).toBe("");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: FAIL — `formatNormasRef` não exportado.

- [ ] **Step 3: Implementar o helper**

Em `src/lib/rti-relatorio.ts`, o import de tipo de normas já existe (`import type { NormaRef } from "./normas/types";`, adicionado na sub-spec 1). Adicione, na seção de NCs (após `mergeNcOverrides`):

```ts
/** Referências normativas para exibição: "NR-10 10.2.4.g; NBR 5410 6.1.8.1". */
export function formatNormasRef(normas: NormaRef[]): string {
  return normas
    .map((n) => (n.tipo === "nr10" ? `NR-10 ${n.ref.trim()}` : n.ref.trim()))
    .filter((s) => s.length > 0 && s !== "NR-10")
    .join("; ");
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rti-relatorio.ts src/lib/__tests__/rti-relatorio.test.ts
git commit -m "feat(rti): formatNormasRef para referência normativa da NC"
```

---

## Task 2: Helpers `rotuloNc` + `sumarioPorSetor` (índice por setor)

**Files:**
- Modify: `src/lib/rti-relatorio.ts`
- Test: `src/lib/__tests__/rti-relatorio.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicione ao fim de `src/lib/__tests__/rti-relatorio.test.ts`:

```ts
import { rotuloNc, sumarioPorSetor } from "../rti-relatorio";

describe("rotuloNc", () => {
  test("usa titulo quando houver", () => {
    expect(rotuloNc({ titulo: "Painel sem identificação", descricao: "x".repeat(200) })).toBe(
      "Painel sem identificação",
    );
  });
  test("sem titulo, corta a descrição em ~80 chars sem partir palavra", () => {
    const desc = "Cabo exposto na canaleta do setor de moagem apresentando risco de contato acidental durante manutenção";
    const r = rotuloNc({ titulo: null, descricao: desc });
    expect(r.length).toBeLessThanOrEqual(81); // 80 + reticências
    expect(r.endsWith("…")).toBe(true);
    expect(r).not.toContain("  ");
  });
  test("descrição curta não recebe reticências", () => {
    expect(rotuloNc({ titulo: null, descricao: "Cabo exposto" })).toBe("Cabo exposto");
  });
});

describe("sumarioPorSetor", () => {
  test("agrupa por setor na ordem de aparição, NCs ordenadas por número", () => {
    const setores = sumarioPorSetor([
      nc({ id: "a", numero: 3, areaNome: "Moagem", titulo: "T3" }),
      nc({ id: "b", numero: 1, areaNome: "Subestação", titulo: "T1" }),
      nc({ id: "c", numero: 2, areaNome: "Moagem", titulo: "T2" }),
    ]);
    expect(setores.map((s) => s.setor)).toEqual(["Moagem", "Subestação"]);
    expect(setores[0].ncs).toEqual([
      { numero: 2, rotulo: "T2" },
      { numero: 3, rotulo: "T3" },
    ]);
    expect(setores[1].ncs).toEqual([{ numero: 1, rotulo: "T1" }]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: FAIL — `rotuloNc`/`sumarioPorSetor` não exportados.

- [ ] **Step 3: Implementar os helpers**

Em `src/lib/rti-relatorio.ts`, após `formatNormasRef`:

```ts
/** Rótulo curto da NC para índice/bookmark: título, ou descrição aparada a ~80 chars. */
export function rotuloNc(nc: Pick<NcParaPdf, "titulo" | "descricao">): string {
  if (nc.titulo && nc.titulo.trim()) return nc.titulo.trim();
  const d = (nc.descricao ?? "").trim();
  if (d.length <= 80) return d;
  const corte = d.slice(0, 80);
  const ultimoEspaco = corte.lastIndexOf(" ");
  const base = ultimoEspaco > 40 ? corte.slice(0, ultimoEspaco) : corte;
  return base.trimEnd() + "…";
}

export interface SumarioSetor {
  setor: string;
  ncs: { numero: number; rotulo: string }[];
}

/** Agrupa NCs por setor (ordem de aparição), NCs ordenadas por número. */
export function sumarioPorSetor(ncs: NcParaPdf[]): SumarioSetor[] {
  const ordem: string[] = [];
  const mapa = new Map<string, { numero: number; rotulo: string }[]>();
  for (const nc of ncs) {
    const setor = nc.areaNome || "—";
    if (!mapa.has(setor)) {
      mapa.set(setor, []);
      ordem.push(setor);
    }
    mapa.get(setor)!.push({ numero: nc.numero, rotulo: rotuloNc(nc) });
  }
  return ordem.map((setor) => ({
    setor,
    ncs: mapa.get(setor)!.slice().sort((a, b) => a.numero - b.numero),
  }));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rti-relatorio.ts src/lib/__tests__/rti-relatorio.test.ts
git commit -m "feat(rti): rotuloNc + sumarioPorSetor para índice do laudo"
```

---

## Task 3: `LIMITACOES_PADRAO` + guard NR-28

**Files:**
- Modify: `src/lib/rti-relatorio.ts`
- Test: `src/lib/__tests__/rti-relatorio.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicione ao fim de `src/lib/__tests__/rti-relatorio.test.ts`:

```ts
import { LIMITACOES_PADRAO } from "../rti-relatorio";

describe("LIMITACOES_PADRAO", () => {
  test("menciona ART e reavaliação, sem prometer projeto", () => {
    expect(LIMITACOES_PADRAO).toMatch(/ART/);
    expect(LIMITACOES_PADRAO.length).toBeGreaterThan(80);
  });
});

describe("guard: gravidade NR-28 nunca no modelo do PDF", () => {
  test("NcParaPdf não expõe nenhum campo de gravidade NR-28", () => {
    const chaves = Object.keys(nc({})).join(" ").toLowerCase();
    expect(chaves).not.toMatch(/gravidade|nr-?28/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: FAIL — `LIMITACOES_PADRAO` não exportado. (O guard já passa hoje — mas fica travando regressões futuras.)

- [ ] **Step 3: Implementar a constante**

Em `src/lib/rti-relatorio.ts`, junto dos templates (após `METODOLOGIA_PADRAO`):

```ts
export const LIMITACOES_PADRAO =
  "Este laudo reflete as condições observadas nas instalações elétricas durante o " +
  "período da inspeção, com base em inspeção visual e verificação documental, e não " +
  "constitui projeto elétrico nem substitui a Anotação de Responsabilidade Técnica (ART) " +
  "de projeto ou de execução. As recomendações devem ser implementadas por profissional " +
  "legalmente habilitado, com reavaliação periódica das instalações.";
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: PASS (ambos os describes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rti-relatorio.ts src/lib/__tests__/rti-relatorio.test.ts
git commit -m "feat(rti): LIMITACOES_PADRAO + guard NR-28 fora do entregável"
```

---

## Task 4: Foto `cover` → `contain` (preserva a foto inteira)

**Files:**
- Modify: `src/components/rti/pdf/RtiPdfDocument.tsx`

- [ ] **Step 1: Trocar o estilo da foto**

Em `src/components/rti/pdf/RtiPdfDocument.tsx`, no `StyleSheet.create`, substitua a linha:

```ts
  foto: { width: 160, height: 120, objectFit: "cover", borderRadius: 3 },
```

por:

```ts
  fotoBox: {
    width: 160,
    height: 120,
    borderRadius: 3,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  foto: { maxWidth: 160, maxHeight: 120, objectFit: "contain" },
```

- [ ] **Step 2: Envolver a Image num quadro**

No render das fotos da NC, substitua:

```tsx
                  {nc.fotos.map((f) => (
                    <Image key={f.id} src={f.url} style={s.foto} />
                  ))}
```

por:

```tsx
                  {nc.fotos.map((f) => (
                    <View key={f.id} style={s.fotoBox}>
                      <Image src={f.url} style={s.foto} />
                    </View>
                  ))}
```

- [ ] **Step 3: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: nenhum novo erro.

- [ ] **Step 4: Commit**

```bash
git add src/components/rti/pdf/RtiPdfDocument.tsx
git commit -m "fix(rti): foto do laudo em contain (preserva foto inteira, sem corte)"
```

---

## Task 5: Cabeçalho, normas e situação por NC

**Files:**
- Modify: `src/components/rti/pdf/RtiPdfDocument.tsx`

- [ ] **Step 1: Importar os helpers**

No topo de `src/components/rti/pdf/RtiPdfDocument.tsx`, substitua:

```ts
import { PRIORIDADE_LABEL } from "@/lib/rti-relatorio";
```

por:

```ts
import {
  PRIORIDADE_LABEL,
  LIMITACOES_PADRAO,
  formatNormasRef,
  sumarioPorSetor,
} from "@/lib/rti-relatorio";
```

(`LIMITACOES_PADRAO` e `sumarioPorSetor` são usados nas Tasks 6 e 7; importar já evita um segundo edit no mesmo import.)

- [ ] **Step 2: Cabeçalho da NC usa o título (com fallback) e move a prioridade para a meta**

Substitua o bloco do cabeçalho + meta da NC:

```tsx
              <Text style={s.ncTitulo}>
                NC {String(nc.numero).padStart(3, "0")} — {PRIORIDADE_LABEL[nc.prioridade]}
              </Text>
              <Text style={s.ncMeta}>
                Área: {nc.areaNome}
                {nc.tipoExecucao === "investimento"
                  ? "  ·  Investimento"
                  : nc.osNumero
                    ? `  ·  O.S. ${nc.osNumero}`
                    : ""}
                {nc.custoPlanejado ? `  ·  ${fmtBRL(nc.custoPlanejado)}` : ""}
              </Text>
```

por:

```tsx
              <Text style={s.ncTitulo}>
                NC {String(nc.numero).padStart(3, "0")}
                {nc.titulo ? ` — ${nc.titulo}` : ` — ${PRIORIDADE_LABEL[nc.prioridade]}`}
              </Text>
              <Text style={s.ncMeta}>
                {PRIORIDADE_LABEL[nc.prioridade]}  ·  Área: {nc.areaNome}
                {nc.tipoExecucao === "investimento"
                  ? "  ·  Investimento"
                  : nc.osNumero
                    ? `  ·  O.S. ${nc.osNumero}`
                    : ""}
                {nc.custoPlanejado ? `  ·  ${fmtBRL(nc.custoPlanejado)}` : ""}
              </Text>
```

- [ ] **Step 3: Renderizar referência normativa e situação atual**

Logo após a linha da recomendação e antes do bloco de fotos, substitua:

```tsx
              <Text style={s.p}>{nc.descricao}</Text>
              {nc.recomendacao ? <Text style={s.p}>Recomendação: {nc.recomendacao}</Text> : null}
              {nc.fotos.length > 0 ? (
```

por:

```tsx
              <Text style={s.p}>{nc.descricao}</Text>
              {nc.recomendacao ? <Text style={s.p}>Recomendação: {nc.recomendacao}</Text> : null}
              {nc.normas.length > 0 ? (
                <Text style={s.p}>Referência normativa: {formatNormasRef(nc.normas)}</Text>
              ) : null}
              {nc.situacaoAtual ? <Text style={s.p}>Situação atual: {nc.situacaoAtual}</Text> : null}
              {nc.fotos.length > 0 ? (
```

- [ ] **Step 4: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: nenhum novo erro. (`sumarioPorSetor`/`LIMITACOES_PADRAO` importados mas ainda não usados: o tsc do projeto não trava por import não usado — o lint sim, mas serão usados nas Tasks 6–7 antes do fim. Se rodar lint isolado agora, ignore o `no-unused-vars` transitório.)

- [ ] **Step 5: Commit**

```bash
git add src/components/rti/pdf/RtiPdfDocument.tsx
git commit -m "feat(rti): NC do laudo mostra título, referência normativa e situação atual"
```

---

## Task 6: Front matter técnico (referencial normativo + limitações)

**Files:**
- Modify: `src/components/rti/pdf/RtiPdfDocument.tsx`

- [ ] **Step 1: Reestruturar a página de front matter**

Substitua o bloco de headings da página 2:

```tsx
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
```

por:

```tsx
        <Text style={[s.h2, { color: cor }]}>1. Objeto e escopo</Text>
        <Text style={s.p}>{ident.introducao}</Text>
        <Text style={[s.h2, { color: cor }]}>2. Referencial normativo</Text>
        <Text style={s.p}>{ident.normas || "—"}</Text>
        <Text style={[s.h2, { color: cor }]}>3. Metodologia</Text>
        <Text style={s.p}>{ident.metodologia}</Text>
        <Text style={[s.h2, { color: cor }]}>4. Limitações e ressalvas</Text>
        <Text style={s.p}>{LIMITACOES_PADRAO}</Text>
        {model.resumoExecutivo ? (
          <>
            <Text style={[s.h2, { color: cor }]}>5. Resumo executivo</Text>
            <Text style={s.p}>{model.resumoExecutivo}</Text>
          </>
        ) : null}
```

- [ ] **Step 2: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: nenhum novo erro. `LIMITACOES_PADRAO` agora está em uso.

- [ ] **Step 3: Commit**

```bash
git add src/components/rti/pdf/RtiPdfDocument.tsx
git commit -m "feat(rti): front matter técnico (objeto, referencial, metodologia, limitações)"
```

---

## Task 7: Página de sumário por setor + bookmarks navegáveis

**Files:**
- Modify: `src/components/rti/pdf/RtiPdfDocument.tsx`

- [ ] **Step 1: Estilos do sumário**

No `StyleSheet.create`, após a linha de `assinatura`/`linhaAssin` (qualquer ponto do objeto serve; ao lado das demais), adicione:

```ts
  sumarioSetor: { fontSize: 11, fontWeight: 800, marginTop: 8, marginBottom: 3 },
  sumarioItem: { fontSize: 9, marginBottom: 2, marginLeft: 8 },
```

- [ ] **Step 2: Inserir a página de sumário antes das NCs**

Logo antes do bloco que renderiza as páginas de NCs (o `{chunk(model.ncs, NC_POR_PAGINA).map(...)}`), insira uma nova `<Page>`:

```tsx
      {/* Sumário — NCs agrupadas por setor (navegação também por bookmarks) */}
      {model.ncs.length > 0 ? (
        <Page size="A4" style={s.page}>
          <HeaderFooter model={model} />
          <Text style={[s.h2, { color: cor }]}>Sumário — não conformidades por setor</Text>
          {sumarioPorSetor(model.ncs).map((grupo) => (
            <View key={grupo.setor} wrap={false} style={{ marginBottom: 10 }}>
              <Text style={s.sumarioSetor}>{grupo.setor}</Text>
              {grupo.ncs.map((n) => (
                <Text key={n.numero} style={s.sumarioItem}>
                  NC {String(n.numero).padStart(3, "0")} — {n.rotulo}
                </Text>
              ))}
            </View>
          ))}
        </Page>
      ) : null}
```

- [ ] **Step 3: Bookmark por NC**

No `<View>` de cada `ncCard`, adicione a prop `bookmark`. Substitua:

```tsx
            <View key={nc.id} style={s.ncCard} wrap={false} minPresenceAhead={80}>
```

por:

```tsx
            <View
              key={nc.id}
              style={s.ncCard}
              wrap={false}
              minPresenceAhead={80}
              bookmark={`NC ${String(nc.numero).padStart(3, "0")}${nc.titulo ? ` — ${nc.titulo}` : ""}`}
            >
```

- [ ] **Step 4: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: nenhum novo erro. (`bookmark` aceita `string` no `@react-pdf` 4.5.1.)

- [ ] **Step 5: Commit**

```bash
git add src/components/rti/pdf/RtiPdfDocument.tsx
git commit -m "feat(rti): sumário por setor + bookmarks navegáveis no laudo"
```

---

## Task 8: Teste de fumaça do render + validação final

Garante que todas as mudanças do `RtiPdfDocument` renderizam sem erro em runtime (não só tipagem). Roda no ambiente node do vitest, onde `renderToBuffer` existe e as fontes são registradas a partir dos bytes embarcados.

**Files:**
- Create: `src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx`

- [ ] **Step 1: Escrever o teste de fumaça**

Crie `src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx`:

```tsx
import { describe, expect, test } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { RtiPdfDocument } from "../RtiPdfDocument";
import { buildPdfModel, type NcParaPdf } from "@/lib/rti-relatorio";

const nc = (over: Partial<NcParaPdf>): NcParaPdf => ({
  id: "nc-1",
  numero: 1,
  areaNome: "Subestação",
  descricao: "Painel sem identificação de circuitos.",
  recomendacao: "Identificar conforme NR-10.",
  prioridade: 3,
  tipoExecucao: "os",
  osNumero: null,
  custoPlanejado: 0,
  fotos: [],
  titulo: null,
  normas: [],
  situacaoAtual: null,
  ...over,
});

test("RtiPdfDocument renderiza um PDF válido sem lançar", async () => {
  const model = buildPdfModel({
    identificacao: {
      titulo: "RTI Usina",
      clienteNome: "Cliente X",
      local: "Unidade A",
      periodoInicio: "2026-07-01",
      periodoFim: "2026-07-03",
      responsavelTecnico: "Eng. Fulano",
      artNumero: "ART-123",
      normas: "NR-10; NBR 5410",
      introducao: "Introdução.",
      metodologia: "Metodologia.",
    },
    branding: null,
    ncs: [
      nc({ id: "a", numero: 1, areaNome: "Moagem", titulo: "Painel sem identificação", normas: [{ tipo: "nr10", ref: "10.2.4.g" }], situacaoAtual: "Aguardando peça" }),
      nc({ id: "b", numero: 2, areaNome: "Subestação" }),
    ],
    overrides: {},
    parecer: "Parecer técnico.\nSegundo parágrafo.",
    resumoExecutivo: "Resumo executivo.",
  });

  const buffer = await renderToBuffer(<RtiPdfDocument model={model} />);
  expect(buffer.length).toBeGreaterThan(1000);
  expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});
```

- [ ] **Step 2: Rodar o teste de fumaça**

Run: `npx vitest run src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx`
Expected: PASS — o documento renderiza para um buffer que começa com `%PDF-`. (Pode levar 1–3 s por causa do registro de fontes.)

- [ ] **Step 3: Rodar a suíte completa**

Run: `npx vitest run`
Expected: PASS em todos os arquivos (helpers novos + fumaça + suíte pré-existente).

- [ ] **Step 4: Verificar tipagem e lint do arquivo do PDF**

Run: `npx tsc --noEmit`
Expected: nenhum novo erro.

Run: `npx eslint src/components/rti/pdf/RtiPdfDocument.tsx src/lib/rti-relatorio.ts`
Expected: sem erros (todos os imports em uso).

- [ ] **Step 5: Commit**

```bash
git add src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx
git commit -m "test(rti): fumaça de render do laudo (renderToBuffer → %PDF)"
```

---

## Verificação no preview (opcional, após as tasks)

O laudo é gerado por server function e exibido no preview do wizard. Para conferir visualmente foto inteira, sumário, bookmarks e front matter num relatório real, abrir o wizard de um report com NCs+fotos no servidor local (porta 57010, gerenciado pelo usuário) e gerar a prévia. Não é bloqueante para o plano — o teste de fumaça já prova que o render não quebra.

---

## Self-review (rodado pelo autor do plano)

**Cobertura da spec:**
- Foto cover→contain → Task 4. ✔
- Render titulo/normas/situacao por NC → Task 5. ✔
- `formatNormasRef` → Task 1. ✔
- Sumário por setor (`sumarioPorSetor`/`rotuloNc`) + bookmarks → Tasks 2 e 7. ✔
- Front matter (objeto, referencial, metodologia, limitações) + `LIMITACOES_PADRAO` → Tasks 3 e 6. ✔
- Guard NR-28 → Task 3. ✔
- Verificação de render → Task 8. ✔

**Placeholders:** nenhum passo de código sem o código. Constantes e helpers têm corpo completo. O teste de fumaça constrói um `PdfModel` real via `buildPdfModel`.

**Consistência de tipos:** `NcParaPdf` (com `titulo`/`normas`/`situacaoAtual` da sub-spec 1) é a base do helper `nc()` no teste de fumaça (Task 8) e do usado em `sumarioPorSetor` (Task 2). `formatNormasRef(NormaRef[])`, `rotuloNc(Pick<NcParaPdf,"titulo"|"descricao">)`, `sumarioPorSetor(NcParaPdf[]): SumarioSetor[]` têm assinatura idêntica entre teste e implementação. O import de `RtiPdfDocument.tsx` (Task 5) já traz `LIMITACOES_PADRAO`/`sumarioPorSetor`/`formatNormasRef` usados nas Tasks 5–7. `bookmark` = `string` (verificado contra `@react-pdf/types` 4.5.1).

**Escopo:** focado no PDF entregável único. Volumes derivados / Volume I / tela NR-28 / branding UI ficam fora (sub-specs 3–4), coerente com a spec.
