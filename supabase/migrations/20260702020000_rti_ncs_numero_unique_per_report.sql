-- Torna autoritativa no banco a regra "número da NC único por relatório", que hoje
-- só existe como aviso client-side (derivado de cache React Query, sujeito a
-- refetch/staleness). Sem essa constraint, um cache desatualizado no momento da
-- checagem no formulário podia mostrar um falso aviso de duplicado sem garantir
-- nada de fato -- e vice-versa, nada impedia uma duplicata real.
alter table public.rti_ncs
  add constraint rti_ncs_report_numero_key unique (report_id, numero);
