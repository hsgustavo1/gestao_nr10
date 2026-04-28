-- Bucket público para fotos de etiquetas LOTO (uma foto por cadeado, identificada pelo padlock.id)
INSERT INTO storage.buckets (id, name, public)
VALUES ('padlock-photos', 'padlock-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pública (etiqueta pode ser impressa por visualizadores)
DROP POLICY IF EXISTS "padlock_photos_public_read" ON storage.objects;
CREATE POLICY "padlock_photos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'padlock-photos');

-- Upload/substituição/remoção: apenas equipe (admin ou apoio)
DROP POLICY IF EXISTS "padlock_photos_staff_insert" ON storage.objects;
CREATE POLICY "padlock_photos_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'padlock-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "padlock_photos_staff_update" ON storage.objects;
CREATE POLICY "padlock_photos_staff_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'padlock-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "padlock_photos_staff_delete" ON storage.objects;
CREATE POLICY "padlock_photos_staff_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'padlock-photos' AND public.is_staff(auth.uid()));