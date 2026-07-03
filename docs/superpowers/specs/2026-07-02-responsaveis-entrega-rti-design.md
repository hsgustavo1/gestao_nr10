# Responsáveis do RTI capturados na entrega

**Data:** 2026-07-02
**Status:** 📝 Spec — aprovado (design), pronto para virar plano.
**Escopo:** `src/routes/rti.importar.tsx`, `src/routes/rti.plano.tsx`,
`src/routes/rti.index.tsx`, `src/routes/campo.inspecao.$id.tsx`
(`ComporRtiDialog`), `src/lib/rti-queries.ts`, `src/lib/campo-queries.ts`
(`comporRti`), RPC `fn_entregar_rti_report`, `rti_reports` (schema),
`src/integrations/supabase/types.ts`.
Branch: `staging`.

## Contexto — isto não é greenfield

Hoje os metadados de responsabilidade do RTI são capturados **na criação**
do relatório, em dois caminhos distintos:

- **Criação manual** (`rti.importar.tsx`): formulário com Responsável pela
  auditoria, Responsável pelo plano de ação e datas de Início/Fim da
  auditoria.
- **Composição a partir do campo** (`comporRti` em `campo-queries.ts:872-886`,
  acionada pelo `ComporRtiDialog` em `campo.inspecao.$id.tsx:1504-1514`):
  captura `coletores_campo` (auto, dos `field_points` do PWA), um
  "Responsável pela auditoria" pré-preenchido com `actorName`, e `periodo`
  a partir da data da inspeção.

Problemas do modelo atual:

1. Pede-se responsabilidade **cedo demais** — na criação, quando ainda não
   se sabe quem vai assinar/entregar. O momento natural para fixar isso é a
   **entrega** do relatório ao cliente.
2. `responsavel_auditoria` é um **único texto**, insuficiente: a inspeção em
   campo pode ter vários responsáveis, e "quem coletou", "quem entrega",
   "quem compôs" e "quem emite a ART" são papéis distintos.
3. O campo `responsavel_auditoria` hoje é **escrito mas nunca exibido** —
   nenhuma tela o renderiza (só `periodo_inicio/fim` aparecem, em
   `rti.index.tsx:213` e `rti.gestao.tsx:89`). É praticamente um campo morto.

**O que já existe e funciona, não precisa ser inventado:**

| Já existe | Onde |
|---|---|
| `rti_reports.coletores_campo text[]` — lista dedup. dos técnicos que coletaram no PWA, populada na composição | `campo-queries.ts:872-881`, coluna criada na migração `20260701020000` |
| `rti_reports.created_by_name` — quem **compôs/criou** o relatório | `campo-queries.ts:885`, `rti.importar.tsx:344/375` |
| Selo de entrega: RPC `fn_entregar_rti_report(_report_id, _entregue_por_org)` carimba `entregue_em=now()` + `entregue_por_org` e cascateia o selo aos filhos | `rti-queries.ts:99-114`, spec `2026-06-19-selo-entrega-rti-design.md` |
| `rti_ncs.responsavel` é coluna **livre** (não congelada pelo selo) | `2026-06-19-selo-entrega-rti-design.md` seção C |
| Botão "Entregar relatório" já gateado a quem bypassa o selo (consultor/dono/owner) e só enquanto `entregue_em IS NULL` | `rti.plano.tsx:333-355` |

## Problema

Mover a captura de responsabilidade do RTI **da criação para a entrega**, e
substituir o campo único `responsavel_auditoria` por um modelo que separa os
papéis reais:

- **Responsáveis pela inspeção em campo** (múltiplos) — quem levantou os
  dados. Vem automático do PWA quando houver, e pode ser complementado à mão.
- **Responsável pelo relatório** — quem está entregando (usuário logado).
- **Responsável Técnico do RTI** — quem emite a ART do relatório (opcional,
  pode não ser nenhum dos anteriores).
- **Responsável pelo plano de ação** — opcional; quando informado, vira o
  responsável default das ações (NCs) do relatório.

## Decisões tomadas nesta sessão (não reabrir sem motivo)

1. **Captura na entrega, não na criação.** Os campos de responsabilidade e as
   datas de início/término da inspeção saem do formulário de criação e do
   `ComporRtiDialog`; passam a ser preenchidos num pop-up disparado pelo botão
   "Entregar relatório".
2. **Todo RTI pressupõe uma inspeção em campo anterior.** Não existe
   "relatório sem inspeção" — a coleta pode ter sido feita fora do PWA, antes
   do app, ou de outra forma, mas sempre existiu. Por isso **Responsáveis pela
   inspeção em campo (≥1)** e **Início/Término** são **obrigatórios** na
   entrega, mesmo em relatórios sem `coletores_campo` (nesses, todos os nomes
   são inseridos à mão).
3. **`responsavel_plano`, quando preenchido, aplica-se apenas às NCs sem
   responsável** — não sobrescreve responsáveis já atribuídos por NC (ex.:
   coluna "Responsável" da planilha importada).
4. **`responsavel_auditoria` é renomeado para `responsavel_tecnico_rti`** e
   ressignificado: opcional, é a pessoa que **emite a ART do RTI**, podendo
   diferir de quem coletou em campo, de quem entregou e de quem criou o
   relatório. A UI deixa esse significado explícito (texto de ajuda).
5. **`ComporRtiDialog` perde o input "Responsável pela auditoria"** — vira
   redundante com a captura na entrega. `comporRti` mantém `coletores_campo` e
   `periodo` automáticos; larga o param `responsavelAuditoria`.
6. **Papel "quem coletou" ≠ "quem é responsável de campo".** Os nomes vindos
   do PWA (`coletores_campo`) são a base automática dos "Responsáveis pela
   inspeção em campo" e **não podem ser removidos** no pop-up; nomes manuais
   são adicionáveis e removíveis. Persistência separada preserva esse
   invariante no próprio schema (ver Requirements P0-3).

## Goals

- O pop-up de entrega captura, de uma vez, os responsáveis e as datas da
  inspeção, e a entrega (`entregue_em`) fixa a data de entrega automaticamente.
- Cada papel tem seu campo, com origem e editabilidade corretas:
  - Responsáveis pela inspeção em campo — auto (travado) + manual, ≥1.
  - Responsável pelo relatório — auto do usuário logado, não editável.
  - Responsável Técnico do RTI — opcional, editável, texto livre.
  - Responsável pelo plano de ação — opcional, editável; se preenchido,
    preenche o `responsavel` das NCs que estão sem responsável.
- Zero regressão no selo: a entrega continua carimbando `entregue_em` +
  `entregue_por_org` e cascateando o congelamento aos filhos.
- O relatório entregue exibe os novos responsáveis no cabeçalho.

## Non-Goals (explícitos)

- **Não** criar tela de edição pós-entrega desses metadados. A captura é na
  entrega; não há requisito de reabrir/editar (consultor/dono ainda podem
  editar via banco por bypass, mas sem UI dedicada nesta fatia).
- **Não** implementar remoção da coluna legada `responsavel_auditoria` além do
  rename para `responsavel_tecnico_rti`.
- **Não** mexer na granularidade de autoria por ponto/achado — coberto pela
  spec `2026-07-01-autoria-coleta-campo-design.md`, já refletida em
  `coletores_campo`.
- **Não** alterar o modelo de papéis/entitlements do selo — só se **consome**
  o gate `canEntregar` já existente.
- **Não** gerar PDF novo; apenas exibição em tela do cabeçalho do RTI.

## User Stories

- Como consultor que entrega um RTI, quero informar num único pop-up quem fez
  a inspeção em campo, quem emite a ART e (opcionalmente) o responsável do
  plano de ação, sem ter definido isso lá na criação.
- Como consultor que compôs o RTI a partir de coleta de dois técnicos, quero
  que os dois nomes já venham preenchidos como responsáveis de campo, sem
  poder removê-los por engano, e poder acrescentar um terceiro à mão.
- Como cliente que recebe o relatório, quero ver no cabeçalho quem inspecionou,
  quem é o responsável técnico (ART) e a data de entrega.

## Requirements

### P0 — Must-have

1. **Remover da criação (`rti.importar.tsx`)** os campos: Responsável pela
   auditoria, Responsável pelo plano de ação, Início/Fim da auditoria. Manter
   Título*, Empresa auditora, Planilha e os botões. `criarVazio()` e
   `importar()` deixam de enviar esses campos (ficam `null`).

2. **Remover o input "Responsável pela auditoria" do `ComporRtiDialog`**
   (`campo.inspecao.$id.tsx:1504-1514`) e o estado associado. `comporRti`
   (`campo-queries.ts`) larga o parâmetro `responsavelAuditoria` e para de
   gravar `responsavel_auditoria`/`responsavel_tecnico_rti` na composição
   (fica `null`; será definido na entrega). Mantém `coletores_campo` e
   `periodo` automáticos.

3. **Schema `rti_reports`** (migration via MCP `apply_migration`, versionada em
   `supabase/migrations/`, `types.ts` à mão):
   - **Rename** `responsavel_auditoria` → `responsavel_tecnico_rti` (`text`,
     nullable). Continua nullable/opcional.
   - **Nova** `responsaveis_campo_extra text[]` nullable — nomes de
     responsáveis de campo adicionados manualmente na entrega.
   - **Nova** `responsavel_relatorio text` nullable — nome de quem entregou.
   - `coletores_campo text[]` (existe) — fonte automática, **nunca editada**
     pelo pop-up. Lista final de responsáveis de campo exibida =
     `coletores_campo ∪ responsaveis_campo_extra` (dedup, ordem: auto antes
     dos manuais).
   - `responsavel_plano text` (existe) — opcional.
   - `periodo_inicio` / `periodo_fim` (existem) — início/término da inspeção.
   - `entregue_em` (existe) — data de entrega.

4. **Pop-up "Entregar relatório" (`rti.plano.tsx`)** — substitui o
   `window.confirm` atual (linhas 339-351) por um `Dialog` (shadcn). Campos, na
   ordem:

   | # | Campo | Origem / comportamento | Editável | Obrigatório |
   |---|---|---|---|---|
   | 1 | Responsáveis pela inspeção em campo | chips travados = `coletores_campo` (auto PWA, sem X) + adicionar manuais (Enter/vírgula → chip removível) | auto: não · manual: sim | sim (≥1 total) |
   | 2 | Responsável pelo relatório | usuário logado (`actorName`) | não | auto |
   | 3 | Responsável Técnico do RTI | vazio; ajuda: *"Pessoa que emitirá a ART do RTI. Pode ser diferente de quem coletou em campo, entregou ou criou o relatório."* | sim | não |
   | 4 | Responsável pelo plano de ação | vazio; nota: *"Se preenchido, será aplicado às ações sem responsável definido."* | sim | não |
   | 5 | Início da inspeção | `periodo_inicio` (pré-preenchido em relatórios de campo) | sim | sim |
   | 6 | Término da inspeção | `periodo_fim` | sim | sim |
   | 7 | Data de entrega | hoje (`now()`) | não | auto |

   - **Label plural:** campo 1 exibe "Responsável pela inspeção em campo" com
     1 nome e "**Responsáveis** pela inspeção em campo" com >1.
   - Mantém a nota de congelamento do selo ("após entregar, o cliente não
     altera o registro técnico…").
   - Botão "Entregar" **desabilitado** até: ≥1 responsável de campo + início +
     término preenchidos.
   - **O `window.confirm` de congelamento pode permanecer após o pop-up.**
     Fluxo permitido: usuário preenche o pop-up → clica "Entregar" (validação
     de obrigatórios) → `window.confirm` reconfirma o efeito irreversível do
     selo → só então dispara a RPC. O `confirm` não substitui o pop-up nem
     duplica a nota; é a última barreira antes de congelar o registro para o
     cliente.

5. **RPC `fn_entregar_rti_report` estendida** — nova assinatura, tudo numa
   transação:
   ```
   fn_entregar_rti_report(
     _report_id uuid,
     _entregue_por_org uuid,
     _responsaveis_campo_extra text[],
     _responsavel_relatorio text,
     _responsavel_tecnico_rti text,   -- null se vazio
     _responsavel_plano text,         -- null se vazio
     _periodo_inicio date,
     _periodo_fim date
   )
   ```
   Passos:
   1. `UPDATE rti_reports` grava `responsaveis_campo_extra`,
      `responsavel_relatorio`, `responsavel_tecnico_rti`, `responsavel_plano`,
      `periodo_inicio`, `periodo_fim`, `entregue_em = now()`,
      `entregue_por_org = _entregue_por_org`.
   2. Se `_responsavel_plano` não nulo:
      `UPDATE rti_ncs SET responsavel = _responsavel_plano
       WHERE report_id = _report_id
         AND (responsavel IS NULL OR btrim(responsavel) = '')`.
      (`responsavel` é coluna livre no selo → passa pelo trigger.)
   3. Cascata do selo aos filhos, **exatamente como hoje** (não regredir).

   `useEntregarRtiReport` (`rti-queries.ts:99`) passa os novos argumentos;
   assinatura do hook cresce para receber o payload do pop-up.

6. **Exibição no relatório entregue.** No cabeçalho do RTI
   (`rti.index.tsx`, junto ao `periodo`/badge de entrega) mostrar, quando
   existirem: "Responsáveis pela inspeção em campo" (lista unificada),
   "Responsável pelo relatório", "Responsável Técnico do RTI" e "Entregue em
   DD/MM/AAAA". Início/término continuam via `periodo`.

### P1 — Nice-to-have

- Exibir também na `rti.gestao.tsx` (lista) um resumo discreto de "Entregue em"
  / responsável técnico quando presente.

### P2 — Future considerations (não construir agora)

- Tela de edição pós-entrega dos responsáveis (para consultor corrigir sem ir
  ao banco).
- Descontinuar de vez o conceito antigo, migrando `responsavel_tecnico_rti`
  para tabela normalizada se surgir consumidor estruturado (ART, integração).
- Aplicar o mesmo pop-up de entrega a outros módulos do selo (LOTO).

## Open Questions

Nenhuma pendente — resolvidas nesta sessão:

- Aplicação de `responsavel_plano`: só nas NCs sem responsável (P0-5.2).
- Obrigatoriedade de responsáveis de campo + datas na entrega: sim, sempre
  (decisão 2).
- Papel do antigo `responsavel_auditoria`: renomeado para
  `responsavel_tecnico_rti`, opcional, = emissor da ART (decisão 4).
- Remoção do campo redundante no `ComporRtiDialog`: sim (decisão 5).
- Exibição no cabeçalho do relatório: incluída nesta fatia (P0-6).

## Validação

- **Local primeiro** (preview na porta 57010, servidor do usuário — só
  leitura/interação, sem start/stop): criar relatório (import e em branco),
  abrir Plano de Ação, clicar "Entregar relatório", validar:
  - chips de `coletores_campo` travados (sem X) + adição/remoção de manuais;
  - label singular/plural;
  - obrigatoriedade (botão desabilitado sem ≥1 campo/início/término);
  - "Responsável pelo relatório" e "Data de entrega" travados;
  - após entregar: `responsavel_plano` preencheu só NCs vazias; cabeçalho do
    RTI exibe os novos responsáveis; selo continua congelando os filhos.
- **Sem commit/push** (staging ou main) até comando explícito do usuário.

## Timeline

- Sem prazo externo. Pronta para virar plano de implementação.
