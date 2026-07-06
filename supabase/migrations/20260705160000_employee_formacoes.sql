-- Suporta múltiplas Escolaridade/Formação por colaborador, cada uma com seus próprios
-- anexos de diploma e histórico escolar (antes eram campos únicos em employees).
-- RLS espelha o padrão já usado em nr10_trainings (tabela filha de employees).

CREATE TABLE public.employee_formacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  formacao text NOT NULL,
  diploma_conclusao date,
  diploma_arquivo_path text,
  historico_arquivo_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_formacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_formacoes_org_select" ON public.employee_formacoes FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id));

CREATE POLICY "employee_formacoes_org_insert" ON public.employee_formacoes FOR INSERT
  WITH CHECK (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "employee_formacoes_org_update" ON public.employee_formacoes FOR UPDATE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "employee_formacoes_org_delete" ON public.employee_formacoes FOR DELETE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

-- Backfill: colaboradores que já tinham escolaridade/diploma preenchidos nos campos únicos
-- viram a primeira formação da lista, para não perder o que já estava cadastrado.
INSERT INTO public.employee_formacoes (employee_id, org_id, formacao, diploma_conclusao, diploma_arquivo_path, historico_arquivo_path)
SELECT id, org_id, escolaridade, diploma_conclusao, diploma_arquivo_path, historico_arquivo_path
FROM public.employees
WHERE escolaridade IS NOT NULL AND btrim(escolaridade) <> '';
