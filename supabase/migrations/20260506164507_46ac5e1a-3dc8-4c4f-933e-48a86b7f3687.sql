
CREATE TABLE public.padlock_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_date date NOT NULL,
  reason text NOT NULL,
  requester text NOT NULL,
  sector text NOT NULL,
  document_path text NOT NULL,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.padlock_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "violations_public_read"
ON public.padlock_violations FOR SELECT
USING (true);

CREATE POLICY "violations_staff_insert"
ON public.padlock_violations FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('violation-docs', 'violation-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "violation_docs_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'violation-docs');

CREATE POLICY "violation_docs_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'violation-docs' AND public.is_staff(auth.uid()));
