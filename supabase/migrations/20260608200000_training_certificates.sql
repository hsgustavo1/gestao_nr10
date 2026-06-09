-- ============ TRAINING CERTIFICATES ============
CREATE TABLE public.training_certificates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  nr10_training_id uuid REFERENCES public.nr10_trainings(id) ON DELETE SET NULL,
  training_type    text,         -- nr10_basico | nr10_areas_classificadas | sep
  category         text,         -- formacao | reciclagem
  file_url         text NOT NULL,
  file_name        text,
  issue_date       date,
  source_file      text,         -- original PDF filename (for batch imports)
  pages_in_source  text,         -- e.g. "3-4" = pages 3 and 4 from original PDF
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_certificates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_certs_employee ON public.training_certificates(employee_id);
CREATE INDEX idx_certs_training ON public.training_certificates(nr10_training_id);

-- RLS: public read, staff insert, admin delete
CREATE POLICY "certs_read_all"    ON public.training_certificates FOR SELECT USING (true);
CREATE POLICY "certs_staff_insert" ON public.training_certificates FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "certs_staff_update" ON public.training_certificates FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "certs_admin_delete" ON public.training_certificates FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket instructions (apply via Supabase dashboard):
-- 1. Go to Storage > New Bucket > name: "certificates", public: false
-- 2. Add policy: authenticated users can upload (INSERT) to their paths
-- 3. Add policy: authenticated users can read (SELECT) all objects
