-- ============ CAMPOS COMPLETOS DE CAPACITAÇÃO (fiscalização) ============
-- O auditor fiscal pede: carga horária (40h básico, +40h SEP), conteúdo
-- programático, entidade/instrutor. Sem isso o registro é incompleto.

ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS carga_horaria integer;
ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS entidade text;
ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS instrutor text;
ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS conteudo_programatico text;
