-- ============================================================================
-- Pessoas — RLS org-scoped + created_by_org_id (2026-06-29)
-- ----------------------------------------------------------------------------
-- Problema: employees e tabelas filhas (nr10_trainings, work_authorizations,
-- it_trainings) ainda usavam políticas is_staff/has_role globais (legado
-- pré-multi-tenancy). Isso bloqueava consultores e clientes de inserir/editar
-- dados de pessoas, e não distinguia quem criou o registro.
--
-- Solução:
--   1. Adiciona created_by_org_id a employees (quem importou/criou).
--   2. Trigger: carimba created_by_org_id no INSERT (reutiliza fn_set_created_by_org).
--   3. Substitui políticas staff-globais por políticas org-scoped.
--   4. UPDATE/DELETE de employees: cliente só altera o que a própria org criou;
--      consultor (gestor via managed_by/parent) pode alterar tudo.
--   5. Tabelas filhas: INSERT/UPDATE/DELETE passam por fn_employee_editable,
--      que verifica created_by_org_id na raiz.
-- ============================================================================

-- ---------- 1. Coluna de procedência ----------
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_by_org_id uuid REFERENCES public.organizations(id);

-- Backfill: registros existentes = criados pela própria org (sem regressão)
UPDATE public.employees SET created_by_org_id = org_id WHERE created_by_org_id IS NULL;

-- ---------- 2. Trigger de procedência (reutiliza função já existente) ----------
DROP TRIGGER IF EXISTS trg_set_created_by_org ON public.employees;
CREATE TRIGGER trg_set_created_by_org BEFORE INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_created_by_org();

-- ---------- 3. Helper: pode este usuário editar este employee? ----------
-- Retorna true se:
--   a) usuário é gestor da org (consultor via managed_by / org-mãe / platform admin)
--   b) usuário é membro direto da org E o registro foi criado pela própria org
CREATE OR REPLACE FUNCTION public.fn_employee_editable(_uid uuid, _employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = _employee_id
      AND (
        public.fn_org_is_manager(_uid, e.org_id)
        OR (
          public.org_role_at_least(_uid, e.org_id, 'member')
          AND COALESCE(e.created_by_org_id = e.org_id, true)
        )
      )
  )
$$;

-- ---------- 4. employees — substituir políticas legadas ----------
DROP POLICY IF EXISTS "emp_read_all"     ON public.employees;
DROP POLICY IF EXISTS "emp_staff_insert" ON public.employees;
DROP POLICY IF EXISTS "emp_staff_update" ON public.employees;
DROP POLICY IF EXISTS "emp_admin_delete" ON public.employees;

-- SELECT: qualquer membro da org (ou gestor) pode ver
CREATE POLICY "emp_org_select" ON public.employees FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id));

-- INSERT: membro da org ou gestor
CREATE POLICY "emp_org_insert" ON public.employees FOR INSERT
  WITH CHECK (
    public.org_role_at_least(auth.uid(), org_id, 'member')
    OR public.fn_org_is_manager(auth.uid(), org_id)
  );

-- UPDATE: gestor sempre pode; cliente só se criou pela própria org
CREATE POLICY "emp_org_update" ON public.employees FOR UPDATE
  USING (
    public.fn_org_is_manager(auth.uid(), org_id)
    OR (
      public.org_role_at_least(auth.uid(), org_id, 'member')
      AND COALESCE(created_by_org_id = org_id, true)
    )
  );

-- DELETE: gestor sempre pode; admin-cliente só se criou pela própria org
CREATE POLICY "emp_org_delete" ON public.employees FOR DELETE
  USING (
    public.fn_org_is_manager(auth.uid(), org_id)
    OR (
      public.org_role_at_least(auth.uid(), org_id, 'admin')
      AND COALESCE(created_by_org_id = org_id, true)
    )
  );

-- ---------- 5. nr10_trainings — substituir políticas legadas ----------
DROP POLICY IF EXISTS "nr10_read_all"     ON public.nr10_trainings;
DROP POLICY IF EXISTS "nr10_staff_insert" ON public.nr10_trainings;
DROP POLICY IF EXISTS "nr10_staff_update" ON public.nr10_trainings;
DROP POLICY IF EXISTS "nr10_admin_delete" ON public.nr10_trainings;

CREATE POLICY "nr10_org_select" ON public.nr10_trainings FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id));

CREATE POLICY "nr10_org_insert" ON public.nr10_trainings FOR INSERT
  WITH CHECK (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "nr10_org_update" ON public.nr10_trainings FOR UPDATE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "nr10_org_delete" ON public.nr10_trainings FOR DELETE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

-- ---------- 6. work_authorizations — substituir políticas legadas ----------
DROP POLICY IF EXISTS "wa_read_all"     ON public.work_authorizations;
DROP POLICY IF EXISTS "wa_staff_insert" ON public.work_authorizations;
DROP POLICY IF EXISTS "wa_staff_update" ON public.work_authorizations;
DROP POLICY IF EXISTS "wa_admin_delete" ON public.work_authorizations;

CREATE POLICY "wa_org_select" ON public.work_authorizations FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id));

CREATE POLICY "wa_org_insert" ON public.work_authorizations FOR INSERT
  WITH CHECK (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "wa_org_update" ON public.work_authorizations FOR UPDATE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "wa_org_delete" ON public.work_authorizations FOR DELETE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

-- ---------- 7. it_trainings — substituir políticas legadas ----------
DROP POLICY IF EXISTS "it_read_all"     ON public.it_trainings;
DROP POLICY IF EXISTS "it_staff_insert" ON public.it_trainings;
DROP POLICY IF EXISTS "it_staff_update" ON public.it_trainings;
DROP POLICY IF EXISTS "it_admin_delete" ON public.it_trainings;

CREATE POLICY "it_org_select" ON public.it_trainings FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id));

CREATE POLICY "it_org_insert" ON public.it_trainings FOR INSERT
  WITH CHECK (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "it_org_update" ON public.it_trainings FOR UPDATE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "it_org_delete" ON public.it_trainings FOR DELETE
  USING (public.fn_employee_editable(auth.uid(), employee_id));
