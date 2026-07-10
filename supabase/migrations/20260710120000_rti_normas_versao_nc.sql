-- Fundação do laudo RTI: campos de norma na NC + versão de norma no report.
-- Aditivo; linhas existentes recebem defaults.

alter table rti_ncs
  add column titulo text,
  add column normas jsonb not null default '[]'::jsonb,
  add column gravidade_nr28_override smallint
    check (gravidade_nr28_override between 1 and 4);

alter table rti_reports
  add column norma_versao text not null default 'nr10:2019';
