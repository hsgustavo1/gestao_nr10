-- Amplia política INSERT de rti_modos_falha para platform admin.
--
-- Problema: após adicionar org_id (migration 20260620030000), a política INSERT
-- exigia org_id IS NULL para PA, mas a UI passou a usar currentOrg?.id como
-- org_id — logo PA com consultoria selecionada gerava org_id ≠ NULL e a RLS
-- bloqueava silenciosamente.
--
-- Solução: is_platform_admin() como bypass standalone. PA pode inserir em
-- qualquer escopo (global org_id=NULL, ou org-scoped). Os outros perfis
-- permanecem restritos ao seu próprio org_id.

DROP POLICY IF EXISTS "modos_insert" ON public.rti_modos_falha;

CREATE POLICY "modos_insert" ON public.rti_modos_falha FOR INSERT
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      rti_modos_falha.org_id IS NOT NULL
      AND EXISTS (
        SELECT 1
          FROM public.org_memberships om
          JOIN public.organizations   o  ON o.id = om.org_id
         WHERE om.user_id = auth.uid()
           AND om.org_id  = rti_modos_falha.org_id
           AND (
             (o.tipo = 'consultoria'          AND om.org_role IN ('member','admin','owner'))
             OR
             (o.tipo IN ('cliente','unidade') AND om.org_role IN ('admin','owner'))
           )
      )
    )
  );
