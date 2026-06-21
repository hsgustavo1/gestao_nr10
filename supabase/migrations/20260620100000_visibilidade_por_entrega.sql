-- ============================================================================
-- Visibilidade por entrega — inspeção/RTI só aparece ao cliente após entregue
-- ----------------------------------------------------------------------------
-- Idempotente, aditivo, não-destrutivo. Aplicado via Supabase MCP em 2026-06-20.
-- Spec: docs/superpowers/specs/2026-06-20-visibilidade-por-entrega-design.md
--
-- Regra: cliente-membro vê inspeção/RTI se a PRÓPRIA org criou (created_by_org_id
-- = org_id) OU se já foi entregue (entregue_em). Consultor/dono (gestor acima da
-- org) e platform admin veem sempre. Reusa o entregue_em do Selo de Entrega; só
-- adiciona a faceta de LEITURA (a do Selo é de edição). Filhos herdam a
-- visibilidade da raiz via funções SECURITY DEFINER (sem denormalizar colunas).
-- ============================================================================

-- ---------- 1. Colunas de procedência + entrega nas raízes ----------
-- created_by_org_id = org que criou (procedência, server-set). entregue_em já
-- existe em rti_reports (Selo); falta em field_inspections.
ALTER TABLE public.field_inspections ADD COLUMN IF NOT EXISTS created_by_org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.field_inspections ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
ALTER TABLE public.field_inspections ADD COLUMN IF NOT EXISTS entregue_por_org uuid REFERENCES public.organizations(id);
ALTER TABLE public.rti_reports       ADD COLUMN IF NOT EXISTS created_by_org_id uuid REFERENCES public.organizations(id);

-- Backfill: linhas legadas = trabalho próprio (created_by = org_id) → permanecem
-- visíveis ao dono. Nenhuma regressão de acesso a dados existentes.
UPDATE public.field_inspections SET created_by_org_id = org_id WHERE created_by_org_id IS NULL;
UPDATE public.rti_reports       SET created_by_org_id = org_id WHERE created_by_org_id IS NULL;

-- ---------- 2. Procedência confiável (server-set, anti-spoofing) ----------
-- A org de membership do ator. Multi-membership (raro) resolve determinístico
-- pelo maior papel. NULL quando o ator não tem membership (ex.: platform admin).
CREATE OR REPLACE FUNCTION public.fn_creator_org(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.org_id FROM public.org_memberships m
  WHERE m.user_id = _uid
  ORDER BY public.org_role_rank(m.org_role) DESC, m.org_id
  LIMIT 1;
$$;

-- Carimba created_by_org_id no INSERT da raiz, SOBRESCREVENDO qualquer valor do
-- cliente (anti-spoof). Ator anônimo (seed/service_role, auth.uid() NULL) →
-- created_by = org_id (trabalho próprio, visível). Ator real → fn_creator_org:
-- consultor → consultoria (≠ org_id do cliente → oculto até entregar); técnico
-- do cliente → própria org (= org_id → visível já); platform admin → NULL (sem
-- membership → oculto até entregar).
CREATE OR REPLACE FUNCTION public.fn_set_created_by_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    NEW.created_by_org_id := COALESCE(NEW.created_by_org_id, NEW.org_id);
  ELSE
    NEW.created_by_org_id := public.fn_creator_org(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_created_by_org ON public.field_inspections;
CREATE TRIGGER trg_set_created_by_org BEFORE INSERT ON public.field_inspections
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_created_by_org();
DROP TRIGGER IF EXISTS trg_set_created_by_org ON public.rti_reports;
CREATE TRIGGER trg_set_created_by_org BEFORE INSERT ON public.rti_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_created_by_org();

-- ---------- 3. Predicados de visibilidade ----------
-- Gestor = está ACIMA da org (consultor via managed_by / org-mãe via parent) ou
-- é dono do app. Distingue quem vê rascunhos de quem é membro-cliente da org.
CREATE OR REPLACE FUNCTION public.fn_org_is_manager(_uid uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_uid)
    OR EXISTS (SELECT 1 FROM public.org_memberships m
               JOIN public.organizations o ON o.parent_org_id = m.org_id
               WHERE m.user_id = _uid AND o.id = _org_id)
    OR EXISTS (SELECT 1 FROM public.org_memberships m
               JOIN public.organizations o ON o.managed_by_org_id = m.org_id
               WHERE m.user_id = _uid AND o.id = _org_id);
$$;

-- Overlay de visibilidade (ANDado com can_access_org na policy). Só esconde o
-- caso "membro-cliente vendo registro externo ainda não entregue".
CREATE OR REPLACE FUNCTION public.fn_delivery_visible(
  _uid uuid, _org_id uuid, _created_by_org uuid, _entregue_em timestamptz
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _entregue_em IS NOT NULL
      OR COALESCE(_created_by_org = _org_id, false)
      OR public.fn_org_is_manager(_uid, _org_id);
$$;

-- Resolvers para os filhos: leem a raiz (definer → sem recursão de RLS) e
-- reaproveitam o overlay. A regra de entrega mora só na raiz.
CREATE OR REPLACE FUNCTION public.fn_inspection_delivery_visible(_uid uuid, _inspection_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_delivery_visible(_uid, i.org_id, i.created_by_org_id, i.entregue_em)
  FROM public.field_inspections i WHERE i.id = _inspection_id;
$$;
CREATE OR REPLACE FUNCTION public.fn_point_delivery_visible(_uid uuid, _point_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_inspection_delivery_visible(_uid, p.inspection_id)
  FROM public.field_points p WHERE p.id = _point_id;
$$;
CREATE OR REPLACE FUNCTION public.fn_report_delivery_visible(_uid uuid, _report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_delivery_visible(_uid, r.org_id, r.created_by_org_id, r.entregue_em)
  FROM public.rti_reports r WHERE r.id = _report_id;
$$;
CREATE OR REPLACE FUNCTION public.fn_nc_delivery_visible(_uid uuid, _nc_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_report_delivery_visible(_uid, n.report_id)
  FROM public.rti_ncs n WHERE n.id = _nc_id;
$$;

-- ---------- 4. Reescreve as policies de SELECT (AND overlay) ----------
-- Raízes: overlay sobre as próprias colunas.
DROP POLICY IF EXISTS field_inspections_sel ON public.field_inspections;
CREATE POLICY field_inspections_sel ON public.field_inspections FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_delivery_visible(auth.uid(), org_id, created_by_org_id, entregue_em));

DROP POLICY IF EXISTS rti_reports_sel ON public.rti_reports;
CREATE POLICY rti_reports_sel ON public.rti_reports FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_delivery_visible(auth.uid(), org_id, created_by_org_id, entregue_em));

-- Filhos campo: herdam da inspeção-raiz.
DROP POLICY IF EXISTS field_nodes_sel ON public.field_nodes;
CREATE POLICY field_nodes_sel ON public.field_nodes FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_inspection_delivery_visible(auth.uid(), inspection_id));
DROP POLICY IF EXISTS field_points_sel ON public.field_points;
CREATE POLICY field_points_sel ON public.field_points FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_inspection_delivery_visible(auth.uid(), inspection_id));
DROP POLICY IF EXISTS field_findings_sel ON public.field_findings;
CREATE POLICY field_findings_sel ON public.field_findings FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_point_delivery_visible(auth.uid(), point_id));
DROP POLICY IF EXISTS field_photos_sel ON public.field_photos;
CREATE POLICY field_photos_sel ON public.field_photos FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_point_delivery_visible(auth.uid(), point_id));

-- Filhos RTI: herdam do relatório-raiz.
DROP POLICY IF EXISTS rti_areas_sel ON public.rti_areas;
CREATE POLICY rti_areas_sel ON public.rti_areas FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_report_delivery_visible(auth.uid(), report_id));
DROP POLICY IF EXISTS rti_ncs_sel ON public.rti_ncs;
CREATE POLICY rti_ncs_sel ON public.rti_ncs FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_report_delivery_visible(auth.uid(), report_id));
DROP POLICY IF EXISTS rti_nc_evidencias_sel ON public.rti_nc_evidencias;
CREATE POLICY rti_nc_evidencias_sel ON public.rti_nc_evidencias FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_nc_delivery_visible(auth.uid(), nc_id));
DROP POLICY IF EXISTS rti_nc_historico_sel ON public.rti_nc_historico;
CREATE POLICY rti_nc_historico_sel ON public.rti_nc_historico FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id)
     AND public.fn_nc_delivery_visible(auth.uid(), nc_id));

-- ---------- 5. RPC de entrega da inspeção (espelha fn_entregar_rti_report) ----------
-- Só quem bypassa o selo (consultor/dono/owner) entrega. Carimba só a raiz —
-- os filhos herdam a visibilidade via os resolvers acima (sem cascata).
CREATE OR REPLACE FUNCTION public.fn_entregar_inspecao(_inspection_id uuid, _entregue_por_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _org uuid;
  _ts  timestamptz := now();
BEGIN
  SELECT org_id INTO _org FROM public.field_inspections WHERE id = _inspection_id;
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Inspeção % não encontrada', _inspection_id;
  END IF;

  IF NOT public.fn_can_bypass_seal(_uid, _org, _entregue_por_org) THEN
    RAISE EXCEPTION 'Sem permissão para entregar esta inspeção';
  END IF;

  IF EXISTS (SELECT 1 FROM public.field_inspections WHERE id = _inspection_id AND entregue_em IS NOT NULL) THEN
    RETURN;  -- idempotente
  END IF;

  UPDATE public.field_inspections
     SET entregue_em = _ts, entregue_por_org = _entregue_por_org
   WHERE id = _inspection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_entregar_inspecao(uuid, uuid) TO authenticated;
