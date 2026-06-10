-- ============ ASO — ATESTADO DE SAÚDE OCUPACIONAL (NR-10 10.8.7) ============
-- Trabalhadores autorizados devem ter aptidão atestada em exame médico (PCMSO).
-- O ASO alimenta o motor de aptidão: sem ASO válido, o colaborador não pode
-- ser considerado apto para trabalho em eletricidade.

CREATE TABLE public.asos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exam_date         date NOT NULL,
  validity_date     date NOT NULL,             -- vencimento do ASO
  tipo              text NOT NULL DEFAULT 'periodico' CHECK (tipo IN (
                      'admissional',
                      'periodico',
                      'retorno_trabalho',
                      'mudanca_funcao',
                      'demissional'
                    )),
  resultado         text NOT NULL DEFAULT 'apto' CHECK (resultado IN (
                      'apto',
                      'apto_com_restricoes',
                      'inapto'
                    )),
  apto_eletricidade boolean NOT NULL DEFAULT true,  -- aptidão específica p/ trabalho em eletricidade
  restricoes        text,
  medico            text,                       -- médico examinador / CRM
  file_path         text,                       -- arquivo do ASO no bucket aso-docs
  notes             text,
  created_by_name   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_asos_employee ON public.asos(employee_id);
CREATE INDEX idx_asos_validity ON public.asos(validity_date);

CREATE TRIGGER asos_touch
  BEFORE UPDATE ON public.asos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: leitura geral, escrita staff, exclusão admin
CREATE POLICY "asos_read_all"     ON public.asos FOR SELECT USING (true);
CREATE POLICY "asos_staff_insert" ON public.asos FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "asos_staff_update" ON public.asos FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "asos_admin_delete" ON public.asos FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ============ BUCKET aso-docs ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('aso-docs', 'aso-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "aso_docs_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'aso-docs');

CREATE POLICY "aso_docs_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'aso-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "aso_docs_staff_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'aso-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "aso_docs_admin_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'aso-docs' AND public.has_role(auth.uid(),'admin'));
