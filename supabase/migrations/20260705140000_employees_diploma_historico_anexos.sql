-- Anexos de diploma e histórico escolar por colaborador (Storage, bucket "certificates").
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS diploma_arquivo_path text,
  ADD COLUMN IF NOT EXISTS historico_arquivo_path text;
