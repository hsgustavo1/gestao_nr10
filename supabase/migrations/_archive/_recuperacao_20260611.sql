-- ============================================================================
-- SCRIPT DE RECUPERAÇÃO — aplica TUDO que falta no banco, na ordem certa.
-- Idempotente: pode ser executado mais de uma vez sem erro (IF NOT EXISTS /
-- DROP ... IF EXISTS em tudo). Cobre as migrations:
--   20260609000000_nr10_prontuario
--   20260609100000_inspections
--   20260609200000_epis
--   20260610000000/20260610100000_rti_custo (reforço, já idempotentes)
--   20260611000000_asos ... 20260611600000_audit_log
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1) PRONTUÁRIO DAS INSTALAÇÕES ELÉTRICAS (NR-10 10.2.3 / 10.2.4)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.nr10_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text NOT NULL CHECK (category IN (
                    'esquema_unifilar',
                    'procedimentos',
                    'inspecoes_spda_aterramento',
                    'especificacao_epi_epc',
                    'qualificacao_trabalhadores',
                    'testes_isolacao',
                    'certificacao_areas_classificadas',
                    'relatorio_inspecoes',
                    'outros'
                  )),
  title           text NOT NULL,
  description     text,
  document_date   date,
  validity_date   date,
  file_path       text,
  responsavel     text,
  art             text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nr10_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_nr10_documents_category ON public.nr10_documents(category);
CREATE INDEX IF NOT EXISTS idx_nr10_documents_validity ON public.nr10_documents(validity_date);

DROP TRIGGER IF EXISTS nr10_documents_touch ON public.nr10_documents;
CREATE TRIGGER nr10_documents_touch
  BEFORE UPDATE ON public.nr10_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "nr10doc_read_all"     ON public.nr10_documents;
DROP POLICY IF EXISTS "nr10doc_staff_insert" ON public.nr10_documents;
DROP POLICY IF EXISTS "nr10doc_staff_update" ON public.nr10_documents;
DROP POLICY IF EXISTS "nr10doc_admin_delete" ON public.nr10_documents;
CREATE POLICY "nr10doc_read_all"     ON public.nr10_documents FOR SELECT USING (true);
CREATE POLICY "nr10doc_staff_insert" ON public.nr10_documents FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "nr10doc_staff_update" ON public.nr10_documents FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "nr10doc_admin_delete" ON public.nr10_documents FOR DELETE USING (public.has_role(auth.uid(),'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('nr10-docs', 'nr10-docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "nr10_docs_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "nr10_docs_staff_insert"  ON storage.objects;
DROP POLICY IF EXISTS "nr10_docs_staff_update"  ON storage.objects;
DROP POLICY IF EXISTS "nr10_docs_admin_delete"  ON storage.objects;
CREATE POLICY "nr10_docs_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'nr10-docs');
CREATE POLICY "nr10_docs_staff_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'nr10-docs' AND public.is_staff(auth.uid()));
CREATE POLICY "nr10_docs_staff_update" ON storage.objects FOR UPDATE USING (bucket_id = 'nr10-docs' AND public.is_staff(auth.uid()));
CREATE POLICY "nr10_docs_admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'nr10-docs' AND public.has_role(auth.uid(),'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- 2) INSPEÇÕES (Termografia, SPDA, Cercon) + plano de ação simples
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inspections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_type text NOT NULL CHECK (inspection_type IN ('rti','termografia','spda','cercon')),
  equipment       text NOT NULL,
  sector          text,
  inspection_date date NOT NULL,
  validity_date   date,
  result          text NOT NULL DEFAULT 'conforme'
                  CHECK (result IN ('conforme','conforme_com_ressalvas','nao_conforme')),
  report_path     text,
  responsavel     text,
  art             text,
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_inspections_type ON public.inspections(inspection_type);
CREATE INDEX IF NOT EXISTS idx_inspections_validity ON public.inspections(validity_date);

CREATE TABLE IF NOT EXISTS public.inspection_actions (
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
CREATE INDEX IF NOT EXISTS idx_inspection_actions_inspection ON public.inspection_actions(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_actions_status ON public.inspection_actions(status);

DROP TRIGGER IF EXISTS inspections_touch ON public.inspections;
CREATE TRIGGER inspections_touch
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS inspection_actions_touch ON public.inspection_actions;
CREATE TRIGGER inspection_actions_touch
  BEFORE UPDATE ON public.inspection_actions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "insp_read_all"     ON public.inspections;
DROP POLICY IF EXISTS "insp_staff_insert" ON public.inspections;
DROP POLICY IF EXISTS "insp_staff_update" ON public.inspections;
DROP POLICY IF EXISTS "insp_admin_delete" ON public.inspections;
CREATE POLICY "insp_read_all"     ON public.inspections FOR SELECT USING (true);
CREATE POLICY "insp_staff_insert" ON public.inspections FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "insp_staff_update" ON public.inspections FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "insp_admin_delete" ON public.inspections FOR DELETE USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "inspact_read_all"     ON public.inspection_actions;
DROP POLICY IF EXISTS "inspact_staff_insert" ON public.inspection_actions;
DROP POLICY IF EXISTS "inspact_staff_update" ON public.inspection_actions;
DROP POLICY IF EXISTS "inspact_admin_delete" ON public.inspection_actions;
CREATE POLICY "inspact_read_all"     ON public.inspection_actions FOR SELECT USING (true);
CREATE POLICY "inspact_staff_insert" ON public.inspection_actions FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "inspact_staff_update" ON public.inspection_actions FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "inspact_admin_delete" ON public.inspection_actions FOR DELETE USING (public.has_role(auth.uid(),'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-docs', 'inspection-docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "inspection_docs_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "inspection_docs_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "inspection_docs_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "inspection_docs_admin_delete" ON storage.objects;
CREATE POLICY "inspection_docs_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'inspection-docs');
CREATE POLICY "inspection_docs_staff_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'inspection-docs' AND public.is_staff(auth.uid()));
CREATE POLICY "inspection_docs_staff_update" ON storage.objects FOR UPDATE USING (bucket_id = 'inspection-docs' AND public.is_staff(auth.uid()));
CREATE POLICY "inspection_docs_admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'inspection-docs' AND public.has_role(auth.uid(),'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- 3) EPIs / EPCs ESPECIAIS + ensaios dielétricos
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.epis (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epi_type             text NOT NULL CHECK (epi_type IN (
                         'luva_isolante',
                         'manga_isolante',
                         'detector_tensao',
                         'bastao_isolante',
                         'tapete_isolante',
                         'cobertura_isolante',
                         'outros'
                       )),
  description          text,
  epi_class            text,
  serial_number        text,
  ca                   text,
  employee_id          uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  sector               text,
  acquisition_date     date,
  test_interval_months integer NOT NULL DEFAULT 6,
  active               boolean NOT NULL DEFAULT true,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.epis ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_epis_type ON public.epis(epi_type);
CREATE INDEX IF NOT EXISTS idx_epis_employee ON public.epis(employee_id);

CREATE TABLE IF NOT EXISTS public.epi_tests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epi_id           uuid NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  test_date        date NOT NULL,
  result           text NOT NULL DEFAULT 'aprovado' CHECK (result IN ('aprovado','reprovado')),
  laboratory       text,
  certificate_path text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.epi_tests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_epi_tests_epi ON public.epi_tests(epi_id);
CREATE INDEX IF NOT EXISTS idx_epi_tests_date ON public.epi_tests(test_date);

DROP TRIGGER IF EXISTS epis_touch ON public.epis;
CREATE TRIGGER epis_touch
  BEFORE UPDATE ON public.epis
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "epis_read_all"     ON public.epis;
DROP POLICY IF EXISTS "epis_staff_insert" ON public.epis;
DROP POLICY IF EXISTS "epis_staff_update" ON public.epis;
DROP POLICY IF EXISTS "epis_admin_delete" ON public.epis;
CREATE POLICY "epis_read_all"     ON public.epis FOR SELECT USING (true);
CREATE POLICY "epis_staff_insert" ON public.epis FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "epis_staff_update" ON public.epis FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "epis_admin_delete" ON public.epis FOR DELETE USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "epitests_read_all"     ON public.epi_tests;
DROP POLICY IF EXISTS "epitests_staff_insert" ON public.epi_tests;
DROP POLICY IF EXISTS "epitests_staff_update" ON public.epi_tests;
DROP POLICY IF EXISTS "epitests_admin_delete" ON public.epi_tests;
CREATE POLICY "epitests_read_all"     ON public.epi_tests FOR SELECT USING (true);
CREATE POLICY "epitests_staff_insert" ON public.epi_tests FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "epitests_staff_update" ON public.epi_tests FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "epitests_admin_delete" ON public.epi_tests FOR DELETE USING (public.has_role(auth.uid(),'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('epi-docs', 'epi-docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "epi_docs_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "epi_docs_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "epi_docs_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "epi_docs_admin_delete" ON storage.objects;
CREATE POLICY "epi_docs_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'epi-docs');
CREATE POLICY "epi_docs_staff_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'epi-docs' AND public.is_staff(auth.uid()));
CREATE POLICY "epi_docs_staff_update" ON storage.objects FOR UPDATE USING (bucket_id = 'epi-docs' AND public.is_staff(auth.uid()));
CREATE POLICY "epi_docs_admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'epi-docs' AND public.has_role(auth.uid(),'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- 4) RTI — custo nullable (reforço; sem efeito se já aplicado)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.rti_ncs ALTER COLUMN custo_planejado DROP DEFAULT;
ALTER TABLE public.rti_ncs ALTER COLUMN custo_planejado DROP NOT NULL;
ALTER TABLE public.rti_ncs ALTER COLUMN custo_realizado DROP DEFAULT;
ALTER TABLE public.rti_ncs ALTER COLUMN custo_realizado DROP NOT NULL;
UPDATE public.rti_ncs SET custo_planejado = NULL WHERE custo_planejado = 0;
UPDATE public.rti_ncs SET custo_realizado = NULL WHERE custo_realizado = 0;

-- ════════════════════════════════════════════════════════════════════════════
-- 5) ASO — ATESTADO DE SAÚDE OCUPACIONAL (NR-10 10.8.7)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.asos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exam_date         date NOT NULL,
  validity_date     date NOT NULL,
  tipo              text NOT NULL DEFAULT 'periodico' CHECK (tipo IN (
                      'admissional',
                      'periodico',
                      'retorno_trabalho',
                      'mudanca_funcao',
                      'demissional'
                    )),
  resultado         text NOT NULL DEFAULT 'apto' CHECK (resultado IN (
                      'apto',
                      'apto_com_restricoes',
                      'inapto'
                    )),
  apto_eletricidade boolean NOT NULL DEFAULT true,
  restricoes        text,
  medico            text,
  file_path         text,
  notes             text,
  created_by_name   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_asos_employee ON public.asos(employee_id);
CREATE INDEX IF NOT EXISTS idx_asos_validity ON public.asos(validity_date);

DROP TRIGGER IF EXISTS asos_touch ON public.asos;
CREATE TRIGGER asos_touch
  BEFORE UPDATE ON public.asos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "asos_read_all"     ON public.asos;
DROP POLICY IF EXISTS "asos_staff_insert" ON public.asos;
DROP POLICY IF EXISTS "asos_staff_update" ON public.asos;
DROP POLICY IF EXISTS "asos_admin_delete" ON public.asos;
CREATE POLICY "asos_read_all"     ON public.asos FOR SELECT USING (true);
CREATE POLICY "asos_staff_insert" ON public.asos FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "asos_staff_update" ON public.asos FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "asos_admin_delete" ON public.asos FOR DELETE USING (public.has_role(auth.uid(),'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('aso-docs', 'aso-docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "aso_docs_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "aso_docs_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "aso_docs_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "aso_docs_admin_delete" ON storage.objects;
CREATE POLICY "aso_docs_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'aso-docs');
CREATE POLICY "aso_docs_staff_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'aso-docs' AND public.is_staff(auth.uid()));
CREATE POLICY "aso_docs_staff_update" ON storage.objects FOR UPDATE USING (bucket_id = 'aso-docs' AND public.is_staff(auth.uid()));
CREATE POLICY "aso_docs_admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'aso-docs' AND public.has_role(auth.uid(),'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- 6) CAMPOS COMPLETOS DE CAPACITAÇÃO (fiscalização)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS carga_horaria integer;
ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS entidade text;
ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS instrutor text;
ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS conteudo_programatico text;

-- ════════════════════════════════════════════════════════════════════════════
-- 7) GATILHOS DE RECICLAGEM EXTRAORDINÁRIA (NR-10 10.8.8.x)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS afastado_desde date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS retorno_em date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS reciclagem_requerida boolean NOT NULL DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS reciclagem_motivo text;

-- ════════════════════════════════════════════════════════════════════════════
-- 8) VERSIONAMENTO DE DOCUMENTOS DO PRONTUÁRIO
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.nr10_document_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES public.nr10_documents(id) ON DELETE CASCADE,
  file_path        text NOT NULL,
  file_name        text,
  document_date    date,
  validity_date    date,
  replaced_by_name text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nr10_document_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_nr10_doc_versions_document ON public.nr10_document_versions(document_id);

DROP POLICY IF EXISTS "nr10docver_read_all"     ON public.nr10_document_versions;
DROP POLICY IF EXISTS "nr10docver_staff_insert" ON public.nr10_document_versions;
DROP POLICY IF EXISTS "nr10docver_admin_delete" ON public.nr10_document_versions;
CREATE POLICY "nr10docver_read_all"     ON public.nr10_document_versions FOR SELECT USING (true);
CREATE POLICY "nr10docver_staff_insert" ON public.nr10_document_versions FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "nr10docver_admin_delete" ON public.nr10_document_versions FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- 9) INCIDENTES E QUASE-ACIDENTES ELÉTRICOS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.electrical_incidents (
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
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.electrical_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_occurred ON public.electrical_incidents(occurred_at);

DROP TRIGGER IF EXISTS incidents_touch ON public.electrical_incidents;
CREATE TRIGGER incidents_touch
  BEFORE UPDATE ON public.electrical_incidents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "incidents_read_all"     ON public.electrical_incidents;
DROP POLICY IF EXISTS "incidents_staff_insert" ON public.electrical_incidents;
DROP POLICY IF EXISTS "incidents_staff_update" ON public.electrical_incidents;
DROP POLICY IF EXISTS "incidents_admin_delete" ON public.electrical_incidents;
CREATE POLICY "incidents_read_all"     ON public.electrical_incidents FOR SELECT USING (true);
CREATE POLICY "incidents_staff_insert" ON public.electrical_incidents FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "incidents_staff_update" ON public.electrical_incidents FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "incidents_admin_delete" ON public.electrical_incidents FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- 10) SNAPSHOTS DE CONFORMIDADE (tendência histórica)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.compliance_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL UNIQUE,
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compliance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshots_read_all"     ON public.compliance_snapshots;
DROP POLICY IF EXISTS "snapshots_staff_insert" ON public.compliance_snapshots;
DROP POLICY IF EXISTS "snapshots_staff_update" ON public.compliance_snapshots;
DROP POLICY IF EXISTS "snapshots_admin_delete" ON public.compliance_snapshots;
CREATE POLICY "snapshots_read_all"     ON public.compliance_snapshots FOR SELECT USING (true);
CREATE POLICY "snapshots_staff_insert" ON public.compliance_snapshots FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "snapshots_staff_update" ON public.compliance_snapshots FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "snapshots_admin_delete" ON public.compliance_snapshots FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- 11) AUDITORIA CENTRALIZADA (trilha imutável via trigger)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id  text NOT NULL,
  action     text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  actor_id   uuid,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at);

DROP POLICY IF EXISTS "audit_read_authenticated" ON public.audit_log;
CREATE POLICY "audit_read_authenticated" ON public.audit_log
  FOR SELECT TO authenticated USING (true);
-- Sem políticas de INSERT/UPDATE/DELETE: escrita só via trigger

CREATE OR REPLACE FUNCTION public.fn_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, actor_id, new_data)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, actor_id, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_log (table_name, record_id, action, actor_id, old_data)
    VALUES (TG_TABLE_NAME, OLD.id::text, TG_OP, auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS audit_employees           ON public.employees;
DROP TRIGGER IF EXISTS audit_nr10_trainings      ON public.nr10_trainings;
DROP TRIGGER IF EXISTS audit_work_authorizations ON public.work_authorizations;
DROP TRIGGER IF EXISTS audit_it_trainings        ON public.it_trainings;
DROP TRIGGER IF EXISTS audit_nr10_documents      ON public.nr10_documents;
DROP TRIGGER IF EXISTS audit_epis                ON public.epis;
DROP TRIGGER IF EXISTS audit_epi_tests           ON public.epi_tests;
DROP TRIGGER IF EXISTS audit_asos                ON public.asos;
DROP TRIGGER IF EXISTS audit_incidents           ON public.electrical_incidents;
CREATE TRIGGER audit_employees           AFTER INSERT OR UPDATE OR DELETE ON public.employees            FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_nr10_trainings      AFTER INSERT OR UPDATE OR DELETE ON public.nr10_trainings       FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_work_authorizations AFTER INSERT OR UPDATE OR DELETE ON public.work_authorizations  FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_it_trainings        AFTER INSERT OR UPDATE OR DELETE ON public.it_trainings         FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_nr10_documents      AFTER INSERT OR UPDATE OR DELETE ON public.nr10_documents       FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_epis                AFTER INSERT OR UPDATE OR DELETE ON public.epis                 FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_epi_tests           AFTER INSERT OR UPDATE OR DELETE ON public.epi_tests            FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_asos                AFTER INSERT OR UPDATE OR DELETE ON public.asos                 FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_incidents           AFTER INSERT OR UPDATE OR DELETE ON public.electrical_incidents FOR EACH ROW EXECUTE FUNCTION public.fn_audit();

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL — deve listar todas estas tabelas
-- ════════════════════════════════════════════════════════════════════════════
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'nr10_documents','inspections','inspection_actions','epis','epi_tests',
    'asos','nr10_document_versions','electrical_incidents',
    'compliance_snapshots','audit_log'
  )
ORDER BY table_name;
