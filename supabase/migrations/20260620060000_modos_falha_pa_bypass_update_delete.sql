-- Adiciona is_platform_admin() como bypass standalone em UPDATE e DELETE.
--
-- Antes: UPDATE/DELETE só permitiam PA em modos globais (org_id IS NULL).
-- Se o PA tentasse editar/excluir um modo criado por uma consultoria
-- (org_id = consultoria_id), a policy bloqueava silenciosamente porque
-- is_platform_admin() só aparecia emparelhado com org_id IS NULL.
--
-- Solução: mesma abordagem já usada no INSERT (migration 20260620040000) —
-- is_platform_admin() como primeira condição OR independente.

DROP POLICY IF EXISTS "modos_update" ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_delete" ON public.rti_modos_falha;

CREATE POLICY "modos_update" ON public.rti_modos_falha FOR UPDATE
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      org_id IS NOT NULL
      AND EXISTS (
        SELECT 1
          FROM public.org_memberships om
          JOIN public.organizations   o  ON o.id = om.org_id
         WHERE om.user_id  = auth.uid()
           AND om.org_id   = rti_modos_falha.org_id
           AND (
             (o.tipo = 'consultoria'          AND om.org_role IN ('member','admin','owner'))
             OR
             (o.tipo IN ('cliente','unidade') AND om.org_role IN ('admin','owner'))
           )
      )
    )
  );

CREATE POLICY "modos_delete" ON public.rti_modos_falha FOR DELETE
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      org_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.org_memberships
         WHERE user_id  = auth.uid()
           AND org_id   = rti_modos_falha.org_id
           AND org_role IN ('admin','owner')
      )
    )
  );
