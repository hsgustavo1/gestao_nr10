-- Add status field to employees
-- 'ativo' = active (default)
-- 'afastado' = on leave / away
-- 'desligado' = dismissed / terminated (replaces active=false)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo'
  CHECK (status IN ('ativo', 'afastado', 'desligado'));

-- Migrate existing soft-deleted employees (active=false) to desligado
UPDATE public.employees SET status = 'desligado' WHERE active = false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
