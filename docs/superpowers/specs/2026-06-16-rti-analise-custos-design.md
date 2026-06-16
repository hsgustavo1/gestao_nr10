# Melhoria da Análise de Custos (RTI) — Design

- **Data:** 2026-06-16
- **Status:** Aprovado (pronto para plano de implementação)
- **Telas:** `/rti/custos` (Análise de Custos), `/rti/plano` (Plano de Ação), `/rti` (Dashboard RTI)

## Contexto e problema

A tela de Análise de Custos ([rti.custos.tsx](../../../src/routes/rti.custos.tsx)) já agrega custo planejado vs realizado por setor/prioridade/tipo com cross-filtering. Três lacunas:

1. **"Ver no Plano" não filtra por custo.** O link carrega apenas setor/prioridade/tipo e cai em *todas* as ações do recorte. A intenção da tela é custo: deveria levar só às ações com **custo declarado** (planejado ≠ null, incluindo 0). O Plano hoje não tem dimensão "custo".
2. **Execução do orçamento engana.** O card usa `realizado/planejado` e `max(0, planejado − realizado)` como "restante". Isso (a) esconde **estouro** (realizado > planejado) e (b) trata **economia de ação concluída** como se fosse orçamento em aberto. Falta separar o que já é **realizado final** (com estouro/economia líquidos) do que ainda é **orçamento em aberto** (ações não concluídas).
3. **Falta visão de andamento por custo.** Não há gráfico mostrando o progresso de conclusão segmentado por presença de custo — em especial das ações **sem investimento** (custo zero), que deveriam fechar rápido.

## Decisões (definidas no brainstorming)

- **Detalhe do orçamento:** bruto + líquido (Estourado R$ · Economizado R$ · Saldo líquido ±R$).
- **Gráfico de andamento por custo:** fica no **Dashboard RTI** (`/rti`), não na tela de custos (é contagem de conclusão, combina com os demais gráficos de status de lá; mantém a tela de custos focada em R$).
- **Visualização do orçamento:** Abordagem A — cards redefinidos + barra de execução compacta (evolução do grid de 4 cards já existente).
- **Restrição de UI:** a skill `ui-ux-pro-max` pode refinar o visual, mas **dentro do macro/padrão existente** da tela (cards shadcn, paleta e tipografia atuais). Não reinventar layout nem introduzir padrão novo fora do que já existe.

## Objetivos

- "Ver no Plano" (da tela de custos) leva apenas às NCs com custo declarado.
- O gestor enxerga, de relance: quanto já foi **realizado** (com estouro/economia líquidos), quanto está **em aberto**, e a **projeção total** vs o **planejado original**.
- O gestor vê o **andamento de conclusão por grupo de custo** (com custo vs custo zero), destacando o progresso das ações sem investimento.

## Não-objetivos

- Nenhuma mudança de banco/schema — tudo derivado de `custo_planejado`, `custo_realizado` e `status`, que já existem em `rti_ncs`.
- Não alterar **como** custos são lançados (já existem no detalhe da NC e na ação em massa do Plano).
- Não adicionar previsão/forecast além de "em andamento conclui no valor previsto".

---

## Seção 1 — Filtro de custo no Plano + correção do "Ver no Plano"

### Dimensão `custo` no Plano (`rti.plano.tsx`)

- Adicionar `custo` ao `planoSearchSchema`: `z.string().optional().default("all")`.
- Valores e predicado:
  - `all` — sem filtro.
  - `informado` — `custo_planejado != null` (**inclui 0**). É "ações com custo declarado".
  - `sem` — `custo_planejado == null` (não informado).
  - `zero` — `custo_planejado === 0`.
- Adicionar um `<Select>` "Custo" na barra de filtros do Plano (mesmo padrão dos selects existentes), com as opções acima.
- Aplicar o predicado no `useMemo` de filtragem da lista, junto dos demais filtros.
- Incluir `custo` na limpeza de filtros ("Limpar") e no cálculo de `hasFilters`.

### Links da tela de custos (`rti.custos.tsx`)

- `planoSearch` passa a incluir `custo: "informado"` (sempre — a tela é sobre custo).
- O botão de rodapé "Abrir as N NCs deste recorte" passa a usar a contagem **com custo informado** (`resumo.comCusto`) e o texto vira "Abrir as N NCs com custo no Plano", para bater com o que o link de fato mostra.

---

## Seção 2 — Modelo de orçamento + cards + barra de execução

### Modelo de cálculo (função pura)

Extrair para uma função pura `computeBudget(ncs)` em [rti.ts](../../../src/lib/rti.ts), recebendo as NCs **já filtradas** (a tela continua aplicando setor/prioridade/tipo antes). Considera para R$ apenas NCs com `custo_planejado != null` (custo zero conta como informado com valor 0). Definições:

- `concluida` ≡ `status === "concluida"`; `naoConcluida` ≡ pendente ou em_andamento.
- **realizado** = Σ `custo_realizado` das concluídas **com `custo_realizado != null`**.
- **emAberto** = Σ `custo_planejado` das não-concluídas (previsto a gastar; em andamento assume o previsto).
- **estourado** = Σ `max(0, realizado − planejado)` nas concluídas (ambos informados).
- **economizado** = Σ `max(0, planejado − realizado)` nas concluídas (ambos informados).
- **saldoLiquido** = `estourado − economizado` (positivo = estouro; negativo = economia).
- **planejadoTotal** = Σ `custo_planejado` de todas as informadas.
- **realizadoAInformar** = contagem de concluídas com `custo_planejado != null` e `custo_realizado == null` (não entram no saldo; não assumem zero).
- **projecaoTotal** = `realizado` + `emAberto` + Σ `custo_planejado` das concluídas-sem-realizado (para não subestimar a projeção).
- **desvioProjecao** = `projecaoTotal − planejadoTotal`.

A função retorna esse objeto; a tela formata com `formatBRL`.

### UI (cards — mantém o grid shadcn atual)

Linha de 4 cards no topo (responsivo como hoje):

1. **Realizado** — `formatBRL(realizado)` · sub: "X NC(s) concluída(s)" (+ "Y a informar" quando `realizadoAInformar > 0`).
2. **Em aberto** — `formatBRL(emAberto)` · sub: "Z NC(s) a executar (no previsto)".
3. **Saldo** — exibe **Estourado** `formatBRL(estourado)` · **Economizado** `formatBRL(economizado)` · **Líquido** `±formatBRL(|saldoLiquido|)`, com o líquido colorido (vermelho = estouro, verde = economia, neutro = zero).
4. **Projeção total** — `formatBRL(projecaoTotal)` · sub: "Planejado `formatBRL(planejadoTotal)` · {±`formatBRL(|desvioProjecao|)`}" colorido conforme estouro/economia.

### Barra de execução (abaixo dos cards)

- Barra horizontal compacta empilhando **Realizado | Em aberto**, baseada em div/flex (sem recharts — é uma barra única; mais leve e nítida).
- A ponta de **estouro** (parte do realizado acima do planejado) é destacada em cor de alerta.
- Marcador/linha de referência no **Planejado original** para leitura visual de "passou/ficou abaixo".
- Rótulos com os valores principais.

### Mantido

O bloco "NCs no recorte" (com custo informado / sem custo informado / custo zero executável) permanece — o usuário considerou essa parte ok. Todos os números reagem aos filtros ativos, como hoje.

---

## Seção 3 — Gráfico de andamento por custo (Dashboard RTI)

Novo card em [rti.index.tsx](../../../src/routes/rti.index.tsx), dentro do grid de gráficos (paleta atual do dashboard). Usa as NCs do relatório ativo. Agregação como função pura `computeAndamentoPorCusto(ncs)` em [rti.ts](../../../src/lib/rti.ts):

- **Com custo** = NCs com `custo_planejado > 0` → `{ total, concluidas }`.
- **Custo zero** = NCs com `custo_planejado === 0` → `{ total, concluidas }`.
- **Exclui** NCs com `custo_planejado == null` (custo não definido).

UI: barras agrupadas (recharts, como os demais gráficos), 2 grupos (Com custo / Custo zero) × 2 barras (Total / Concluídas), com **% de conclusão por grupo** rotulado. Mensagem de apoio: ações de custo zero (sem investimento) deveriam fechar rápido; baixo % nelas sinaliza fruta-no-chão não colhida.

---

## Arquitetura e qualidade

- **Funções puras** em `rti.ts`: `computeBudget(ncs)` e `computeAndamentoPorCusto(ncs)`. Isolam o cálculo da renderização → testáveis e reutilizáveis (custos usa a 1ª; dashboard usa a 2ª).
- **Testes unitários** em `src/lib/__tests__/` cobrindo: estouro, economia, misto, concluída-sem-realizado, em aberto (pendente + em andamento), custo zero, custo não informado (null), recorte vazio.
- Predicado de filtro `custo` no Plano também como helper puro pequeno (ex.: `matchCustoFiltro(nc, modo)`), reutilizável/testável.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/rti.ts` | `computeBudget`, `computeAndamentoPorCusto`, helper de filtro de custo |
| `src/routes/rti.plano.tsx` | dimensão `custo` (schema + select + predicado + limpar/hasFilters) |
| `src/routes/rti.custos.tsx` | usa `computeBudget`; novos cards + barra; links passam `custo:"informado"`; contagem do botão de rodapé |
| `src/routes/rti.index.tsx` | usa `computeAndamentoPorCusto`; novo card de gráfico |
| `src/lib/__tests__/*` | testes das funções puras |

## Riscos e edge cases

- **Concluída sem `custo_realizado`**: tratada como "realizado a informar" (fora do saldo; projeção usa o planejado). Evita "100% de economia" falsa.
- **Recorte sem NCs com custo**: cards/barra mostram zero/—; já há mensagem de "nenhuma NC com custo informado" que se mantém.
- **Consistência do link**: a contagem do botão de rodapé deve refletir o filtro `informado` aplicado (usar `resumo.comCusto`), senão o número não bate com a lista aberta.
- **Multi-tenant**: nada novo — as queries de RTI já são escopadas por org (Fase 1.5); este trabalho é só de apresentação/derivação.

## Fora de escopo (futuro)

- Forecast/curva-S de orçamento ao longo do tempo.
- Exportação específica de custos (o Plano já exporta XLSX).
