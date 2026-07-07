-- ============ TRAINING CERTIFICATES ============
-- Certificados de treinamento (NR-10) anexados por colaborador, incluindo a
-- importação em lote (recorte por certificado a partir de um PDF/imagens).
-- RLS espelha o padrão multi-tenant de employee_formacoes/employee_plh:
-- leitura por org, escrita gateada por fn_employee_editable (aceita membro da
-- org E consultor-manager). NÃO usa o gating legado is_staff()/has_role().
CREATE TABLE public.training_certificates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES public.organizations(id),
  nr10_training_id uuid REFERENCES public.nr10_trainings(id) ON DELETE SET NULL,
  training_type    text,         -- nr10_basico | nr10_areas_classificadas | sep
  category         text,         -- formacao | reciclagem
  file_url         text NOT NULL,
  file_name        text,
  issue_date       date,
  source_file      text,         -- nome do PDF/lote de origem (importação em lote)
  pages_in_source  text,         -- ex.: "3-4" = páginas 3 e 4 do PDF original
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_certificates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_certs_employee ON public.training_certificates(employee_id);
CREATE INDEX idx_certs_training ON public.training_certificates(nr10_training_id);
CREATE INDEX idx_certs_org ON public.training_certificates(org_id);

CREATE POLICY "training_certificates_org_select" ON public.training_certificates FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id));

CREATE POLICY "training_certificates_org_insert" ON public.training_certificates FOR INSERT
  WITH CHECK (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "training_certificates_org_update" ON public.training_certificates FOR UPDATE
  USING (public.fn_employee_editable(auth.uid(), employee_id));

CREATE POLICY "training_certificates_org_delete" ON public.training_certificates FOR DELETE
  USING (public.fn_employee_editable(auth.uid(), employee_id));
