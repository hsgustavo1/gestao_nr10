-- Permite que o admin de uma org consultoria ative/desative
-- as empresas-cliente que ela gere (managed_by_org_id = org do consultor).
-- Platform admin mantém acesso irrestrito.
CREATE OR REPLACE FUNCTION public.fn_set_org_active(p_org uuid, p_ativa boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_managed_by uuid;
BEGIN
  SELECT managed_by_org_id INTO v_managed_by FROM public.organizations WHERE id = p_org;

  IF NOT (
    public.is_platform_admin(auth.uid())
    OR (
      v_managed_by IS NOT NULL
      AND public.org_role_at_least(auth.uid(), v_managed_by, 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  UPDATE public.organizations SET ativa = p_ativa WHERE id = p_org;
END;
$$;
