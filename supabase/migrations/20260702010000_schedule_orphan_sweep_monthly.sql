-- Agenda a varredura mensal de órfãos do bucket rti-evidencias (Edge Function orphan-sweep).
-- pg_net faz a chamada HTTP assíncrona; pg_cron dispara no primeiro dia de cada mês, 03h UTC.
-- Autenticação via chave anon (legacy JWT) do próprio projeto — aceita por verify_jwt=true na
-- função como "requisição legítima deste projeto"; a operação privilegiada usa a service-role
-- key injetada dentro da função, nunca exposta aqui.

create extension if not exists pg_net;

select cron.schedule(
  'orphan-sweep-mensal',
  '0 3 1 * *',
  $$
  select net.http_post(
    url := 'https://fumwovtzyhxrjhkjzujs.supabase.co/functions/v1/orphan-sweep',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1bXdvdnR6eWh4cmpoa2p6dWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTAxODMsImV4cCI6MjA5NjUyNjE4M30.HJa2zsUQLo2ygUMGaft8fDg0_YAxAgKb2mOykmITF10',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
