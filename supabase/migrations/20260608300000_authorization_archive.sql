-- Remove unique constraint to allow history accumulation
ALTER TABLE public.work_authorizations
  DROP CONSTRAINT IF EXISTS work_authorizations_employee_id_key;

-- Add is_current flag to distinguish current vs historical records
ALTER TABLE public.work_authorizations
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_wa_employee_current
  ON public.work_authorizations(employee_id, is_current);
