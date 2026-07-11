# Laudo RTI — Refino de Layout do PDF (sub-spec 2.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os problemas de layout do PDF entregável do RTI apontados na revisão: uma NC por página, proteção contra quebra de blocos, card da NC reestruturado em seções rotuladas (com recomendação em destaque e fotos como evidências legendadas), fim do texto justificado, fotos com moldura fixa que exibe a imagem inteira em qualquer orientação, e sumário por setor com número de página real.

**Architecture:** Todo o refino vive no componente de render (`RtiPdfDocument.tsx`) e em helpers puros de `rti-relatorio.ts`. O número de página do sumário é resolvido por **render em duas passagens**: a passagem 1 coleta, via callback `render` do `@react-pdf`, o `pageNumber` da primeira NC de cada setor num objeto `PdfPageIndex` injetado por prop; a passagem 2 renderiza o sumário lendo esse objeto já preenchido. O servidor (`rti-relatorio-server.tsx`) passa a renderizar duas vezes na emissão e no preview.

**Tech Stack:** TanStack Start, @react-pdf/renderer 4.5.1, Vitest (node env), TypeScript.

**Fora de escopo (tratar depois):** Item 7 — popular `rti_ncs.normas`/`titulo` no pipeline campo→RTI (`comporRti`) e o mapeamento entre as duas formas de `NormaRef` (`{norma,item}` do campo vs `{tipo,ref}` do laudo). Este plano **não** mexe em dados; só no render. As linhas "Referência normativa" e o uso de `titulo` já existem no render e passam a se beneficiar automaticamente quando o item 7 for feito.

---

## File Structure

- `src/lib/rti-relatorio.ts` — acrescenta o tipo `PdfPageIndex` e o helper puro `primeirasNcsPorSetor()`. Responsabilidade: lógica pura testável do laudo.
- `src/lib/__tests__/rti-relatorio.test.ts` — testes do helper novo.
- `src/components/rti/pdf/RtiPdfDocument.tsx` — todo o refino visual: estilos novos, card da NC em seções, uma NC por página, moldura de foto, marcadores de página do setor, sumário por setor com página.
- `src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx` — smoke de render (mantido) + teste das duas passagens (o `PdfPageIndex` é preenchido após render).
- `src/lib/rti-relatorio-server.tsx:204` — passa a renderizar em duas passagens.

---

### Task 1: Helper puro `primeirasNcsPorSetor` + tipo `PdfPageIndex`

**Files:**
- Modify: `src/lib/rti-relatorio.ts` (após `sumarioPorSetor`, ~linha 161)
- Test: `src/lib/__tests__/rti-relatorio.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao final de `src/lib/__tests__/rti-relatorio.test.ts` (e incluir `primeirasNcsPorSetor` no import do topo):

```ts
describe("primeirasNcsPorSetor", () => {
  test("marca o id da primeira NC de cada setor na ordem de aparição", () => {
    const ids = primeirasNcsPorSetor([
      nc({ id: "a", numero: 1, areaNome: "Moagem" }),
      nc({ id: "b", numero: 2, areaNome: "Moagem" }),
      nc({ id: "c", numero: 3, areaNome: "Subestação" }),
    ]);
    expect(ids.has("a")).toBe(true); // 1ª de Moagem
    expect(ids.has("b")).toBe(false); // 2ª de Moagem
    expect(ids.has("c")).toBe(true); // 1ª de Subestação
    expect(ids.size).toBe(2);
  });

  test("setor vazio cai em '—' e conta como um grupo", () => {
    const ids = primeirasNcsPorSetor([nc({ id: "x", areaNome: "" })]);
    expect(ids.has("x")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: FAIL — `primeirasNcsPorSetor is not a function` / import não resolve.

- [ ] **Step 3: Implementar**

Em `src/lib/rti-relatorio.ts`, logo após a função `sumarioPorSetor` (fim ~linha 161), acrescentar:

```ts
/** Objeto mutável injetado no render: setor → nº da página onde sua 1ª NC começa. */
export interface PdfPageIndex {
  setores: Map<string, number>;
}

/**
 * Ids das NCs que são a PRIMEIRA de cada setor, na ordem de aparição da lista.
 * Usado no render para marcar, em cada página de NC, o início do setor (sumário).
 */
export function primeirasNcsPorSetor(ncs: NcParaPdf[]): Set<string> {
  const vistos = new Set<string>();
  const primeiras = new Set<string>();
  for (const nc of ncs) {
    const setor = nc.areaNome || "—";
    if (!vistos.has(setor)) {
      vistos.add(setor);
      primeiras.add(nc.id);
    }
  }
  return primeiras;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rti-relatorio.test.ts`
Expected: PASS (todos, incluindo os 2 novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rti-relatorio.ts src/lib/__tests__/rti-relatorio.test.ts
git commit -F <mensagem>
```
Mensagem: `feat(rti): helper primeirasNcsPorSetor + tipo PdfPageIndex (base do sumário paginado)`

---

### Task 2: Uma NC por página + proteção de quebra + bookmark na página

**Files:**
- Modify: `src/components/rti/pdf/RtiPdfDocument.tsx`

Reescreve a região de render das NCs (hoje `chunk(model.ncs, NC_POR_PAGINA).map(...)`, linhas ~211-264) para **uma NC por `<Page>`**, remove o helper `chunk`/`NC_POR_PAGINA`, move o `bookmark` para o `<Page>` (elimina o cast), envolve o quadro-resumo em `wrap={false}` e adiciona `minPresenceAhead` aos títulos do front matter.

- [ ] **Step 1: Remover `chunk`/`NC_POR_PAGINA`**

Apagar (linhas ~92-98):

```ts
// Fatiar as NCs em páginas explícitas mantém cada passo de layout do @react-pdf pequeno.
const NC_POR_PAGINA = 14;
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
```

- [ ] **Step 2: Proteger o quadro-resumo contra quebra**

Envolver título + tabela do quadro-resumo num `<View wrap={false}>`. Substituir o bloco (linhas ~178-190):

```tsx
        <Text style={[s.h2, { color: cor }]}>Quadro-resumo por prioridade</Text>
        <View style={s.tabela}>
          <View style={s.tr}>
            <Text style={[s.th, s.tdPrio]}>Prioridade</Text>
            <Text style={[s.th, s.tdQtd]}>NCs</Text>
          </View>
          {model.resumo.map((l) => (
            <View key={l.prioridade} style={s.tr}>
              <Text style={s.tdPrio}>{l.label}</Text>
              <Text style={s.tdQtd}>{String(l.quantidade)}</Text>
            </View>
          ))}
        </View>
```

por:

```tsx
        <View wrap={false}>
          <Text style={[s.h2, { color: cor }]}>Quadro-resumo por prioridade</Text>
          <View style={s.tabela}>
            <View style={s.tr}>
              <Text style={[s.th, s.tdPrio]}>Prioridade</Text>
              <Text style={[s.th, s.tdQtd]}>NCs</Text>
            </View>
            {model.resumo.map((l) => (
              <View key={l.prioridade} style={s.tr}>
                <Text style={s.tdPrio}>{l.label}</Text>
                <Text style={s.tdQtd}>{String(l.quantidade)}</Text>
              </View>
            ))}
          </View>
        </View>
```

- [ ] **Step 3: `minPresenceAhead` nos títulos do front matter (evita título solto)**

Nos cinco `<Text style={[s.h2, { color: cor }]}>` da página de front matter (Objeto/Referencial/Metodologia/Limitações/Resumo executivo, linhas ~164-174), acrescentar `minPresenceAhead={48}` em cada um. Exemplo do primeiro:

```tsx
        <Text style={[s.h2, { color: cor }]} minPresenceAhead={48}>
          1. Objeto e escopo
        </Text>
```
Aplicar o mesmo `minPresenceAhead={48}` aos outros quatro títulos numerados dessa página.

- [ ] **Step 4: Uma NC por página + bookmark no `<Page>`**

Substituir todo o bloco de NCs (o `{chunk(...).map(...)}` inteiro, linhas ~211-264) por:

```tsx
      {/* Uma NC por página: cada página é pequena e independente (bom p/ o motor de
          layout) e vira uma entrada de bookmark navegável. Conteúdo longo (muitas
          fotos) ainda auto-pagina para uma 2ª página. */}
      {model.ncs.map((nc) => (
        <Page
          key={nc.id}
          size="A4"
          style={s.page}
          bookmark={`NC ${String(nc.numero).padStart(3, "0")}${nc.titulo ? ` — ${nc.titulo}` : ""}`}
        >
          <HeaderFooter model={model} />
          <NcConteudo nc={nc} cor={cor} />
        </Page>
      ))}
```

O componente `NcConteudo` é criado na Task 3. Para este passo compilar isoladamente, criar um stub mínimo no topo do arquivo (será substituído na Task 3):

```tsx
function NcConteudo({ nc, cor }: { nc: NcParaPdf; cor: string }) {
  return (
    <View style={s.ncCard}>
      <Text style={s.ncTitulo}>
        NC {String(nc.numero).padStart(3, "0")}
        {nc.titulo ? ` — ${nc.titulo}` : ` — ${PRIORIDADE_LABEL[nc.prioridade]}`}
      </Text>
      <Text style={s.p}>{nc.descricao}</Text>
    </View>
  );
}
```

Ajustar o import de tipos no topo para incluir `NcParaPdf`:

```tsx
import type { PdfModel, NcParaPdf } from "@/lib/rti-relatorio";
```

- [ ] **Step 5: Rodar o smoke e o tsc**

Run: `npx vitest run src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx`
Expected: PASS (o smoke ainda gera `%PDF-`).
Run: `npx tsc --noEmit 2>&1 | Select-String "RtiPdfDocument"`
Expected: sem linhas (sem erro no arquivo).

- [ ] **Step 6: Commit**

```bash
git add src/components/rti/pdf/RtiPdfDocument.tsx
git commit -F <mensagem>
```
Mensagem: `feat(rti): uma NC por página + bookmark na página + quadro-resumo sem quebra`

---

### Task 3: Card da NC em seções rotuladas (constatação/recomendação/referência/situação/evidências) + fim do justify

**Files:**
- Modify: `src/components/rti/pdf/RtiPdfDocument.tsx`

- [ ] **Step 1: Ajustar estilos base e acrescentar estilos de seção**

No `StyleSheet.create` (`s`), trocar o estilo `p` (remover `justify`, apertar linha) e acrescentar os estilos novos. Substituir a linha do `p`:

```tsx
  p: { marginBottom: 6, lineHeight: 1.5, textAlign: "justify" },
```
por:

```tsx
  p: { marginBottom: 6, lineHeight: 1.4 },
  corpoNc: { fontSize: 10, lineHeight: 1.4, marginBottom: 2 },
  blocoLabel: {
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 0.4,
    color: "#6b7280",
    marginTop: 10,
    marginBottom: 2,
  },
  recomendacaoBox: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#059669",
    backgroundColor: "#ecfdf5",
  },
  recomendacaoLabel: {
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 0.4,
    color: "#047857",
    marginBottom: 2,
  },
  evidenciaCard: { width: 235 },
  fotoLegenda: { fontSize: 8, color: "#6b7280", marginTop: 3 },
```

Trocar também `fotoRow` e a moldura/imagem (feito na Task 4 para as fotos; aqui só o texto). Manter `fotoRow`/`fotoBox`/`foto` como estão por enquanto.

- [ ] **Step 2: Reescrever o `NcConteudo` (substitui o stub da Task 2)**

Substituir a função stub `NcConteudo` por:

```tsx
function Bloco({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View wrap={false}>
      <Text style={s.blocoLabel}>{label}</Text>
      {children}
    </View>
  );
}

function NcConteudo({ nc, cor }: { nc: NcParaPdf; cor: string }) {
  return (
    <View style={s.ncCard}>
      <Text style={[s.ncTitulo, { color: cor }]}>
        NC {String(nc.numero).padStart(3, "0")}
        {nc.titulo ? ` — ${nc.titulo}` : ` — ${PRIORIDADE_LABEL[nc.prioridade]}`}
      </Text>
      <Text style={s.ncMeta}>
        {PRIORIDADE_LABEL[nc.prioridade]} · Área: {nc.areaNome}
        {nc.tipoExecucao === "investimento"
          ? "  ·  Investimento"
          : nc.osNumero
            ? `  ·  O.S. ${nc.osNumero}`
            : ""}
      </Text>

      <Bloco label="CONSTATAÇÃO">
        <Text style={s.corpoNc}>{nc.descricao}</Text>
      </Bloco>

      {nc.recomendacao ? (
        <View style={s.recomendacaoBox} wrap={false}>
          <Text style={s.recomendacaoLabel}>RECOMENDAÇÃO</Text>
          <Text style={s.corpoNc}>{nc.recomendacao}</Text>
        </View>
      ) : null}

      {nc.normas.length > 0 ? (
        <Bloco label="REFERÊNCIA NORMATIVA">
          <Text style={s.corpoNc}>{formatNormasRef(nc.normas)}</Text>
        </Bloco>
      ) : null}

      {nc.situacaoAtual ? (
        <Bloco label="SITUAÇÃO ATUAL">
          <Text style={s.corpoNc}>{nc.situacaoAtual}</Text>
        </Bloco>
      ) : null}

      {nc.fotos.length > 0 ? (
        <View>
          <Text style={s.blocoLabel}>EVIDÊNCIAS</Text>
          <View style={s.fotoRow}>
            {nc.fotos.map((f) => (
              <View key={f.id} style={s.evidenciaCard} wrap={false}>
                <View style={s.fotoBox}>
                  <Image src={f.url} style={s.foto} />
                </View>
                {f.legenda ? <Text style={s.fotoLegenda}>{f.legenda}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
```

Garantir o import do React para o tipo `React.ReactNode` (o arquivo é `.tsx`; se não houver import de React, usar `import type { ReactNode } from "react";` e trocar `React.ReactNode` por `ReactNode`).

- [ ] **Step 3: Rodar smoke + tsc**

Run: `npx vitest run src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx`
Expected: PASS.
Run: `npx tsc --noEmit 2>&1 | Select-String "RtiPdfDocument"`
Expected: sem linhas.

- [ ] **Step 4: Commit**

```bash
git add src/components/rti/pdf/RtiPdfDocument.tsx
git commit -F <mensagem>
```
Mensagem: `feat(rti): card da NC em seções rotuladas + recomendação destacada + evidências legendadas`

---

### Task 4: Fotos com moldura fixa que exibe a imagem inteira (retrato e paisagem)

**Files:**
- Modify: `src/components/rti/pdf/RtiPdfDocument.tsx`

- [ ] **Step 1: Trocar moldura e imagem**

No `StyleSheet.create`, substituir os estilos `fotoRow`, `fotoBox` e `foto` atuais:

```tsx
  fotoRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
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

por:

```tsx
  fotoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  fotoBox: {
    width: 235,
    height: 180,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
    overflow: "hidden",
  },
  // Dimensões FIXAS + objectFit contain garantem a imagem inteira (letterbox)
  // em qualquer orientação — retrato ou paisagem. objectPosition centraliza.
  foto: { width: 235, height: 180, objectFit: "contain", objectPosition: "center" },
```

- [ ] **Step 2: Rodar smoke + tsc**

Run: `npx vitest run src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx`
Expected: PASS.
Run: `npx tsc --noEmit 2>&1 | Select-String "RtiPdfDocument"`
Expected: sem linhas.

- [ ] **Step 3: Commit**

```bash
git add src/components/rti/pdf/RtiPdfDocument.tsx
git commit -F <mensagem>
```
Mensagem: `fix(rti): foto com moldura fixa + objectFit contain (imagem inteira em retrato e paisagem)`

---

### Task 5: Sumário por setor com página real (render em 2 passagens)

**Files:**
- Modify: `src/components/rti/pdf/RtiPdfDocument.tsx`
- Modify: `src/lib/rti-relatorio-server.tsx:204`
- Test: `src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx`

- [ ] **Step 1: Escrever o teste que falha (2 passagens preenchem o `PdfPageIndex`)**

Acrescentar ao `src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx` (import: `type PdfPageIndex` de `@/lib/rti-relatorio`):

```ts
test("2 passagens preenchem a página inicial de cada setor no PdfPageIndex", async () => {
  const model = buildPdfModel({
    identificacao: {
      titulo: "RTI Usina",
      clienteNome: "Cliente X",
      local: "",
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
      nc({ id: "a", numero: 1, areaNome: "Moagem" }),
      nc({ id: "b", numero: 2, areaNome: "Subestação" }),
    ],
    overrides: {},
    parecer: "Parecer.",
    resumoExecutivo: "Resumo.",
  });
  const pageIndex: PdfPageIndex = { setores: new Map() };
  await renderToBuffer(<RtiPdfDocument model={model} pageIndex={pageIndex} />);
  const pMoagem = pageIndex.setores.get("Moagem");
  const pSub = pageIndex.setores.get("Subestação");
  expect(pMoagem).toBeGreaterThanOrEqual(1);
  expect(pSub).toBeGreaterThan(pMoagem!); // Subestação (nº 2) vem depois de Moagem (nº 1)
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx`
Expected: FAIL — `pageIndex` não é aceito pelo componente / mapa vazio (`pMoagem` undefined).

- [ ] **Step 3: Aceitar o prop `pageIndex`, marcar as páginas e paginar o sumário**

No `RtiPdfDocument.tsx`:

(a) Import — acrescentar `primeirasNcsPorSetor` e o tipo:

```tsx
import {
  PRIORIDADE_LABEL,
  LIMITACOES_PADRAO,
  formatNormasRef,
  sumarioPorSetor,
  primeirasNcsPorSetor,
} from "@/lib/rti-relatorio";
import type { PdfModel, NcParaPdf, PdfPageIndex } from "@/lib/rti-relatorio";
```

(b) Assinatura do componente:

```tsx
export function RtiPdfDocument({
  model,
  pageIndex,
}: {
  model: PdfModel;
  pageIndex?: PdfPageIndex;
}) {
  const cor = model.branding.corPrimaria || PINE;
  const ident = model.identificacao;
  const primeiras = primeirasNcsPorSetor(model.ncs);
```

(c) Estilos do sumário — substituir `sumarioSetor`/`sumarioItem` por uma linha setor↔página:

```tsx
  sumarioLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  sumarioSetor: { fontSize: 11, fontWeight: 600 },
  sumarioPag: { fontSize: 10, color: "#6b7280" },
  marcadorSetor: { height: 0, fontSize: 1, color: "#ffffff" },
```

(d) Página de sumário — substituir o corpo atual (o `sumarioPorSetor(model.ncs).map(...)` que lista NCs) por uma linha por setor com a página:

```tsx
      {model.ncs.length > 0 ? (
        <Page size="A4" style={s.page} bookmark="Sumário">
          <HeaderFooter model={model} />
          <Text style={[s.h2, { color: cor }]}>Sumário — não conformidades por setor</Text>
          {sumarioPorSetor(model.ncs).map((grupo) => (
            <View key={grupo.setor} style={s.sumarioLinha}>
              <Text style={s.sumarioSetor}>{grupo.setor}</Text>
              <Text style={s.sumarioPag}>
                {pageIndex?.setores.get(grupo.setor)
                  ? `pág. ${pageIndex.setores.get(grupo.setor)}`
                  : "—"}
              </Text>
            </View>
          ))}
        </Page>
      ) : null}
```

(e) Marcador de página dentro de `NcConteudo` — passar `primeiras` e `pageIndex` e emitir o marcador na 1ª NC do setor. Ajustar a assinatura e o topo do `NcConteudo`:

```tsx
function NcConteudo({
  nc,
  cor,
  ehPrimeiraDoSetor,
  pageIndex,
}: {
  nc: NcParaPdf;
  cor: string;
  ehPrimeiraDoSetor: boolean;
  pageIndex?: PdfPageIndex;
}) {
  return (
    <View style={s.ncCard}>
      {ehPrimeiraDoSetor && pageIndex ? (
        // Marcador invisível: o callback render recebe o pageNumber desta página
        // e o grava no índice. Efeito colateral idempotente (pode rodar >1x).
        <Text
          style={s.marcadorSetor}
          render={({ pageNumber }) => {
            pageIndex.setores.set(nc.areaNome || "—", pageNumber);
            return "";
          }}
        />
      ) : null}
      <Text style={[s.ncTitulo, { color: cor }]}>
```
(resto do `NcConteudo` inalterado)

(f) Chamada de `NcConteudo` na página da NC:

```tsx
          <NcConteudo
            nc={nc}
            cor={cor}
            ehPrimeiraDoSetor={primeiras.has(nc.id)}
            pageIndex={pageIndex}
          />
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx`
Expected: PASS (smoke + 2 passagens).

- [ ] **Step 5: Render em 2 passagens no servidor**

Em `src/lib/rti-relatorio-server.tsx`, substituir a linha 204:

```tsx
    // 5. Render
    const buffer = await renderToBuffer(<RtiPdfDocument model={model} />);
```

por:

```tsx
    // 5. Render em 2 passagens: a 1ª coleta o nº da página inicial de cada setor
    // (via callback render dos marcadores); a 2ª renderiza o sumário já paginado.
    // Custo ~2x — aceitável na emissão/preview server-side (D-C7).
    const pageIndex = { setores: new Map<string, number>() };
    await renderToBuffer(<RtiPdfDocument model={model} pageIndex={pageIndex} />);
    const buffer = await renderToBuffer(<RtiPdfDocument model={model} pageIndex={pageIndex} />);
```

- [ ] **Step 6: Rodar tsc no server + smoke**

Run: `npx tsc --noEmit 2>&1 | Select-String "rti-relatorio-server|RtiPdfDocument"`
Expected: sem linhas.

- [ ] **Step 7: Commit**

```bash
git add src/components/rti/pdf/RtiPdfDocument.tsx src/lib/rti-relatorio-server.tsx src/components/rti/pdf/__tests__/rti-pdf-render.test.tsx
git commit -F <mensagem>
```
Mensagem: `feat(rti): sumário por setor com página real via render em 2 passagens`

---

### Task 6: Validação final

**Files:** nenhum (só verificação)

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: tudo verde (nenhuma regressão; guard NR-28 e formatNormasRef continuam passando).

- [ ] **Step 2: tsc do projeto**

Run: `npx tsc --noEmit`
Expected: 0 erros novos (comparar com baseline conhecido de erros pré-existentes).

- [ ] **Step 3: eslint dos arquivos tocados**

Run: `npx eslint src/components/rti/pdf/RtiPdfDocument.tsx src/lib/rti-relatorio.ts src/lib/rti-relatorio-server.tsx`
Expected: limpo (rodar `--fix` se só houver formatação do prettier).

- [ ] **Step 4: Preview visual real (opcional, sob pedido)**

Gerar preview de um report com NCs + fotos retrato/paisagem no servidor local (57010) e conferir: uma NC por página, quadro-resumo sem quebra, fotos inteiras, seções rotuladas, recomendação destacada, sumário com páginas por setor.

---

## Self-Review

**Cobertura do feedback:**
- Ponto 1/3 (sumário com página por setor, sem descrição gigante) → Task 5.
- Ponto 2 (quebra: quadro-resumo + títulos soltos) → Task 2 (steps 2-3).
- Ponto 4 (uma NC por página) → Task 2 (step 4).
- Ponto 5 (fotos retrato/paisagem inteiras) → Task 4.
- Ponto 6 (espaçamento/justify, seções, recomendação, evidências) → Task 3.
- Ponto 7 (normas no pipeline) → **fora de escopo** por decisão do usuário; render já pronto.

**Consistência de tipos:** `PdfPageIndex` definido na Task 1 e usado nas Tasks 5; `primeirasNcsPorSetor` (Task 1) usado na Task 5; `NcParaPdf` importado na Task 2 e reusado; `NcConteudo` criado como stub na Task 2, reescrito na Task 3, estendido na Task 5 (assinatura final com `ehPrimeiraDoSetor`/`pageIndex`).

**Sem placeholders:** todos os steps trazem o código real.
