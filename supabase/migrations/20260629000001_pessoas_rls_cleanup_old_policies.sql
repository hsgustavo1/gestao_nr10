-- Remove políticas legadas duplicadas após a migration 20260629000000.
-- A migration anterior tentou DROP com nomes emp_read_all/emp_staff_* mas os
-- nomes reais eram employees_sel/ins/upd/del (idem para as tabelas filhas).
-- Com as duas séries coexistindo, as antigas (sem fn_org_is_manager e sem
-- created_by_org_id check) diluíam as restrições novas via OR semântico do RLS.

DROP POLICY IF EXISTS "employees_sel" ON public.employees;
DROP POLICY IF EXISTS "employees_ins" ON public.employees;
DROP POLICY IF EXISTS "employees_upd" ON public.employees;
DROP POLICY IF EXISTS "employees_del" ON public.employees;

DROP POLICY IF EXISTS "nr10_trainings_sel" ON public.nr10_trainings;
DROP POLICY IF EXISTS "nr10_trainings_ins" ON public.nr10_trainings;
DROP POLICY IF EXISTS "nr10_trainings_upd" ON public.nr10_trainings;
DROP POLICY IF EXISTS "nr10_trainings_del" ON public.nr10_trainings;

DROP POLICY IF EXISTS "work_authorizations_sel" ON public.work_authorizations;
DROP POLICY IF EXISTS "work_authorizations_ins" ON public.work_authorizations;
DROP POLICY IF EXISTS "work_authorizations_upd" ON public.work_authorizations;
DROP POLICY IF EXISTS "work_authorizations_del" ON public.work_authorizations;

DROP POLICY IF EXISTS "it_trainings_sel" ON public.it_trainings;
DROP POLICY IF EXISTS "it_trainings_ins" ON public.it_trainings;
DROP POLICY IF EXISTS "it_trainings_upd" ON public.it_trainings;
DROP POLICY IF EXISTS "it_trainings_del" ON public.it_trainings;
