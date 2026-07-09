-- Vínculo foto→achado (evidência certa na NC certa) + geolocalização da captura.
-- Spec: docs/superpowers/specs/2026-07-08-campo-pwa-cofre-e-portao-design.md §5.2, §6.1
-- finding_id é NULLABLE: fotos antigas e fotos "gerais do ponto" continuam válidas.
-- ON DELETE SET NULL: apagar a NC não apaga a foto (a evidência volta a ser do ponto).

ALTER TABLE public.field_photos
  ADD COLUMN IF NOT EXISTS finding_id uuid REFERENCES public.field_findings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gps_lat double precision,
  ADD COLUMN IF NOT EXISTS gps_lng double precision,
  ADD COLUMN IF NOT EXISTS gps_accuracy double precision;

CREATE INDEX IF NOT EXISTS idx_field_photos_finding_id ON public.field_photos(finding_id);
