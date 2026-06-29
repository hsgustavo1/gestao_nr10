-- Troca unique(matricula) por unique(matricula, org_id) para suportar multi-tenant.
-- A constraint global impedia que dois clientes tivessem funcionários com a mesma matrícula.
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_matricula_key;
ALTER TABLE public.employees ADD CONSTRAINT employees_matricula_org_key UNIQUE (matricula, org_id);
