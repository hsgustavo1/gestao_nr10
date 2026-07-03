-- ============================================================================
-- RTI — responsáveis capturados na entrega.
-- ----------------------------------------------------------------------------
-- 1) Renomeia responsavel_auditoria -> responsavel_tecnico_rti (emissor da ART).
-- 2) Adiciona responsaveis_campo_extra (nomes manuais) e responsavel_relatorio.
-- 3) Estende fn_entregar_rti_report para gravar esses campos + datas e aplicar
--    o responsável do plano nas NCs sem responsável, na mesma transação.
-- Idempotente.
-- ============================================================================

ALTER TABLE public.rti_reports
  RENAME COLUMN responsavel_auditoria TO responsavel_tecnico_rti;

ALTER TABLE public.rti_reports
  ADD COLUMN IF NOT EXISTS responsaveis_campo_extra text[] NULL,
  ADD COLUMN IF NOT EXISTS responsavel_relatorio text NULL;

-- A assinatura muda (novos parâmetros), então removemos a versão antiga.
DROP FUNCTION IF EXISTS public.fn_entregar_rti_report(uuid, uuid);

CREATE OR REPLACE FUNCTION public.fn_entregar_rti_report(
  _report_id uuid,
  _entregue_por_org uuid,
  _responsaveis_campo_extra text[],
  _responsavel_relatorio text,
  _responsavel_tecnico_rti text,
  _responsavel_plano text,
  _periodo_inicio date,
  _periodo_fim date
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _report_org uuid;
  _ts timestamptz := now();
BEGIN
  SELECT org_id INTO _report_org FROM public.rti_reports WHERE id = _report_id;
  IF _report_org IS NULL THEN
    RAISE EXCEPTION 'Relatório % não encontrado', _report_id;
  END IF;

  IF NOT public.fn_can_bypass_seal(_uid, _report_org, _entregue_por_org) THEN
    RAISE EXCEPTION 'Sem permissão para entregar este relatório';
  END IF;

  IF EXISTS (SELECT 1 FROM public.rti_reports WHERE id = _report_id AND entregue_em IS NOT NULL) THEN
    RETURN;  -- idempotente: já entregue
  END IF;

  UPDATE public.rti_reports
     SET entregue_em = _ts,
         entregue_por_org = _entregue_por_org,
         responsaveis_campo_extra = _responsaveis_campo_extra,
         responsavel_relatorio = _responsavel_relatorio,
         responsavel_tecnico_rti = _responsavel_tecnico_rti,
         responsavel_plano = _responsavel_plano,
         periodo_inicio = _periodo_inicio,
         periodo_fim = _periodo_fim
   WHERE id = _report_id;

  -- Responsável do plano: aplica só nas NCs sem responsável (não sobrescreve).
  IF _responsavel_plano IS NOT NULL AND btrim(_responsavel_plano) <> '' THEN
    UPDATE public.rti_ncs
       SET responsavel = _responsavel_plano
     WHERE report_id = _report_id
       AND (responsavel IS NULL OR btrim(responsavel) = '');
  END IF;

  -- Cascata do selo aos filhos (inalterada).
  UPDATE public.rti_areas
     SET entregue_em = _ts, entregue_por_org = _entregue_por_org
   WHERE report_id = _report_id AND entregue_em IS NULL;

  UPDATE public.rti_ncs
     SET entregue_em = _ts, entregue_por_org = _entregue_por_org
   WHERE report_id = _report_id AND entregue_em IS NULL;

  UPDATE public.rti_nc_evidencias e
     SET entregue_em = _ts, entregue_por_org = _entregue_por_org
   WHERE e.entregue_em IS NULL
     AND e.nc_id IN (SELECT id FROM public.rti_ncs WHERE report_id = _report_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_entregar_rti_report(
  uuid, uuid, text[], text, text, text, date, date
) TO authenticated;
