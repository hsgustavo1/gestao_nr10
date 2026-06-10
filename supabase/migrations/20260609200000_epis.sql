-- ============ GESTÃO DE EPIs/EPCs ESPECIAIS (NR-10 10.2.4 c/e) ============
CREATE TABLE public.epis (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epi_type             text NOT NULL CHECK (epi_type IN (
                         'luva_isolante',
                         'manga_isolante',
                         'detector_tensao',
                         'bastao_isolante',
                         'tapete_isolante',
                         'cobertura_isolante',
                         'outros'
                       )),
  description          text,             -- ex.: Luva classe 00, tamanho 9
  epi_class            text,             -- classe de isolação (00, 0, 1, 2...)
  serial_number        text,             -- número de série / identificação única
  ca                   text,             -- Certificado de Aprovação (CA)
  employee_id          uuid REFERENCES public.employees(id) ON DELETE SET NULL,  -- NULL = uso coletivo/setor
  sector               text,
  acquisition_date     date,
  test_interval_months integer NOT NULL DEFAULT 6,  -- ensaios dielétricos semestrais por padrão
  active               boolean NOT NULL DEFAULT true,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.epis ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_epis_type ON public.epis(epi_type);
CREATE INDEX idx_epis_employee ON public.epis(employee_id);

-- Histórico de ensaios (dielétricos e outros testes periódicos)
CREATE TABLE public.epi_tests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epi_id           uuid NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  test_date        date NOT NULL,
  result           text NOT NULL DEFAULT 'aprovado' CHECK (result IN ('aprovado','reprovado')),
  laboratory       text,
  certificate_path text,            -- certificado do ensaio no bucket epi-docs
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.epi_tests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_epi_tests_epi ON public.epi_tests(epi_id);
CREATE INDEX idx_epi_tests_date ON public.epi_tests(test_date);

CREATE TRIGGER epis_touch
  BEFORE UPDATE ON public.epis
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: leitura geral, escrita staff, exclusão admin
CREATE POLICY "epis_read_all"     ON public.epis FOR SELECT USING (true);
CREATE POLICY "epis_staff_insert" ON public.epis FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "epis_staff_update" ON public.epis FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "epis_admin_delete" ON public.epis FOR DELETE USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "epitests_read_all"     ON public.epi_tests FOR SELECT USING (true);
CREATE POLICY "epitests_staff_insert" ON public.epi_tests FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "epitests_staff_update" ON public.epi_tests FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "epitests_admin_delete" ON public.epi_tests FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ============ BUCKET epi-docs ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('epi-docs', 'epi-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "epi_docs_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'epi-docs');

CREATE POLICY "epi_docs_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'epi-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "epi_docs_staff_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'epi-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "epi_docs_admin_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'epi-docs' AND public.has_role(auth.uid(),'admin'));
