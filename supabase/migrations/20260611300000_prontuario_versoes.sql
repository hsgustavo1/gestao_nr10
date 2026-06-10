-- ============ VERSIONAMENTO DE DOCUMENTOS DO PRONTUÁRIO ============
-- O esquema unifilar e demais documentos do PIE exigem estar "atualizados".
-- Ao substituir o arquivo de um documento, a versão anterior é arquivada
-- aqui (o arquivo antigo permanece no bucket nr10-docs).

CREATE TABLE public.nr10_document_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES public.nr10_documents(id) ON DELETE CASCADE,
  file_path        text NOT NULL,
  file_name        text,
  document_date    date,
  validity_date    date,
  replaced_by_name text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nr10_document_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_nr10_doc_versions_document ON public.nr10_document_versions(document_id);

CREATE POLICY "nr10docver_read_all"     ON public.nr10_document_versions FOR SELECT USING (true);
CREATE POLICY "nr10docver_staff_insert" ON public.nr10_document_versions FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "nr10docver_admin_delete" ON public.nr10_document_versions FOR DELETE USING (public.has_role(auth.uid(),'admin'));
