-- Expande a allowlist de entitlements para incluir os novos módulos individuais
-- rti, campo_pwa e pessoas (separados do bundle legado rti_pwa / gestao_completa).

CREATE OR REPLACE FUNCTION public.fn_create_org(p_nome text, p_tipo org_tipo, p_managed_by uuid, p_parent uuid, p_entitlements text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      IF _ent NOT IN ('gestao_completa', 'rti_pwa', 'loto', 'rti', 'campo_pwa', 'pessoas') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_set_org_entitlements(p_org uuid, p_entitlements text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _ent text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF p_entitlements IS NOT NULL THEN
    FOREACH _ent IN ARRAY p_entitlements LOOP
      IF _ent NOT IN ('gestao_completa', 'rti_pwa', 'loto', 'rti', 'campo_pwa', 'pessoas') THEN
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
$function$;
