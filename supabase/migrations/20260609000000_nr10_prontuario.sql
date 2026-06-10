-- ============ PRONTUÁRIO DAS INSTALAÇÕES ELÉTRICAS (NR-10 itens 10.2.3 / 10.2.4) ============
CREATE TABLE public.nr10_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text NOT NULL CHECK (category IN (
                    'esquema_unifilar',
                    'procedimentos',
                    'inspecoes_spda_aterramento',
                    'especificacao_epi_epc',
                    'qualificacao_trabalhadores',
                    'testes_isolacao',
                    'certificacao_areas_classificadas',
                    'relatorio_inspecoes',
                    'outros'
                  )),
  title           text NOT NULL,
  description     text,
  document_date   date,
  validity_date   date,            -- NULL = documento sem prazo de validade
  file_path       text,            -- caminho no bucket nr10-docs
  responsavel     text,
  art             text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nr10_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_nr10_documents_category ON public.nr10_documents(category);
CREATE INDEX idx_nr10_documents_validity ON public.nr10_documents(validity_date);

CREATE TRIGGER nr10_documents_touch
  BEFORE UPDATE ON public.nr10_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: leitura geral, escrita staff, exclusão admin (mesmo padrão das demais tabelas)
CREATE POLICY "nr10doc_read_all"     ON public.nr10_documents FOR SELECT USING (true);
CREATE POLICY "nr10doc_staff_insert" ON public.nr10_documents FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "nr10doc_staff_update" ON public.nr10_documents FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "nr10doc_admin_delete" ON public.nr10_documents FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ============ BUCKET nr10-docs ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('nr10-docs', 'nr10-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "nr10_docs_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'nr10-docs');

CREATE POLICY "nr10_docs_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'nr10-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "nr10_docs_staff_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'nr10-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "nr10_docs_admin_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'nr10-docs' AND public.has_role(auth.uid(),'admin'));
