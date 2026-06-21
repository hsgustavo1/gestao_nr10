# MVP polish — menu por papel, home por papel e Evolução mensal do RTI

**Data:** 2026-06-21
**Status:** ✅ Implementado (migration `20260621000000` aplicada via MCP; cron
`rti-monthly-snapshot` ativo; backfill do mês corrente capturado).
**Escopo:** três mudanças coesas para aproximar o app da entrega do MVP
(módulos vendidos: **RTI** e **Pessoas**). Itens independentes, um só spec.

## Contexto

O app nasceu no LOTO (bloqueio) e cresceu para gestão NR-10 completa. Virando
SaaS, o **dono do app** (platform admin / Empresa Principal `is_root`) vê tudo;
**consultor e clientes** só compram RTI + Pessoas no MVP. Três ajustes:

1. **Menu por papel** — esconder do não-dono o que ele não compra.
2. **Home por papel** — a home ainda é o dashboard de LOTO; não-dono não deveria
   cair nela.
3. **RTI — Evolução mensal** — novo menu mostrando a evolução de ações e custo
   mês a mês (snapshot do estado a cada fechamento de mês).

## A. Menu por papel

Gate único: `auth.isPlatformAdmin` (= dono do app). Em
[`src/components/site-header.tsx`](../../../src/components/site-header.tsx), tanto
a nav desktop quanto o Sheet mobile:

- **Dono:** tudo como hoje (RAC, NR-10, RTI, Inspeções, Pessoas, EPIs).
- **Demais (consultor/cliente):** só **RTI** (`RTIDropdown`, que já se auto-esconde
  sem entitlement) + **Pessoas** (`QualDropdown`). Some RAC, NR-10, Inspeções, EPIs.

Escopo = **visibilidade de menu**. As rotas continuam existindo (deep-link
funciona, mas sem dado por RLS). Bloqueio por rota está fora do MVP — risco baixo,
é UI pura.

## B. Home por papel

Em [`src/routes/index.tsx`](../../../src/routes/index.tsx), antes de pintar:

- **Autenticado e não-dono** → redireciona pro módulo principal:
  `/rti` se tem RTI (`getRtiCampoAccess.canView`), senão `/qualificacoes`.
- **Dono / público / viewer** → home atual (LOTO) **inalterada**.

Renderiza `null` enquanto `auth` resolve (sem flash). **Não** se constrói a home
NR-10 dedicada agora — só o atalho. Anotar no ROADMAP "home NR-10 dedicada" para
revisitar com detalhamento maior. Não mexe no comportamento público.

## C. RTI — Evolução mensal

### Princípio

Reusa o padrão de snapshot mensal que já existe
([`compliance_snapshots`](../../../supabase/migrations/20260611500000_compliance_snapshots.sql)
/ [`snapshots.ts`](../../../src/lib/snapshots.ts)), mas **org-scoped** e com grão
**por relatório** — o que dá o filtro "Todos ↔ individual" de graça e reaproveita
a [visibilidade-por-entrega](2026-06-20-visibilidade-por-entrega-design.md).
Diferente do `compliance_snapshots` (lazy, client-side, single-tenant), a captura
do RTI é **server-side agendada** (`pg_cron`), fiel ao "fechamento de mês".

### Tabela `public.rti_snapshots`

Grão **(org_id, report_id, snapshot_date)** — um registro por relatório por mês:

```
id           uuid PK
org_id       uuid NOT NULL  REFERENCES organizations(id)
report_id    uuid NOT NULL  REFERENCES rti_reports(id) ON DELETE CASCADE
snapshot_date date NOT NULL          -- sempre o 1º do mês
payload      jsonb NOT NULL
created_at   timestamptz DEFAULT now()
UNIQUE(report_id, snapshot_date)
INDEX (org_id, snapshot_date)
```

**RLS SELECT:** `can_access_org(uid, org_id) AND fn_report_delivery_visible(uid, report_id)`
— reusa o resolver da visibilidade-por-entrega. Cliente só vê o histórico de
relatórios **entregues**; "Todos" soma os visíveis; ao entregar um relatório, o
histórico passado dele aparece retroativo. Sem INSERT/UPDATE/DELETE para
`authenticated` — captura é `SECURITY DEFINER`.

### Payload por linha

Espelha `computeBudget`/`computeAndamentoPorCusto` de
[`rti.ts`](../../../src/lib/rti.ts), calculado em SQL:

```jsonc
{
  "ncs_total": 12,
  "por_status":     { "pendente": 5, "em_andamento": 4, "concluida": 3 },
  "por_prioridade": { "1": 2, "2": 3, "3": 4, "4": 3 },
  "vencidas": 2,                       // prazo < snapshot_date e não concluída
  "custo": {
    "planejado_total": 150000,         // Σ custo_planejado informado (inclui 0)
    "realizado": 42000,                // Σ custo_realizado informado
    "em_aberto": 80000,                // Σ planejado das não-concluídas s/ realizado
    "saldo_liquido": -3000             // estourado − economizado (concluídas)
  }
}
```

### Captura (`pg_cron`, 1º do mês)

- `CREATE EXTENSION IF NOT EXISTS pg_cron;` (disponível, 1.6.4, ainda não instalada).
- `fn_capture_rti_snapshots(_data date DEFAULT date_trunc('month', now())::date)`
  — `SECURITY DEFINER`. Varre todo `rti_report` com ≥1 NC, agrega de `rti_ncs` em
  SQL, faz **upsert idempotente** (`ON CONFLICT (report_id, snapshot_date)`). Roda
  fora de RLS → estado completo (provença independe de entrega; RLS filtra na
  leitura).
- `cron.schedule('rti-monthly-snapshot', '0 3 1 * *', $$ SELECT public.fn_capture_rti_snapshots(); $$)`
  — 03:00 do dia 1.
- **Backfill no deploy:** a migration chama `fn_capture_rti_snapshots()` 1× → o mês
  corrente já vira o primeiro ponto. Histórico passado **não** é reconstruído
  (`rti_nc_historico` é incompleto p/ isso) — o gráfico enche daqui pra frente.

### Front

- `src/lib/rti-snapshots.ts` — tipos (`RtiSnapshotPayload`, `RtiSnapshotRow`) +
  `aggregateSnapshotsByMonth(rows, filtro: "all" | reportId)` puro/testado:
  para "all" soma os relatórios visíveis do mês; para um relatório, seleciona.
  Saída pronta para os gráficos (`{ mes, ...metrics }[]`).
- hook `useRtiSnapshots(orgId)` em `src/lib/campo-queries.ts`/`rti`-queries (lê a
  tabela já filtrada por RLS; ordena por `snapshot_date`).
- rota `src/routes/rti.evolucao.tsx` — filtro (Todos / por relatório) + 3 gráficos
  reusando o `ChartContainer` (recharts) de
  [`rti.custos.tsx`](../../../src/routes/rti.custos.tsx):
  1. **Ações por status** — área empilhada por mês (pendente/em_andamento/concluída).
  2. **Progresso** — linha de % concluída.
  3. **Custo** — planejado × realizado × em aberto + saldo.
  Guard de rota `getRtiCampoAccess.canView` (igual às demais rotas RTI).
- menu: "Evolução mensal" no `RTIDropdown` + grupo RTI mobile, após "Análise de
  Custos". Gateado pelo grupo RTI (canView).

### Testes

- Unit: `aggregateSnapshotsByMonth` (soma multi-relatório, seleção individual, vazio).
- SQL: `fn_capture_rti_snapshots` produz agregados corretos para um relatório-seed;
  matriz RLS — cliente **não** vê snapshot de relatório não entregue, vê após
  entrega; cliente B isolado.

## Fora de escopo / riscos (YAGNI)

- **Home NR-10 dedicada:** adiada (item B só redireciona). Anotada no ROADMAP.
- **Histórico retroativo do RTI:** não reconstruído; trend cresce a partir do deploy.
- **Bloqueio por rota** para não-dono: só o menu esconde; deep-link continua (sem
  dado por RLS).
- **Snapshot por unidade/hierarquia profunda:** herda o mesmo limite já registrado
  da visibilidade-por-entrega (1 nível).

## Convenções

- Migration aplicada via **MCP** (`apply_migration`); `.sql` versionado em
  `supabase/migrations/`. `types.ts` à mão (`rti_snapshots` Row/Insert/Update).
- Commits direto na `main`.
