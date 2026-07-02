-- Autoria de coleta em campo: quem estava logado quando o ponto foi criado.
-- Nullable — pontos existentes (pré-migração) ficam com autor desconhecido,
-- tratado como "não registrado" no lado da leitura (não é erro).
alter table public.field_points
  add column collected_by_user_id uuid references auth.users(id),
  add column collected_by_name text;
