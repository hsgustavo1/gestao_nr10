-- Inverte a semântica do campo de invalidação manual da autorização de trabalho.
-- Antes: `valid` (default false) exigia marcação manual positiva para autorizar.
-- Depois: `suspended` (default false) é uma suspensão manual explícita do PLH —
-- por padrão a autorização não está suspensa; o PLH ativa o switch só quando
-- decide suspender, mesmo que ASO/treinamento estejam em dia.
alter table public.work_authorizations add column suspended boolean not null default false;

update public.work_authorizations set suspended = not valid;

alter table public.work_authorizations drop column valid;
