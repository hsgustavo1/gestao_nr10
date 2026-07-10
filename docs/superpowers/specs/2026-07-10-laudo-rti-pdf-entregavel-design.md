# Laudo RTI — Sub-spec 2: PDF entregável (Design)

**Data:** 2026-07-10
**Status:** Aprovado (brainstorming) — pronto para plano de implementação
**Autor:** Gustavo + Claude
**Base:** [[2026-07-10-laudo-rti-fundacao-normas-schema-design]] (sub-spec 1, já implementada)

---

## Contexto

A sub-spec 1 criou o **dado** (catálogo de normas versionado + campos `titulo`/`normas`/
`situacao_atual`/`gravidade_nr28_override` na NC, `norma_versao` no report). Esta sub-spec
usa esse dado para **reformular o PDF entregável** — o laudo que o cliente recebe.

Os problemas concretos levantados pelo fundador sobre o laudo atual:

1. **Fotos cortadas abruptamente** — `objectFit:"cover"` (linha 51 do `RtiPdfDocument.tsx`) corta a imagem para preencher um quadro fixo 160×120.
2. **Layout pobre para um relatório técnico** — falta front matter (escopo, referencial, metodologia, limitações) e um índice.
3. **Sem índice/sumário** — num laudo de centenas de NCs, não há como navegar; as NCs deveriam estar organizadas por setor.
4. **Dado novo não aparece** — título, normas e situação atual da NC (criados na sub-spec 1) não são renderizados.

### Decisão de escopo (confirmada)

Esta passada **enriquece o laudo único** (o `RtiPdfDocument` atual). A divisão em
**volumes derivados** (Volume I Gestão / Volume II Campo / Compilado) fica para a
**sub-spec 3**, porque o Volume I depende do dado de gestão (`conformidade.ts`), que é
responsabilidade daquela sub-spec. Não há valor em montar a casca multi-volume agora com
o Volume I vazio.

### Restrição da ferramenta que molda o design

O `@react-pdf/renderer` **não resolve de forma confiável o número da página em que um
elemento de conteúdo caiu** (o callback `render({ pageNumber })` só funciona em elementos
`fixed`, como header/footer). Logo, **um sumário com "NC → página" não é viável.** A
navegação é feita por **bookmarks** (outline do PDF, clicável em qualquer leitor, via a
prop `bookmark` do `@react-pdf`), complementada por um **índice impresso agrupado por
setor** que lista nº + título de cada NC (sem número de página).

---

## Escopo

### Entra nesta sub-spec

- **Fix da foto:** `cover` → `contain`, preservando a foto inteira e sua proporção.
- **Render dos campos da NC:** `titulo` (cabeçalho da NC, com fallback), `normas[]` (linha "Referência normativa"), `situacao_atual` ("Situação atual", quando preenchida).
- **Sumário por setor:** página de índice agrupando NCs por área, + bookmarks navegáveis (setor → NC).
- **Front matter técnico:** objeto/escopo, referencial normativo, metodologia, limitações/ressalvas.
- **Guard NR-28:** garantir por teste que nenhuma gravidade/código NR-28 entra no modelo do PDF.
- Helpers puros novos em `rti-relatorio.ts` + testes.

### Fica de fora (explícito)

- **Volumes derivados / Volume I (gestão):** sub-spec 3.
- **Tela de exposição NR-28 com permissão por usuário:** sub-spec 3.
- **UI de captura de `titulo`/`normas` na NC:** as telas de edição/wizard que gravam esses campos são de outra frente; aqui o PDF apenas **consome** o que existir (default: título ausente → fallback; normas `[]` → linha omitida).
- **Branding white-label UI:** sub-spec 4 (o motor já suporta `OrgBranding`).

---

## Design

### 1. Foto: `cover` → `contain` (`RtiPdfDocument.tsx`)

Hoje:

```ts
foto: { width: 160, height: 120, objectFit: "cover", borderRadius: 3 }
```

`cover` preenche o quadro cortando o excedente. Troca para preservar a foto inteira:

```ts
fotoBox: {
  width: 160,
  height: 120,
  borderRadius: 3,
  backgroundColor: "#f3f4f6", // letterbox suave quando a proporção não bate
  alignItems: "center",
  justifyContent: "center",
},
foto: { maxWidth: 160, maxHeight: 120, objectFit: "contain" },
```

A foto vai dentro de um `View` (`fotoBox`) e a `Image` usa `contain` — a imagem inteira
aparece, com no máximo uma leve faixa de fundo quando a proporção difere de 4:3. A redução
de resolução via CDN (`urlFotoReduzida`, 600px q55) **permanece** — resolve tamanho do
arquivo; o corte era problema separado, de layout.

### 2. Campos da NC no render (`RtiPdfDocument.tsx`)

O modelo já entrega `titulo`, `normas`, `situacaoAtual` (sub-spec 1). Render:

- **Cabeçalho da NC:** se `titulo` existir → `NC 001 — <titulo>`; senão mantém o formato atual `NC 001 — <PRIORIDADE_LABEL>`. A prioridade vai para a linha de meta (já existe `ncMeta`).
- **Referência normativa:** se `normas.length > 0`, uma linha `Referência normativa: <formatNormasRef(normas)>`. NR-28 **não** participa (só `tipo` nr10/nbr/outra).
- **Situação atual:** se `situacaoAtual` truthy, uma linha `Situação atual: <texto>`.

Formatação das normas — helper puro:

```ts
// "10.2.4.g" (nr10) e "NBR 5410 6.1.8.1" (nbr/outra) → "NR-10 10.2.4.g; NBR 5410 6.1.8.1"
export function formatNormasRef(normas: NormaRef[]): string;
```

Regra: `tipo:"nr10"` vira `"NR-10 " + ref`; `nbr`/`outra` usam `ref` como está; junta com `"; "`.

### 3. Sumário por setor + bookmarks

**Índice impresso** — nova página após o front matter, antes das NCs. Agrupa as NCs por
`areaNome`, na ordem em que os setores aparecem, listando `NC 001 — <titulo|—>` por linha.
Helper puro para o agrupamento:

```ts
export interface SumarioSetor {
  setor: string;
  ncs: { numero: number; rotulo: string }[]; // rotulo = titulo ?? descricao curta
}
export function sumarioPorSetor(ncs: NcParaPdf[]): SumarioSetor[];
```

Ordena setores pela primeira aparição; dentro do setor, por `numero`. `rotulo` = `titulo`
quando houver, senão os primeiros ~80 chars de `descricao` (sem cortar no meio de palavra).

**Bookmarks (navegação real)** — no render, cada página/grupo de NCs recebe `bookmark`:
o setor como bookmark de 1º nível, cada NC como filho. Usa a prop `bookmark` do
`@react-pdf` (`bookmark={{ title, parent }}` ou string). Isso gera o outline navegável do
PDF sem depender de número de página.

### 4. Front matter técnico

Reaproveita a página 2 atual (Introdução/Metodologia) e a expande para a estrutura de um
laudo técnico (inspirada no modelo DPST):

1. **Objeto e escopo** — texto do `ident.introducao` (template já existe).
2. **Referencial normativo** — `ident.normas` (texto livre atual) renderizado como bloco próprio.
3. **Metodologia** — `ident.metodologia` (template já existe).
4. **Limitações e ressalvas** — parágrafo novo, renderizado a partir da constante `LIMITACOES_PADRAO` (em `rti-relatorio.ts`), deixando claro que o laudo reflete as condições observadas na data da inspeção e não substitui projeto/ART. **Não** vira campo de `WizardIdentificacao` nesta passada (evita repetir o fan-out da sub-spec 1, que quebraria todos os sites de construção do tipo); torná-lo editável no wizard fica para depois.

O quadro-resumo por prioridade (já existe) permanece.

### 5. Guard NR-28 (nunca no entregável)

O `PdfModel`/`NcParaPdf` **não têm** campo de gravidade NR-28 — e não devem ganhar. Um
teste de contrato garante isso, falhando se alguém adicionar uma chave que case
`/gravidade|nr28|nr-28/i` ao objeto entregue ao PDF:

```ts
test("nenhum campo de gravidade NR-28 vaza para o modelo do PDF", () => {
  const nc = /* NcParaPdf de exemplo */;
  const chaves = Object.keys(nc).join(" ").toLowerCase();
  expect(chaves).not.toMatch(/gravidade|nr28|nr-?28/);
});
```

---

## Componentes e arquivos

| Arquivo | Mudança |
|---|---|
| `src/lib/rti-relatorio.ts` | + `formatNormasRef`, `sumarioPorSetor`, `SumarioSetor`, `LIMITACOES_PADRAO`; `WizardIdentificacao` ganha `limitacoes` (template) |
| `src/lib/__tests__/rti-relatorio.test.ts` | testes dos helpers + guard NR-28 |
| `src/components/rti/pdf/RtiPdfDocument.tsx` | foto contain, cabeçalho/normas/situação por NC, página de sumário, bookmarks, bloco de limitações |
| `src/lib/rti-relatorio-server.tsx` | passa `limitacoes` para o modelo (se aplicável) |
| `src/routes/rti.relatorio.$reportId.wizard.tsx` | (se o wizard editar limitações) — mínimo; pode usar só o template |

Puro (`rti-relatorio.ts`) testado isolado; o `RtiPdfDocument` é validado gerando o PDF de
preview e conferindo que renderiza sem erro (teste de escala já existe no projeto).

---

## Decisões (registro auditável)

| # | Pergunta | Opções | Escolha | Razão |
|---|---|---|---|---|
| 1 | Escopo desta passada | (a) enriquecer laudo único; (b) montar multi-volume já | **a** | Volume I depende do dado de gestão (sub-spec 3); casca vazia agora não entrega valor |
| 2 | Corte da foto | cover / contain | **contain** | Preserva a foto inteira e a proporção (pedido explícito); redução de resolução continua via CDN |
| 3 | Navegação do laudo | sumário com página / bookmarks + índice sem página | **bookmarks + índice por setor** | `@react-pdf` não resolve página de conteúdo de forma confiável; bookmark é clicável em qualquer leitor |
| 4 | Rótulo da NC no índice | título / descrição | **título, com fallback p/ descrição curta** | Título é o campo próprio (DIAGNERG Campo 3); legado sem título usa descrição |
| 5 | Gravidade NR-28 no PDF | expor / nunca | **nunca — guard por teste** | Entregável não pode virar auto de infração pré-preenchido (decisão da sub-spec 1) |
| 6 | Limitações/ressalvas | campo editável no wizard / constante renderizada | **constante `LIMITACOES_PADRAO`** | Padroniza o laudo sem tocar `WizardIdentificacao` (evita fan-out); editável no wizard fica para depois |

---

## Próximos passos

1. Plano de implementação desta sub-spec (skill writing-plans).
2. Sub-spec 3 (camada de gestão / Volume I a partir de `conformidade.ts` + tela de exposição NR-28 com permissão por usuário + divisão em volumes derivados).
3. Sub-spec 4 (branding white-label UI).
