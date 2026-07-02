-- Corrige o FK de collected_by_user_id: SET NULL na deleção do usuário, para
-- manter consistência com o padrão já usado em outras colunas FK pra
-- auth.users(id) neste repo (ex.: created_by em nr10_prontuario, inspections,
-- rti_plano_acao) — sem isso, deletar um usuário falharia se ele tiver
-- alguma vez criado um field_points.
alter table public.field_points
  drop constraint field_points_collected_by_user_id_fkey;

alter table public.field_points
  add constraint field_points_collected_by_user_id_fkey
  foreign key (collected_by_user_id) references auth.users(id) on delete set null;
