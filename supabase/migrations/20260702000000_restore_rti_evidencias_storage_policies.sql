-- Recria as políticas RLS de storage.objects para o bucket rti-evidencias.
-- O bucket foi deletado/recriado manualmente em 2026-07-02 (limpeza de fotos grandes
-- que estouraram a cota), o que removeu as 4 políticas associadas. Restaura o padrão
-- pós-RBAC (org_memberships), idêntico ao definido em 20260609300000 + 20260620000000.
--
-- Também reconfigura o bucket: mantém público (o app lê via getPublicUrl),
-- teto de 5 MB e MIME types restritos a imagem + PDF, alinhado à compressão 1024px.

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = ARRAY[
    'image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'
  ]
WHERE id = 'rti-evidencias';

DROP POLICY IF EXISTS "rti_evidencias_public_read" ON storage.objects;
DROP POLICY IF EXISTS "rti_evidencias_org_insert"  ON storage.objects;
DROP POLICY IF EXISTS "rti_evidencias_org_update"  ON storage.objects;
DROP POLICY IF EXISTS "rti_evidencias_org_delete"  ON storage.objects;

CREATE POLICY "rti_evidencias_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'rti-evidencias');

CREATE POLICY "rti_evidencias_org_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rti-evidencias'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );

CREATE POLICY "rti_evidencias_org_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'rti-evidencias'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );

CREATE POLICY "rti_evidencias_org_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'rti-evidencias'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );
