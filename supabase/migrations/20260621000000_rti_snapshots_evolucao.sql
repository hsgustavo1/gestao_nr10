-- ============================================================================
-- RTI — Evolução mensal: snapshot do plano de ação por (org, relatório, mês)
-- ----------------------------------------------------------------------------
-- Idempotente, aditivo, não-destrutivo. Aplicado via Supabase MCP em 2026-06-21.
-- Spec: docs/superpowers/specs/2026-06-21-mvp-menu-home-rti-evolucao-design.md
--
-- Grão por relatório (1 linha/relatório/mês) para reusar a visibilidade-por-
-- entrega na RLS (cliente só vê histórico de relatório ENTREGUE) e dar o filtro
-- "Todos ↔ individual" de graça. Captura server-side agendada (pg_cron) no 1º do
-- mês — fiel ao fechamento, sem depender de alguém abrir o app. Os agregados
-- espelham computeBudget()/computeAndamentoPorCusto() de src/lib/rti.ts.
-- ============================================================================

-- ---------- 1. Extensão de agendamento ----------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---------- 2. Tabela ----------
CREATE TABLE IF NOT EXISTS public.rti_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id),
  report_id     uuid NOT NULL REFERENCES public.rti_reports(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,                 -- sempre o 1º do mês
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_rti_snapshots_org_date
  ON public.rti_snapshots (org_id, snapshot_date);

ALTER TABLE public.rti_snapshots ENABLE ROW LEVEL SECURITY;

-- ---------- 3. RLS ----------
-- Leitura: ver a org E o relatório-raiz estar visível por entrega (reusa o
-- resolver da visibilidade-por-entrega). Cliente só vê histórico de relatório
-- entregue; "Todos" = soma dos visíveis; ao entregar, o histórico passado
-- aparece retroativo. Escrita é exclusiva da função de captura (SECURITY
-- DEFINER / cron) — sem policy de INSERT/UPDATE/DELETE para authenticated.
DROP POLICY IF EXISTS rti_snapshots_sel ON public.rti_snapshots;
CREATE POLICY rti_snapshots_sel ON public.rti_snapshots FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_report_delivery_visible(auth.uid(), report_id));

-- ---------- 4. Captura (agrega rti_ncs por relatório no mês dado) ----------
-- Roda fora de RLS (definer) → estado completo. Upsert idempotente: reexecutar
-- no mesmo mês recalcula o payload. Todas as somas de custo seguem a regra do
-- computeBudget (linha entra só se custo_planejado informado).
CREATE OR REPLACE FUNCTION public.fn_capture_rti_snapshots(
  _data date DEFAULT date_trunc('month', now())::date
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer := 0;
BEGIN
  INSERT INTO public.rti_snapshots (org_id, report_id, snapshot_date, payload)
  SELECT
    r.org_id,
    r.id,
    _data,
    jsonb_build_object(
      'ncs_total', count(*),
      'por_status', jsonb_build_object(
        'pendente',     count(*) FILTER (WHERE n.status = 'pendente'),
        'em_andamento', count(*) FILTER (WHERE n.status = 'em_andamento'),
        'concluida',    count(*) FILTER (WHERE n.status = 'concluida')
      ),
      'por_prioridade', jsonb_build_object(
        '1', count(*) FILTER (WHERE n.prioridade = 1),
        '2', count(*) FILTER (WHERE n.prioridade = 2),
        '3', count(*) FILTER (WHERE n.prioridade = 3),
        '4', count(*) FILTER (WHERE n.prioridade = 4)
      ),
      'vencidas', count(*) FILTER (
        WHERE n.status <> 'concluida' AND n.prazo IS NOT NULL AND n.prazo < _data
      ),
      'custo', jsonb_build_object(
        'planejado_total', COALESCE(sum(n.custo_planejado)
          FILTER (WHERE n.custo_planejado IS NOT NULL), 0),
        'realizado', COALESCE(sum(n.custo_realizado)
          FILTER (WHERE n.custo_planejado IS NOT NULL AND n.custo_realizado IS NOT NULL), 0),
        'em_aberto', COALESCE(sum(n.custo_planejado)
          FILTER (WHERE n.custo_planejado IS NOT NULL AND n.custo_realizado IS NULL
                        AND n.status <> 'concluida'), 0),
        'saldo_liquido', COALESCE(sum(n.custo_realizado - n.custo_planejado)
          FILTER (WHERE n.custo_planejado IS NOT NULL AND n.custo_realizado IS NOT NULL), 0)
      )
    )
  FROM public.rti_reports r
  JOIN public.rti_ncs n ON n.report_id = r.id
  GROUP BY r.org_id, r.id
  ON CONFLICT (report_id, snapshot_date)
  DO UPDATE SET payload = EXCLUDED.payload, created_at = now();

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

-- ---------- 5. Agenda mensal (1º dia, 03:00 UTC) ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rti-monthly-snapshot') THEN
    PERFORM cron.unschedule('rti-monthly-snapshot');
  END IF;
  PERFORM cron.schedule(
    'rti-monthly-snapshot', '0 3 1 * *',
    'SELECT public.fn_capture_rti_snapshots();'
  );
END $$;

-- ---------- 6. Backfill do mês corrente (primeiro ponto do gráfico) ----------
SELECT public.fn_capture_rti_snapshots();
