-- Lista deduplicada de quem coletou evidências em campo para este relatório,
-- derivada de field_points.collected_by_name no momento da composição do RTI.
-- Distinto de responsavel_auditoria (quem assina/consolida o relatório).
alter table public.rti_reports
  add column coletores_campo text[];
