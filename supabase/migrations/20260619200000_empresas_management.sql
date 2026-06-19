-- ============================================================================
-- GESTÃO DE EMPRESAS — coluna `ativa`, desativação imposta no RLS, RPCs de CRUD
-- ----------------------------------------------------------------------------
-- Migration ADITIVA e idempotente. Aplicada via MCP do Supabase (apply_migration).
-- Depende de 20260614000000_multitenancy_foundation.sql.
-- ============================================================================

-- ---------- 1. Coluna de status (soft-deactivate) ----------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ativa boolean NOT NULL DEFAULT true;

-- ---------- 2. can_access_org passa a exigir org-alvo ATIVA ----------
-- platform admin faz bypass (enxerga inativas para reativar). Para os demais,
-- o acesso só vale se a org-alvo estiver ativa. Esta é a função-base do RLS de
-- TODAS as tabelas de domínio — ver teste de regressão em empresas_rpc_test.sql.
CREATE OR REPLACE FUNCTION public.can_access_org(_uid uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_platform_admin(_uid)
    OR (
      EXISTS (SELECT 1 FROM public.organizations oa WHERE oa.id = _org_id AND oa.ativa)
      AND (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = _uid AND m.org_id = _org_id)
        OR EXISTS (
          SELECT 1 FROM public.org_memberships m
          JOIN public.organizations o ON o.parent_org_id = m.org_id
          WHERE m.user_id = _uid AND o.id = _org_id)
        OR EXISTS (
          SELECT 1 FROM public.org_memberships m
          JOIN public.organizations o ON o.managed_by_org_id = m.org_id
          WHERE m.user_id = _uid AND o.id = _org_id)
      )
    );
$$;

-- ---------- 3. RPCs SECURITY DEFINER (autz própria via auth.uid()) ----------

-- 3a. Criar org + entitlements numa transação. Só platform admin.
CREATE OR REPLACE FUNCTION public.fn_create_org(
  p_nome text,
  p_tipo public.org_tipo,
  p_managed_by uuid,
  p_parent uuid,
  p_entitlements text[]
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new_id uuid; _ent text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF coalesce(btrim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'nome obrigatório';
  END IF;
  IF p_tipo = 'unidade' AND p_parent IS NULL THEN
    RAISE EXCEPTION 'unidade requer empresa-mãe';
  END IF;
  IF p_entitlements IS NOT NULL THEN
    FOREACH _ent IN ARRAY p_entitlements LOOP
      IF _ent NOT IN ('gestao_completa', 'rti_pwa', 'loto') THEN
        RAISE EXCEPTION 'entitlement inválido: %', _ent;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.organizations (nome, tipo, managed_by_org_id, parent_org_id)
  VALUES (
    btrim(p_nome),
    p_tipo,
    CASE WHEN p_tipo = 'cliente'  THEN p_managed_by ELSE NULL END,
    CASE WHEN p_tipo = 'unidade'  THEN p_parent     ELSE NULL END
  )
  RETURNING id INTO _new_id;

  IF p_entitlements IS NOT NULL THEN
    INSERT INTO public.org_entitlements (org_id, module)
    SELECT _new_id, unnest(p_entitlements)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN _new_id;
END;
$$;

-- 3b. Editar nome/vínculo. Platform admin OU consultor admin na consultoria
-- gestora. Consultor só renomeia; troca de vínculo é exclusiva do platform admin.
CREATE OR REPLACE FUNCTION public.fn_update_org(
  p_org uuid,
  p_nome text,
  p_managed_by uuid,
  p_parent uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tipo public.org_tipo; _is_pa boolean := public.is_platform_admin(auth.uid());
BEGIN
  SELECT tipo INTO _tipo FROM public.organizations WHERE id = p_org;
  IF _tipo IS NULL THEN
    RAISE EXCEPTION 'empresa não encontrada';
  END IF;
  IF NOT _is_pa THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org
        AND o.managed_by_org_id IS NOT NULL
        AND public.org_role_at_least(auth.uid(), o.managed_by_org_id, 'admin')
    ) THEN
      RAISE EXCEPTION 'sem permissão';
    END IF;
  END IF;
  IF coalesce(btrim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'nome obrigatório';
  END IF;

  IF _is_pa THEN
    UPDATE public.organizations
    SET nome = btrim(p_nome),
        managed_by_org_id = CASE WHEN _tipo = 'cliente' THEN p_managed_by ELSE managed_by_org_id END,
        parent_org_id     = CASE WHEN _tipo = 'unidade' THEN p_parent     ELSE parent_org_id END
    WHERE id = p_org;
  ELSE
    UPDATE public.organizations SET nome = btrim(p_nome) WHERE id = p_org;
  END IF;
END;
$$;

-- 3c. Substituir o conjunto de entitlements. Só platform admin.
CREATE OR REPLACE FUNCTION public.fn_set_org_entitlements(
  p_org uuid,
  p_entitlements text[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ent text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF p_entitlements IS NOT NULL THEN
    FOREACH _ent IN ARRAY p_entitlements LOOP
      IF _ent NOT IN ('gestao_completa', 'rti_pwa', 'loto') THEN
        RAISE EXCEPTION 'entitlement inválido: %', _ent;
      END IF;
    END LOOP;
  END IF;
  DELETE FROM public.org_entitlements WHERE org_id = p_org;
  IF p_entitlements IS NOT NULL THEN
    INSERT INTO public.org_entitlements (org_id, module)
    SELECT p_org, unnest(p_entitlements)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- 3d. Ativar/desativar (soft). Só platform admin (decisão comercial).
CREATE OR REPLACE FUNCTION public.fn_set_org_active(
  p_org uuid,
  p_ativa boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  UPDATE public.organizations SET ativa = p_ativa WHERE id = p_org;
END;
$$;

-- ---------- 4. GRANTs (chamáveis pelo usuário autenticado; a autz é interna) ----------
GRANT EXECUTE ON FUNCTION public.fn_create_org(text, public.org_tipo, uuid, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_update_org(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_set_org_entitlements(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_set_org_active(uuid, boolean) TO authenticated;
