-- ============================================================================
-- RTI — Número da ART e anexo, entrega totalmente editável.
-- ----------------------------------------------------------------------------
-- 1) Adiciona art_numero e art_arquivo_path em rti_reports.
-- 2) Estende fn_entregar_rti_report para gravar esses campos e aceitar uma
--    data de entrega customizada (_entregue_em); todos os campos passam a ser
--    sugestões editáveis na UI, sem obrigatoriedade — a função em si já não
--    impunha obrigatoriedade nenhuma (validação era só de UI).
-- Idempotente.
-- ============================================================================

ALTER TABLE public.rti_reports
  ADD COLUMN IF NOT EXISTS art_numero text NULL,
  ADD COLUMN IF NOT EXISTS art_arquivo_path text NULL;

DROP FUNCTION IF EXISTS public.fn_entregar_rti_report(uuid, uuid, text[], text, text, text, date, date);

CREATE OR REPLACE FUNCTION public.fn_entregar_rti_report(
  _report_id uuid,
  _entregue_por_org uuid,
  _responsaveis_campo_extra text[],
  _responsavel_relatorio text,
  _responsavel_tecnico_rti text,
  _responsavel_plano text,
  _periodo_inicio date,
  _periodo_fim date,
  _art_numero text DEFAULT NULL,
  _art_arquivo_path text DEFAULT NULL,
  _entregue_em timestamptz DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _report_org uuid;
  _ts timestamptz := COALESCE(_entregue_em, now());
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
         periodo_fim = _periodo_fim,
         art_numero = _art_numero,
         art_arquivo_path = _art_arquivo_path
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
  uuid, uuid, text[], text, text, text, date, date, text, text, timestamptz
) TO authenticated;
