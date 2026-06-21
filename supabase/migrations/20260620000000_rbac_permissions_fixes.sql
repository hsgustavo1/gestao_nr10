-- ============================================================
-- RBAC PERMISSIONS FIXES (2026-06-20)
-- Corrige quatro lacunas deixadas pela migração de multi-tenancy:
--   1. rti_modos_falha  — políticas ainda usavam is_staff/has_role global
--   2. rti_nc_evidencias INSERT — permite distinção por tipo (constatacao vs correcao)
--   3. storage.objects rti-evidencias — upload ainda exigia is_staff
--   4. rti_reports DELETE — adm de cliente conseguia apagar relatório do consultor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. rti_modos_falha
--    Tabela sem org_id (base global compartilhada; per-org no roadmap).
--    INSERT/UPDATE: qualquer membro ativo de qualquer org.
--    DELETE: somente platform admin ou org admin/owner.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "modos_staff_insert" ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_staff_update" ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_admin_delete" ON public.rti_modos_falha;

CREATE POLICY "modos_org_insert" ON public.rti_modos_falha FOR INSERT
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );

CREATE POLICY "modos_org_update" ON public.rti_modos_falha FOR UPDATE
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );

CREATE POLICY "modos_org_delete" ON public.rti_modos_falha FOR DELETE
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('admin', 'owner')
    )
  );

-- ────────────────────────────────────────────────────────────
-- 2. rti_nc_evidencias INSERT — regra por tipo
--    Qualificar rti_nc_evidencias.org_id explicitamente para evitar ambiguidade
--    com org_id das tabelas joinadas no subquery de constatacao.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rti_nc_evidencias_ins" ON public.rti_nc_evidencias;

CREATE POLICY "rti_nc_evidencias_ins" ON public.rti_nc_evidencias FOR INSERT
  WITH CHECK (
    (rti_nc_evidencias.tipo = 'correcao'
      AND public.org_role_at_least(auth.uid(), rti_nc_evidencias.org_id, 'member'))

    OR

    (rti_nc_evidencias.tipo = 'constatacao'
      AND EXISTS (
        SELECT 1
          FROM public.rti_ncs     nc
          JOIN public.rti_areas   ar ON ar.id = nc.area_id
          JOIN public.rti_reports rp ON rp.id = ar.report_id
         WHERE nc.id = rti_nc_evidencias.nc_id
           AND (
             (  (rp.entregue_por_org IS NULL OR rp.entregue_por_org = rp.org_id)
                AND public.org_role_at_least(auth.uid(), rti_nc_evidencias.org_id, 'member')
             )
             OR
             (  rp.entregue_por_org IS NOT NULL
                AND public.org_role_at_least(auth.uid(), rp.entregue_por_org, 'member')
             )
           )
      )
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. storage.objects — bucket rti-evidencias
--    Upload/update/delete exigiam is_staff; agora basta ser membro de alguma org.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rti_evidencias_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "rti_evidencias_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "rti_evidencias_staff_delete" ON storage.objects;

CREATE POLICY "rti_evidencias_org_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rti-evidencias'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );

CREATE POLICY "rti_evidencias_org_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'rti-evidencias'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );

CREATE POLICY "rti_evidencias_org_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'rti-evidencias'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4. rti_reports DELETE
--    Impede adm do cliente de apagar relatório entregue pelo consultor.
--    • Platform admin → pode tudo
--    • Adm da org-cliente → só apaga se não foi entregue por org externa
--    • Adm da org entregadora (consultor) → pode apagar o que entregou
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rti_reports_del" ON public.rti_reports;

CREATE POLICY "rti_reports_del" ON public.rti_reports FOR DELETE
  USING (
    public.is_platform_admin(auth.uid())

    OR (
      public.org_role_at_least(auth.uid(), org_id, 'admin')
      AND (entregue_por_org IS NULL OR entregue_por_org = org_id)
    )

    OR (
      entregue_por_org IS NOT NULL
      AND public.org_role_at_least(auth.uid(), entregue_por_org, 'admin')
    )
  );
