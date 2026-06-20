-- ============================================================
-- rti_modos_falha: catálogo hierárquico por org_id
--
-- org_id = NULL            → modo global (dono do app)
--                            visível para todos
-- org_id = consultoria     → criado pelo consultor
--                            visível para o consultor + todos seus clientes
-- org_id = cliente/unidade → criado pelo admin do cliente
--                            visível apenas dentro dessa empresa
-- ============================================================

-- 1. Adicionar coluna
ALTER TABLE public.rti_modos_falha
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Dropar todas as policies existentes
DROP POLICY IF EXISTS "modos_read_all"             ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_consultoria_insert"   ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_consultoria_update"   ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_consultoria_delete"   ON public.rti_modos_falha;

-- 3. SELECT — visibilidade hierárquica
--   a) modo global (org_id IS NULL) → qualquer autenticado
--   b) modo da minha própria org (membro direto)
--   c) modo de uma consultoria que me gere (sou cliente dela)
CREATE POLICY "modos_select" ON public.rti_modos_falha FOR SELECT
  USING (
    org_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.org_memberships
       WHERE user_id = auth.uid()
         AND org_id  = rti_modos_falha.org_id
    )
    OR EXISTS (
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations   myorg ON myorg.id = om.org_id
       WHERE om.user_id              = auth.uid()
         AND myorg.managed_by_org_id = rti_modos_falha.org_id
    )
  );

-- 4. INSERT — quem pode criar e para qual org_id
--   • platform admin  → org_id = NULL (global)
--   • membro de consultoria (member+) → org_id = sua consultoria
--   • admin de cliente/unidade        → org_id = sua própria org
CREATE POLICY "modos_insert" ON public.rti_modos_falha FOR INSERT
  WITH CHECK (
    (rti_modos_falha.org_id IS NULL AND public.is_platform_admin(auth.uid()))
    OR (
      rti_modos_falha.org_id IS NOT NULL
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

-- 5. UPDATE — mesma regra de autoridade que o INSERT
CREATE POLICY "modos_update" ON public.rti_modos_falha FOR UPDATE
  USING (
    (org_id IS NULL AND public.is_platform_admin(auth.uid()))
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

-- 6. DELETE — exige admin+ em qualquer tipo de org
CREATE POLICY "modos_delete" ON public.rti_modos_falha FOR DELETE
  USING (
    (org_id IS NULL AND public.is_platform_admin(auth.uid()))
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
