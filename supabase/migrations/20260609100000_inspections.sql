-- ============ MOTOR DE INSPEÇÕES (RTI, Termografia, SPDA, Cercon) ============
CREATE TABLE public.inspections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_type text NOT NULL CHECK (inspection_type IN ('rti','termografia','spda','cercon')),
  equipment       text NOT NULL,   -- equipamento, instalação ou local inspecionado
  sector          text,
  inspection_date date NOT NULL,
  validity_date   date,            -- validade do laudo / próxima inspeção
  result          text NOT NULL DEFAULT 'conforme'
                  CHECK (result IN ('conforme','conforme_com_ressalvas','nao_conforme')),
  report_path     text,            -- laudo PDF no bucket inspection-docs
  responsavel     text,
  art             text,
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_inspections_type ON public.inspections(inspection_type);
CREATE INDEX idx_inspections_validity ON public.inspections(validity_date);

-- Plano de ação para não-conformidades apontadas nos laudos
CREATE TABLE public.inspection_actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  description   text NOT NULL,
  responsible   text,
  due_date      date,
  status        text NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','em_andamento','concluida')),
  completed_at  date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inspection_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_inspection_actions_inspection ON public.inspection_actions(inspection_id);
CREATE INDEX idx_inspection_actions_status ON public.inspection_actions(status);

CREATE TRIGGER inspections_touch
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER inspection_actions_touch
  BEFORE UPDATE ON public.inspection_actions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: leitura geral, escrita staff, exclusão admin
CREATE POLICY "insp_read_all"     ON public.inspections FOR SELECT USING (true);
CREATE POLICY "insp_staff_insert" ON public.inspections FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "insp_staff_update" ON public.inspections FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "insp_admin_delete" ON public.inspections FOR DELETE USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "inspact_read_all"     ON public.inspection_actions FOR SELECT USING (true);
CREATE POLICY "inspact_staff_insert" ON public.inspection_actions FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "inspact_staff_update" ON public.inspection_actions FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "inspact_admin_delete" ON public.inspection_actions FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ============ BUCKET inspection-docs ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-docs', 'inspection-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "inspection_docs_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'inspection-docs');

CREATE POLICY "inspection_docs_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'inspection-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "inspection_docs_staff_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'inspection-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "inspection_docs_admin_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'inspection-docs' AND public.has_role(auth.uid(),'admin'));
