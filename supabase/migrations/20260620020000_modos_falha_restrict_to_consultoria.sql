-- Corrige escopo de escrita em rti_modos_falha.
-- A tabela é um catálogo GLOBAL (sem org_id). Apenas platform admin e
-- membros de orgs do tipo 'consultoria' devem poder criar/editar modos.
-- Clientes (tipo 'cliente'/'unidade') só leem — não poluem o catálogo global.

DROP POLICY IF EXISTS "modos_org_insert" ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_org_update" ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_org_delete" ON public.rti_modos_falha;

CREATE POLICY "modos_consultoria_insert" ON public.rti_modos_falha FOR INSERT
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations o ON o.id = om.org_id
       WHERE om.user_id = auth.uid()
         AND om.org_role IN ('member', 'admin', 'owner')
         AND o.tipo = 'consultoria'
    )
  );

CREATE POLICY "modos_consultoria_update" ON public.rti_modos_falha FOR UPDATE
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations o ON o.id = om.org_id
       WHERE om.user_id = auth.uid()
         AND om.org_role IN ('member', 'admin', 'owner')
         AND o.tipo = 'consultoria'
    )
  );

CREATE POLICY "modos_consultoria_delete" ON public.rti_modos_falha FOR DELETE
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations o ON o.id = om.org_id
       WHERE om.user_id = auth.uid()
         AND om.org_role IN ('admin', 'owner')
         AND o.tipo = 'consultoria'
    )
  );
