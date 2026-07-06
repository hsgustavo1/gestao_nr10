-- ============================================================================
-- RTI — permite corrigir dados de entrega, mas só até 30 dias após a entrega.
-- ----------------------------------------------------------------------------
-- Decisão do produto: o consultor pode errar um nome/número na entrega e
-- precisa de uma janela para corrigir — mas não indefinidamente. A UI já gira
-- em torno de fn_can_bypass_seal + prazo de 30 dias (client-side); aqui
-- reforçamos a mesma regra no servidor (defesa em profundidade, já que esta
-- função é SECURITY DEFINER):
--   - Relatório ainda não entregue: comportamento normal (primeira entrega).
--   - Relatório entregue há <= 30 dias: metadados (responsáveis, ART, período)
--     podem ser corrigidos; o selo (entregue_em/por_org) e a cascata para
--     áreas/NCs/evidências NÃO são reaplicados (já rodaram uma vez).
--   - Relatório entregue há mais de 30 dias: função vira no-op (idempotente),
--     como no comportamento original.
-- Idempotente.
-- ============================================================================

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
  _ja_entregue timestamptz;
  _ts timestamptz := COALESCE(_entregue_em, now());
BEGIN
  SELECT org_id, entregue_em INTO _report_org, _ja_entregue
    FROM public.rti_reports WHERE id = _report_id;
  IF _report_org IS NULL THEN
    RAISE EXCEPTION 'Relatório % não encontrado', _report_id;
  END IF;

  IF NOT public.fn_can_bypass_seal(_uid, _report_org, _entregue_por_org) THEN
    RAISE EXCEPTION 'Sem permissão para entregar este relatório';
  END IF;

  -- Já entregue há mais de 30 dias: no-op, como no comportamento original.
  IF _ja_entregue IS NOT NULL AND _ja_entregue < now() - interval '30 days' THEN
    RETURN;
  END IF;

  -- Metadados editáveis: gravados sempre que dentro do prazo (primeira
  -- entrega OU correção nos primeiros 30 dias após já entregue).
  UPDATE public.rti_reports
     SET responsaveis_campo_extra = _responsaveis_campo_extra,
         responsavel_relatorio = _responsavel_relatorio,
         responsavel_tecnico_rti = _responsavel_tecnico_rti,
         responsavel_plano = _responsavel_plano,
         periodo_inicio = _periodo_inicio,
         periodo_fim = _periodo_fim,
         art_numero = _art_numero,
         art_arquivo_path = _art_arquivo_path
   WHERE id = _report_id;

  IF _ja_entregue IS NOT NULL THEN
    RETURN;  -- selo e cascata já aplicados antes; só os metadados acima mudam
  END IF;

  UPDATE public.rti_reports
     SET entregue_em = _ts,
         entregue_por_org = _entregue_por_org
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
