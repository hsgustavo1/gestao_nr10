-- ============ INCIDENTES E QUASE-ACIDENTES ELÉTRICOS ============
-- Registro de choques, arcos, princípios de incêndio e quase-acidentes,
-- com investigação e ações. Arquivos no bucket inspection-docs (pasta incidents/).

CREATE TABLE public.electrical_incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     timestamptz NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN (
                    'choque',
                    'arco_eletrico',
                    'principio_incendio',
                    'quase_acidente',
                    'outro'
                  )),
  setor           text,
  local           text,
  descricao       text NOT NULL,
  envolvidos      text,
  gravidade       text NOT NULL DEFAULT 'sem_lesao' CHECK (gravidade IN (
                    'sem_lesao',
                    'leve',
                    'moderada',
                    'grave',
                    'fatal'
                  )),
  causa_raiz      text,
  acoes_tomadas   text,
  status          text NOT NULL DEFAULT 'aberto' CHECK (status IN (
                    'aberto',
                    'em_investigacao',
                    'concluido'
                  )),
  file_path       text,
  created_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.electrical_incidents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_incidents_status ON public.electrical_incidents(status);
CREATE INDEX idx_incidents_occurred ON public.electrical_incidents(occurred_at);

CREATE TRIGGER incidents_touch
  BEFORE UPDATE ON public.electrical_incidents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "incidents_read_all"     ON public.electrical_incidents FOR SELECT USING (true);
CREATE POLICY "incidents_staff_insert" ON public.electrical_incidents FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "incidents_staff_update" ON public.electrical_incidents FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "incidents_admin_delete" ON public.electrical_incidents FOR DELETE USING (public.has_role(auth.uid(),'admin'));
