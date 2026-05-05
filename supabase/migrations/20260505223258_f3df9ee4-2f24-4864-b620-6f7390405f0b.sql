
-- Tabela de reports de inconsistência em dispositivos
CREATE TABLE public.padlock_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  padlock_id uuid NOT NULL,
  padlock_code text NOT NULL,
  reporter_name text,
  reporter_contact text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando',
  resolution_note text,
  resolved_by uuid,
  resolved_by_name text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT padlock_reports_status_check CHECK (status IN ('aguardando','solucionado','recusado'))
);

CREATE INDEX idx_padlock_reports_padlock ON public.padlock_reports(padlock_id);
CREATE INDEX idx_padlock_reports_status ON public.padlock_reports(status);

ALTER TABLE public.padlock_reports ENABLE ROW LEVEL SECURITY;

-- Qualquer um (logado ou não) pode criar um report
CREATE POLICY "reports_public_insert"
  ON public.padlock_reports FOR INSERT
  WITH CHECK (true);

-- Apenas admin (Dono de RAC) pode ver
CREATE POLICY "reports_admin_read"
  ON public.padlock_reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admin pode atualizar (marcar como solucionado/recusado)
CREATE POLICY "reports_admin_update"
  ON public.padlock_reports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admin pode deletar
CREATE POLICY "reports_admin_delete"
  ON public.padlock_reports FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER padlock_reports_touch_updated_at
  BEFORE UPDATE ON public.padlock_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Histórico imutável de mudanças nos reports
CREATE TABLE public.padlock_report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  padlock_id uuid NOT NULL,
  padlock_code text NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  actor_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_padlock_report_events_report ON public.padlock_report_events(report_id);

ALTER TABLE public.padlock_report_events ENABLE ROW LEVEL SECURITY;

-- Inserção pública (para registrar 'criado' quando reporter sem login)
CREATE POLICY "report_events_public_insert"
  ON public.padlock_report_events FOR INSERT
  WITH CHECK (true);

-- Apenas admin pode ler o histórico
CREATE POLICY "report_events_admin_read"
  ON public.padlock_report_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
