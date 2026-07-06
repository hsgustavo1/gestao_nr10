-- PLH (Profissional Legalmente Habilitado) — dados exigidos para colaboradores
-- com classificacao = 'Habilitado' (crea_cft já obrigatório nesse caso via UI).
-- RLS espelha o padrão de employee_formacoes (tabela filha de employees).

-- 1) Dados únicos por colaborador: termo de nomeação + ART de cargo e função.
CREATE TABLE public.employee_plh (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  termo_nomeacao_data date,
  termo_nomeacao_arquivo_path text,
  art_cargo_funcao text,
  art_cargo_funcao_arquivo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_plh ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_plh_org_select" ON public.employee_plh FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id));

CREATE POLICY "employee_plh_org_insert" ON public.employee_plh FOR INSERT
  WITH CHECK (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "employee_plh_org_update" ON public.employee_plh FOR UPDATE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "employee_plh_org_delete" ON public.employee_plh FOR DELETE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

-- 2) Anuidades do conselho de classe (CREA/CFT) — um registro por ano, com comprovante.
CREATE TABLE public.employee_crea_anuidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  ano integer NOT NULL,
  data_pagamento date,
  comprovante_arquivo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, ano)
);

ALTER TABLE public.employee_crea_anuidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_crea_anuidades_org_select" ON public.employee_crea_anuidades FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id));

CREATE POLICY "employee_crea_anuidades_org_insert" ON public.employee_crea_anuidades FOR INSERT
  WITH CHECK (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "employee_crea_anuidades_org_update" ON public.employee_crea_anuidades FOR UPDATE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "employee_crea_anuidades_org_delete" ON public.employee_crea_anuidades FOR DELETE
  USING (public.fn_employee_editable(auth.uid(), employee_id));
