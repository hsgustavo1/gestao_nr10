-- Unique constraint por org (multi-tenant) + RLS com suporte a consultores

ALTER TABLE public.work_instructions DROP CONSTRAINT IF EXISTS work_instructions_code_key;
ALTER TABLE public.work_instructions ADD CONSTRAINT work_instructions_code_org_key UNIQUE (code, org_id);

DROP POLICY IF EXISTS "work_instructions_ins" ON public.work_instructions;
DROP POLICY IF EXISTS "work_instructions_upd" ON public.work_instructions;
DROP POLICY IF EXISTS "work_instructions_del" ON public.work_instructions;

CREATE POLICY "work_instructions_ins" ON public.work_instructions FOR INSERT
  WITH CHECK (
    public.org_role_at_least(auth.uid(), org_id, 'member')
    OR public.fn_org_is_manager(auth.uid(), org_id)
  );

CREATE POLICY "work_instructions_upd" ON public.work_instructions FOR UPDATE
  USING (
    public.org_role_at_least(auth.uid(), org_id, 'member')
    OR public.fn_org_is_manager(auth.uid(), org_id)
  );

CREATE POLICY "work_instructions_del" ON public.work_instructions FOR DELETE
  USING (
    public.org_role_at_least(auth.uid(), org_id, 'admin')
    OR public.fn_org_is_manager(auth.uid(), org_id)
  );
