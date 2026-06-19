-- ============================================================================
-- Selo de Entrega — RPC de entrega + cascata para os filhos existentes.
-- ----------------------------------------------------------------------------
-- Aplicado via Supabase MCP em 2026-06-19. Idempotente.
--
-- Entrega um relatório: carimba o root e cascateia o selo (entregue_em +
-- entregue_por_org) para áreas, NCs e evidências existentes. Só quem bypassa
-- (consultor/dono/owner) pode entregar. entregue_por_org é a org autora/
-- entregadora (a consultoria/empresa que entrega), independente de org_id (que
-- é a org-cliente dona do relatório).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_entregar_rti_report(_report_id uuid, _entregue_por_org uuid)
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
     SET entregue_em = _ts, entregue_por_org = _entregue_por_org
   WHERE id = _report_id;

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

GRANT EXECUTE ON FUNCTION public.fn_entregar_rti_report(uuid, uuid) TO authenticated;
