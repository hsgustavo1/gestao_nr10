-- ============================================================================
-- Fix — herança de org_id do PAI deve ser AUTORITATIVA (corrige invariante)
-- ----------------------------------------------------------------------------
-- Idempotente, aditiva, não-destrutiva. Aplicar manualmente no SQL Editor.
--
-- Bug observado:
--   Consultor membro de UMA só org (a consultoria) cria o plano de ação para um
--   cliente que ele gerencia. O relatório (rti_reports) recebe a org do cliente
--   (carimbada explicitamente pelo app), mas as áreas/NCs filhas eram carimbadas
--   com a org da CONSULTORIA — não a do relatório. Resultado: o cliente vê o
--   relatório vazio (suas queries por org_id não retornam as NCs) e a RLS também
--   bloqueia (o cliente não acessa a org da consultoria).
--
-- Causa raiz (ordem dos BEFORE INSERT triggers, alfabética por nome):
--   trg_default_org_*  (fn_default_org_id)  → roda 1º. Para usuário single-org,
--                        preenche org_id com a ÚNICA org do usuário (a consultoria).
--   trg_inherit_org_*  (fn_inherit_org_id)  → roda 2º. Só agia quando org_id era
--                        NULL — como o default já preencheu, a herança não tocava.
--   Logo o filho ficava na org da consultoria, violando o invariante declarado
--   em 20260614010000: "um filho NUNCA pode ficar numa org diferente da do pai".
--
-- Correção:
--   fn_inherit_org_id passa a SEMPRE derivar org_id do pai quando há FK e o pai
--   tem org_id. O pai é a fonte da verdade; o default (que roda antes) pode
--   preencher, mas a herança sobrescreve em seguida. Garante o invariante para
--   usuários single-org e multi-org igualmente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_inherit_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _parent_table text := TG_ARGV[0];
  _fk_col       text := TG_ARGV[1];
  _fk_val       uuid;
  _org          uuid;
BEGIN
  _fk_val := (to_jsonb(NEW) ->> _fk_col)::uuid;
  IF _fk_val IS NOT NULL THEN
    EXECUTE format('SELECT org_id FROM public.%I WHERE id = $1', _parent_table)
      INTO _org USING _fk_val;
    -- Pai é a fonte da verdade: o filho SEMPRE acompanha a org do pai.
    IF _org IS NOT NULL THEN
      NEW.org_id := _org;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- Backfill: realinha filhos existentes à org do pai ----------
-- Corrige dados gravados antes desta migração (áreas/NCs na org errada).
UPDATE public.rti_areas c
  SET org_id = p.org_id
  FROM public.rti_reports p
  WHERE c.report_id = p.id AND c.org_id <> p.org_id;

UPDATE public.rti_ncs c
  SET org_id = p.org_id
  FROM public.rti_reports p
  WHERE c.report_id = p.id AND c.org_id <> p.org_id;

UPDATE public.rti_nc_evidencias c
  SET org_id = p.org_id
  FROM public.rti_ncs p
  WHERE c.nc_id = p.id AND c.org_id <> p.org_id;

UPDATE public.rti_nc_historico c
  SET org_id = p.org_id
  FROM public.rti_ncs p
  WHERE c.nc_id = p.id AND c.org_id <> p.org_id;

UPDATE public.field_nodes c
  SET org_id = p.org_id
  FROM public.field_inspections p
  WHERE c.inspection_id = p.id AND c.org_id <> p.org_id;

UPDATE public.field_points c
  SET org_id = p.org_id
  FROM public.field_inspections p
  WHERE c.inspection_id = p.id AND c.org_id <> p.org_id;

UPDATE public.field_findings c
  SET org_id = p.org_id
  FROM public.field_points p
  WHERE c.point_id = p.id AND c.org_id <> p.org_id;

UPDATE public.field_photos c
  SET org_id = p.org_id
  FROM public.field_points p
  WHERE c.point_id = p.id AND c.org_id <> p.org_id;
