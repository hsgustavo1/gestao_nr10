-- ============================================================================
-- Selo de Entrega — schema base (colunas + política declarativa + bypass)
-- ----------------------------------------------------------------------------
-- Idempotente, aditivo, não-destrutivo. Aplicado via Supabase MCP em 2026-06-19.
--
-- Camada genérica "Selo de Entrega" (camada 3, ortogonal a rank/entitlement):
-- marca registros entregues de uma org para outra abaixo dela e congela o
-- registro técnico para o admin-padrão do cliente. Spec:
--   docs/superpowers/specs/2026-06-19-selo-entrega-rti-design.md
-- ============================================================================

-- ---------- 1. Colunas de selo no root e nos filhos protegidos ----------
ALTER TABLE public.rti_reports        ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
ALTER TABLE public.rti_reports        ADD COLUMN IF NOT EXISTS entregue_por_org uuid REFERENCES public.organizations(id);
ALTER TABLE public.rti_areas          ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
ALTER TABLE public.rti_areas          ADD COLUMN IF NOT EXISTS entregue_por_org uuid;
ALTER TABLE public.rti_ncs            ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
ALTER TABLE public.rti_ncs            ADD COLUMN IF NOT EXISTS entregue_por_org uuid;
ALTER TABLE public.rti_nc_evidencias  ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
ALTER TABLE public.rti_nc_evidencias  ADD COLUMN IF NOT EXISTS entregue_por_org uuid;

-- ---------- 2. Registro declarativo de política de congelamento ----------
-- Uma linha por tabela protegida. Único ponto que muda quando um módulo novo
-- (LOTO) passa a usar o selo. frozen_columns = ARRAY['*'] congela a linha toda.
CREATE TABLE IF NOT EXISTS public.seal_policy (
  table_name     text PRIMARY KEY,
  frozen_columns text[]  NOT NULL DEFAULT '{}',
  allow_delete   boolean NOT NULL DEFAULT false,
  row_filter     text    -- expressão SQL booleana sobre a linha; NULL = toda linha
);

INSERT INTO public.seal_policy (table_name, frozen_columns, allow_delete, row_filter) VALUES
  ('rti_ncs', ARRAY['descricao','prioridade','recomendacao','area_id','numero','finding_id'], false, NULL),
  ('rti_nc_evidencias', ARRAY['*'], false, $$tipo = 'constatacao'$$),
  ('rti_areas', ARRAY['nome','ordem'], false, NULL)
ON CONFLICT (table_name) DO UPDATE
  SET frozen_columns = EXCLUDED.frozen_columns,
      allow_delete   = EXCLUDED.allow_delete,
      row_filter     = EXCLUDED.row_filter;

-- ---------- 3. Predicado único de bypass (banco + espelho na UI) ----------
-- true se o usuário pode editar registro técnico mesmo selado:
--   dono (platform_admin)
--   OU  membro (>=member) da org autora/entregadora — desde que essa org seja
--       DIFERENTE da org do registro (entrega genuinamente de cima para baixo;
--       evita que uma auto-entrega deixe o próprio admin do cliente bypassar)
--   OU  owner (admin-geral) na própria org do registro.
CREATE OR REPLACE FUNCTION public.fn_can_bypass_seal(
  _uid uuid, _row_org uuid, _entregue_por_org uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_platform_admin(_uid)
    OR (_entregue_por_org IS NOT NULL AND _entregue_por_org <> _row_org AND EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = _uid AND m.org_id = _entregue_por_org
            AND m.org_role IN ('member','admin','owner')))
    OR EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = _uid AND m.org_id = _row_org
            AND m.org_role = 'owner');
$$;
