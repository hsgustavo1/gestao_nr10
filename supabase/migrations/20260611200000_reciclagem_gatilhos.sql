-- ============ GATILHOS DE RECICLAGEM EXTRAORDINÁRIA (NR-10 10.8.8.x) ============
-- Reciclagem também é exigida em: retorno de afastamento > 3 meses e
-- mudança de função. A flag é setada pela aplicação ao detectar o gatilho
-- e limpa quando uma nova reciclagem é registrada.

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS afastado_desde date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS retorno_em date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS reciclagem_requerida boolean NOT NULL DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS reciclagem_motivo text;
