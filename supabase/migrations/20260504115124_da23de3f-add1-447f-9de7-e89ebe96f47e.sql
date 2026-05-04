-- Permitir upload e atualização públicos de fotos no bucket padlock-photos
-- (necessário para visualizadores sem login imprimirem etiquetas com foto)
DROP POLICY IF EXISTS padlock_photos_staff_insert ON storage.objects;
DROP POLICY IF EXISTS padlock_photos_staff_update ON storage.objects;

CREATE POLICY padlock_photos_public_insert
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'padlock-photos');

CREATE POLICY padlock_photos_public_update
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'padlock-photos');
