-- ============================================================================
-- Trilha D — digest semanal por e-mail (D2). Idempotente.
-- profiles.digest_optout: admin que não quer receber (default recebe — D-D7).
-- digest_log: idempotência por (org, semana) — cron reexecutado não duplica.
-- Agendamento: pg_cron + pg_net chamando a Edge Function vencimentos-email
-- toda segunda 11:00 UTC (08:00 BRT) — mesmo padrão do orphan-sweep mensal.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS digest_optout boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.digest_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  semana        date NOT NULL,             -- segunda-feira ISO da semana enviada
  enviado_em    timestamptz NOT NULL DEFAULT now(),
  destinatarios text[] NOT NULL DEFAULT '{}',
  UNIQUE (org_id, semana)
);
ALTER TABLE public.digest_log ENABLE ROW LEVEL SECURITY;
-- Escrita só pela service role (edge function, que ignora RLS); leitura p/ auditoria.
DROP POLICY IF EXISTS "digest_log_admin_select" ON public.digest_log;
CREATE POLICY "digest_log_admin_select" ON public.digest_log FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- Agendamento semanal.
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$ BEGIN
  PERFORM cron.unschedule('digest-semanal');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'digest-semanal',
  '0 11 * * 1',
  $$
  select net.http_post(
    url := 'https://fumwovtzyhxrjhkjzujs.supabase.co/functions/v1/vencimentos-email',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1bXdvdnR6eWh4cmpoa2p6dWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTAxODMsImV4cCI6MjA5NjUyNjE4M30.HJa2zsUQLo2ygUMGaft8fDg0_YAxAgKb2mOykmITF10',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
