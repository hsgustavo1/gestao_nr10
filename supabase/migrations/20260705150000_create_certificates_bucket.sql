-- Cria o bucket "certificates", referenciado por uploadCertificateFile (certificados de
-- treinamento NR-10) e pelos novos anexos de diploma/histórico escolar do colaborador,
-- mas que nunca havia sido criado de fato (bug pré-existente — uploads falhavam em silêncio).
-- Políticas seguem o mesmo padrão org-based já usado em rti-evidencias.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificates', 'certificates', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "certificates_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates');

CREATE POLICY "certificates_org_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'certificates'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );

CREATE POLICY "certificates_org_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'certificates'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );

CREATE POLICY "certificates_org_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'certificates'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_role IN ('member', 'admin', 'owner')
    )
  );
