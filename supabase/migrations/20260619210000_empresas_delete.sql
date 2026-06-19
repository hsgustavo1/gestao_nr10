-- ============================================================================
-- GESTÃO DE EMPRESAS — exclusão permanente (hard delete) com bloqueio de órfãos
-- ----------------------------------------------------------------------------
-- Migration ADITIVA e idempotente. Aplicada via MCP do Supabase (apply_migration).
-- Depende de 20260619200000_empresas_management.sql.
--
-- Decisão (2026-06-19): além do soft-deactivate (`ativa`), o dono da plataforma
-- pode EXCLUIR de vez orgs de teste. Política: BLOQUEAR se houver dependentes.
--   - unidades filhas / clientes geridos  -> as FKs auto-referentes são SET NULL
--     (orfanariam em silêncio), então bloqueamos explicitamente antes.
--   - org_entitlements / org_memberships / org_public_tokens -> ON DELETE CASCADE
--     (somem junto, sem problema).
--   - dados de domínio (RTI, EPIs, inspeções, padlocks, employees, ...) -> FK
--     RESTRICT; o próprio DELETE falha e devolvemos mensagem amigável.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_delete_org(p_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tipo public.org_tipo;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  SELECT tipo INTO _tipo FROM public.organizations WHERE id = p_org;
  IF _tipo IS NULL THEN
    RAISE EXCEPTION 'empresa não encontrada';
  END IF;

  -- Bloqueia se houver unidades filhas ou clientes geridos (evita órfãos via SET NULL).
  IF EXISTS (
    SELECT 1 FROM public.organizations
    WHERE parent_org_id = p_org OR managed_by_org_id = p_org
  ) THEN
    RAISE EXCEPTION 'empresa possui unidades ou clientes vinculados; remova ou desvincule-os antes de excluir';
  END IF;

  -- Entitlements/memberships/tokens caem por CASCADE; dados de domínio têm FK
  -- RESTRICT e disparam foreign_key_violation, que traduzimos abaixo.
  BEGIN
    DELETE FROM public.organizations WHERE id = p_org;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'empresa possui dados vinculados (inspeções, RTI, EPIs, etc.); desative-a em vez de excluir';
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_delete_org(uuid) TO authenticated;
