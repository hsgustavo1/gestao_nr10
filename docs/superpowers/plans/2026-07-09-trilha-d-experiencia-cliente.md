# Trilha D — Experiência do Cliente: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home do cliente com KPIs/pendências acionáveis (D1) e digest semanal por e-mail escopado por org (D2); D3 re-escopado com base no que já existe.

**Architecture:** D1 = composição de queries existentes (`buildVencimentos` já é pura e testada; `useComplianceReport` dá o índice) + função pura nova `cardsPendencias()` (TDD) + rota `/home` + redirect de `/` para org tipo `cliente`. D2 = **evolução da edge function `vencimentos-email` já existente** (hoje pré-multi-tenant: sem escopo de org, destinatários por env, sem idempotência): loop por org cliente ativa, queries com `org_id`, destinatários = admins da org via `profiles.email` (menos opt-outs), idempotência por `digest_log (org, semana)`, agendamento pg_cron+pg_net (padrão do orphan-sweep já em produção).

**Tech Stack:** Supabase Edge Functions (Deno, deploy via MCP), Resend, pg_cron/pg_net, React Query.

**Decisões novas (registrar na Task 5):**
- **D-D5 (re-escopo do D3):** funcionários e treinamentos históricos JÁ têm importação por planilha (`admin/qualificacoes/carga`, `batchImportQualificacoes`); certificados JÁ têm importação por IA. O delta real do D3 é o importador de ASOs por IA (~900 linhas no padrão certificados) e EPIs por planilha — ficam REGISTRADOS como próxima fatia, não construídos hoje (a própria spec D posicionava importadores como "depois do wizard C provar o padrão"). Se trocar: clonar `admin.certificados.importar.tsx` trocando o prompt para ASO.
- **D-D6:** o digest reusa as consultas Deno da função existente (validade 2 anos de capacitação, ITs por `validity_months`, EPIs por intervalo, ASOs por `validity_date`) escopadas por org — não compartilha código com `buildVencimentos` do app (runtimes diferentes); a paridade é de regra, testada na pura do app.
- **D-D7:** opt-out por `profiles.digest_optout` (default false = admins recebem); v1 sem UI de opt-out (rodapé instrui a pedir ao consultor; flag ajustável por admin). Anti-spam garantido pelo "só envia se houver pendência".
- **D-D8:** cópia de supervisão para `ALERT_EMAILS` (founder) mantida como fallback/oversight.

**Fatos verificados:** `profiles` tem `id, email, display_name`; padrão cron+pg_net em `20260702010000_schedule_orphan_sweep_monthly.sql` (anon bearer + verify_jwt); `useVencimentos(horizonDays)` e `VencimentoItem {kind,title,subject,dueDate,daysLeft,status,link}` em `src/lib/vencimentos.ts`; `useComplianceReport()` em `src/lib/conformidade.ts`; `useAllRtiNcs()` em `rti-queries.ts`; redirect atual em `src/routes/index.tsx:39-47`; org do usuário: `useAuth().currentOrg?.tipo`.

---

### Task 1: Pura `cardsPendencias` (TDD)

**Files:**
- Create: `src/lib/home-cliente.ts`
- Test: `src/lib/__tests__/home-cliente.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, test } from "vitest";
import { cardsPendencias, type NcResumo } from "../home-cliente";
import type { VencimentoItem } from "../vencimentos";

const venc = (over: Partial<VencimentoItem>): VencimentoItem => ({
  id: "v1",
  kind: "aso",
  title: "ASO periodico",
  subject: "Fulano (123)",
  detail: null,
  dueDate: "2026-07-01",
  daysLeft: -8,
  status: "expired",
  link: "/vencimentos",
  ...over,
});

const nc = (over: Partial<NcResumo>): NcResumo => ({
  prioridade: 4,
  status: "pendente",
  prazo: null,
  ...over,
});

describe("cardsPendencias", () => {
  test("agrupa vencidos, vencendo 30d, NCs graves e ações atrasadas", () => {
    const cards = cardsPendencias({
      vencimentos: [
        venc({}),
        venc({ id: "v2", daysLeft: 12, status: "expiring" }),
        venc({ id: "v3", daysLeft: 70, status: "expiring" }), // fora dos 30d
      ],
      ncs: [
        nc({}), // grave pendente
        nc({ prioridade: 1, prazo: "2026-06-01" }), // atrasada
        nc({ prioridade: 4, status: "concluida" }), // concluída não conta
      ],
      hoje: new Date("2026-07-09T12:00:00"),
    });
    const porId = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(porId.vencidos.quantidade).toBe(1);
    expect(porId.vencendo30.quantidade).toBe(1);
    expect(porId.ncs_graves.quantidade).toBe(1);
    expect(porId.acoes_atrasadas.quantidade).toBe(1);
    expect(porId.vencidos.severidade).toBe("critico");
    expect(porId.vencendo30.severidade).toBe("atencao");
  });

  test("tudo zerado vira severidade ok (estado comemorável)", () => {
    const cards = cardsPendencias({ vencimentos: [], ncs: [], hoje: new Date() });
    expect(cards.every((c) => c.quantidade === 0 && c.severidade === "ok")).toBe(true);
  });
});
```

- [ ] **Step 2: FAIL → Step 3: Implementar**

```ts
// Trilha D — cards de pendência da home do cliente. Puro, TDD.
import type { VencimentoItem } from "./vencimentos";

export interface NcResumo {
  prioridade: number;
  status: string; // 'pendente' | 'em_andamento' | 'concluida'
  prazo: string | null; // yyyy-mm-dd
}

export type Severidade = "critico" | "atencao" | "ok";

export interface CardPendencia {
  id: "vencidos" | "vencendo30" | "ncs_graves" | "acoes_atrasadas";
  titulo: string;
  quantidade: number;
  severidade: Severidade;
  to: string; // link acionável
  descricao: string;
}

const sev = (qtd: number, quandoTem: Severidade): Severidade => (qtd === 0 ? "ok" : quandoTem);

export function cardsPendencias(args: {
  vencimentos: VencimentoItem[];
  ncs: NcResumo[];
  hoje: Date;
}): CardPendencia[] {
  const hojeIso = args.hoje.toISOString().slice(0, 10);
  const vencidos = args.vencimentos.filter((v) => v.status === "expired").length;
  const vencendo30 = args.vencimentos.filter(
    (v) => v.status === "expiring" && v.daysLeft >= 0 && v.daysLeft <= 30,
  ).length;
  const abertas = args.ncs.filter((n) => n.status !== "concluida");
  const ncsGraves = abertas.filter((n) => n.prioridade >= 3).length;
  const acoesAtrasadas = abertas.filter((n) => n.prazo !== null && n.prazo < hojeIso).length;

  return [
    {
      id: "vencidos",
      titulo: "Vencidos",
      quantidade: vencidos,
      severidade: sev(vencidos, "critico"),
      to: "/vencimentos",
      descricao: "Treinamentos, ASOs, ensaios e documentos já vencidos",
    },
    {
      id: "vencendo30",
      titulo: "Vencendo em 30 dias",
      quantidade: vencendo30,
      severidade: sev(vencendo30, "atencao"),
      to: "/vencimentos",
      descricao: "O que precisa de agenda ainda neste mês",
    },
    {
      id: "ncs_graves",
      titulo: "NCs de prioridade alta",
      quantidade: ncsGraves,
      severidade: sev(ncsGraves, "atencao"),
      to: "/rti/plano",
      descricao: "Não conformidades P3/P4 ainda abertas",
    },
    {
      id: "acoes_atrasadas",
      titulo: "Ações atrasadas",
      quantidade: acoesAtrasadas,
      severidade: sev(acoesAtrasadas, "critico"),
      to: "/rti/plano",
      descricao: "Ações do plano com prazo estourado",
    },
  ];
}
```

- [ ] **Step 4: PASS → Step 5: Commit** `feat(cliente): cards de pendencia puros da home do cliente (TDD)`

---

### Task 2: Home do cliente (`/home`) + redirect

**Files:**
- Create: `src/routes/home.tsx`
- Modify: `src/routes/index.tsx:39-47` (redirect)

- [ ] **Step 1: Rota `/home`** — PageShell com: (1) card de destaque com **índice de conformidade** (`useComplianceReport()` — usar o campo de índice geral do report; conferir nome exato no tipo `ComplianceReport`); (2) grid dos 4 `cardsPendencias` (dados: `useVencimentos(90)` + `useAllRtiNcs()`), cada card é `<Link to={c.to}>` com número grande e cor por severidade (`text-destructive` / `text-warning` / `text-primary`); (3) **Últimas entregas**: query inline `rti_reports` com `entregue_em not null` order desc limit 5, linhas com título + data + link `/rti/plano`; (4) saudação com `currentOrg?.nome`.

- [ ] **Step 2: Redirect em `index.tsx`** — trocar o trecho:

```ts
      : auth.user && !auth.isPlatformAdmin
        ? canViewRti
          ? "/rti"
          : "/qualificacoes"
        : null
```
por:
```ts
      : auth.user && !auth.isPlatformAdmin
        ? auth.currentOrg?.tipo === "cliente"
          ? "/home"
          : canViewRti
            ? "/rti"
            : "/qualificacoes"
        : null
```

- [ ] **Step 3: `npm run build` (routeTree) + `npx tsc --noEmit` → Commit** `feat(cliente): home do cliente com indice, pendencias acionaveis e ultimas entregas`

---

### Task 3: Migration do digest (opt-out, log e agendamento)

**Files:**
- Create: `supabase/migrations/20260709120000_digest_semanal.sql` (+ aplicar via MCP)
- Modify: `src/integrations/supabase/types.ts` (profiles.digest_optout, digest_log)

```sql
-- Trilha D — digest semanal por e-mail (D2). Idempotente.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS digest_optout boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.digest_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  semana        date NOT NULL,             -- segunda-feira ISO da semana enviada
  enviado_em    timestamptz NOT NULL DEFAULT now(),
  destinatarios text[] NOT NULL DEFAULT '{}',
  UNIQUE (org_id, semana)
);
ALTER TABLE public.digest_log ENABLE ROW LEVEL SECURITY;
-- Escrita só pela service role (edge function); leitura para o platform admin auditar.
DROP POLICY IF EXISTS "digest_log_admin_select" ON public.digest_log;
CREATE POLICY "digest_log_admin_select" ON public.digest_log FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- Agenda: toda segunda 11:00 UTC (08:00 BRT). Mesmo padrão do orphan-sweep.
create extension if not exists pg_net;
DO $$ BEGIN
  PERFORM cron.unschedule('digest-semanal');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
select cron.schedule(
  'digest-semanal',
  '0 11 * * 1',
  $$
  select net.http_post(
    url := 'https://fumwovtzyhxrjhkjzujs.supabase.co/functions/v1/vencimentos-email',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <ANON_JWT_DO_PROJETO — copiar de 20260702010000_schedule_orphan_sweep_monthly.sql>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Tipos: `digest_optout: boolean` em profiles (Row; opcional em Insert/Update) e tabela `digest_log` (Row/Insert/Update + fk organizations).

Commit: `feat(cliente): digest_log, opt-out e agendamento semanal do digest`

---

### Task 4: Edge function multi-tenant

**Files:**
- Modify: `supabase/functions/vencimentos-email/index.ts` (reescrita orientada)

Mudanças sobre a função existente (mantendo as regras de validade Deno já escritas):
1. Loop externo: `organizations` com `tipo = 'cliente' AND ativa`.
2. Todas as consultas ganham `.eq("org_id", org.id)` (employees, nr10_trainings, it_trainings, nr10_documents, inspections, epis, epi_tests via join de epis da org, asos, rti_ncs — conferir coluna org_id em cada uma; todas ganharam org_id na migração 20260614010000).
3. Destinatários por org: `org_memberships` (`org_id`, `org_role in ('admin','owner')`) → `profiles` (`email`, `digest_optout = false`). Sem destinatário → pula org. `ALERT_EMAILS` (se setado) entra como cópia de supervisão (D-D8).
4. Idempotência: `semana` = segunda-feira ISO da semana corrente; se existe linha em `digest_log` → pula; após envio OK → insere linha com destinatários.
5. Só envia se houver pendência na org (comportamento atual, agora por org).
6. Cores/rodapé: `#0A2D48` → `#0C3326`; rodapé com nota de opt-out (D-D7).
7. Resposta: JSON com resumo por org (`{org, sent|skipped, motivo}`).
8. Deploy via MCP `deploy_edge_function` (name `vencimentos-email`).

Commit: `feat(cliente): digest semanal multi-tenant por org com idempotencia e opt-out`

---

### Task 5: Verificação + docs

- [ ] `npx vitest run` + `npx tsc --noEmit` + `npm run build` verdes.
- [ ] Registrar D-D5…D-D8 no arquivo de decisões; ROADMAP: trilha D (D1+D2 implementadas; D3 re-escopada com delta registrado — importador de ASO por IA e EPIs por planilha). Nota de setup para o founder: criar conta/API key Resend + secrets `RESEND_API_KEY`/`ALERT_FROM` (+ `ALERT_EMAILS` opcional) no dashboard de Edge Functions.
- [ ] Commit `docs: trilha D — D1/D2 implementadas, D-D5..D-D8 e ROADMAP`

---

## Self-review

- **Spec D1:** índice + cards acionáveis + últimas entregas + substitui redirect → Task 2 (com pura testada na Task 1). Fonte única de pendências (spec "uma fonte, duas superfícies") vira paridade de regra documentada (D-D6) — desvio consciente por runtime.
- **Spec D2:** semanal, por org, admins optantes, Resend, só com pendência, idempotente por (org, semana), falha não derruba o lote (loop com try/catch por org na Task 4) → Tasks 3–4.
- **Spec D3:** re-escopo registrado (D-D5) — o que a spec pedia de funcionários/treinamentos JÁ existe; delta (ASO IA, EPIs planilha) documentado no ROADMAP como próxima fatia.
- **Spec §4 LGPD:** digest não lista resultado de ASO — só "ASO {tipo} de {nome} vence em X dias" (a função existente já faz assim; manter).
- **Spec §5:** pura central testada (Task 1), digest idempotente + não-fatal (Tasks 3–4).
