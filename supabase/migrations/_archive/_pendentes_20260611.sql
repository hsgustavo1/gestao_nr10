-- ============ 20260611000000_asos.sql ============

-- ============ ASO â€” ATESTADO DE SAÃšDE OCUPACIONAL (NR-10 10.8.7) ============
-- Trabalhadores autorizados devem ter aptidÃ£o atestada em exame mÃ©dico (PCMSO).
-- O ASO alimenta o motor de aptidÃ£o: sem ASO vÃ¡lido, o colaborador nÃ£o pode
-- ser considerado apto para trabalho em eletricidade.

CREATE TABLE public.asos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exam_date         date NOT NULL,
  validity_date     date NOT NULL,             -- vencimento do ASO
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
  apto_eletricidade boolean NOT NULL DEFAULT true,  -- aptidÃ£o especÃ­fica p/ trabalho em eletricidade
  restricoes        text,
  medico            text,                       -- mÃ©dico examinador / CRM
  file_path         text,                       -- arquivo do ASO no bucket aso-docs
  notes             text,
  created_by_name   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_asos_employee ON public.asos(employee_id);
CREATE INDEX idx_asos_validity ON public.asos(validity_date);

CREATE TRIGGER asos_touch
  BEFORE UPDATE ON public.asos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: leitura geral, escrita staff, exclusÃ£o admin
CREATE POLICY "asos_read_all"     ON public.asos FOR SELECT USING (true);
CREATE POLICY "asos_staff_insert" ON public.asos FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "asos_staff_update" ON public.asos FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "asos_admin_delete" ON public.asos FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ============ BUCKET aso-docs ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('aso-docs', 'aso-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "aso_docs_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'aso-docs');

CREATE POLICY "aso_docs_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'aso-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "aso_docs_staff_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'aso-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "aso_docs_admin_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'aso-docs' AND public.has_role(auth.uid(),'admin'));

-- ============ 20260611100000_capacitacao_campos.sql ============

-- ============ CAMPOS COMPLETOS DE CAPACITAÃ‡ÃƒO (fiscalizaÃ§Ã£o) ============
-- O auditor fiscal pede: carga horÃ¡ria (40h bÃ¡sico, +40h SEP), conteÃºdo
-- programÃ¡tico, entidade/instrutor. Sem isso o registro Ã© incompleto.

ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS carga_horaria integer;
ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS entidade text;
ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS instrutor text;
ALTER TABLE public.nr10_trainings ADD COLUMN IF NOT EXISTS conteudo_programatico text;

-- ============ 20260611200000_reciclagem_gatilhos.sql ============

-- ============ GATILHOS DE RECICLAGEM EXTRAORDINÃRIA (NR-10 10.8.8.x) ============
-- Reciclagem tambÃ©m Ã© exigida em: retorno de afastamento > 3 meses e
-- mudanÃ§a de funÃ§Ã£o. A flag Ã© setada pela aplicaÃ§Ã£o ao detectar o gatilho
-- e limpa quando uma nova reciclagem Ã© registrada.

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS afastado_desde date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS retorno_em date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS reciclagem_requerida boolean NOT NULL DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS reciclagem_motivo text;

-- ============ 20260611300000_prontuario_versoes.sql ============

-- ============ VERSIONAMENTO DE DOCUMENTOS DO PRONTUÃRIO ============
-- O esquema unifilar e demais documentos do PIE exigem estar "atualizados".
-- Ao substituir o arquivo de um documento, a versÃ£o anterior Ã© arquivada
-- aqui (o arquivo antigo permanece no bucket nr10-docs).

CREATE TABLE public.nr10_document_versions (
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
CREATE INDEX idx_nr10_doc_versions_document ON public.nr10_document_versions(document_id);

CREATE POLICY "nr10docver_read_all"     ON public.nr10_document_versions FOR SELECT USING (true);
CREATE POLICY "nr10docver_staff_insert" ON public.nr10_document_versions FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "nr10docver_admin_delete" ON public.nr10_document_versions FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ============ 20260611400000_incidentes.sql ============

-- ============ INCIDENTES E QUASE-ACIDENTES ELÃ‰TRICOS ============
-- Registro de choques, arcos, princÃ­pios de incÃªndio e quase-acidentes,
-- com investigaÃ§Ã£o e aÃ§Ãµes. Arquivos no bucket inspection-docs (pasta incidents/).

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

-- ============ 20260611500000_compliance_snapshots.sql ============

-- ============ SNAPSHOTS DE CONFORMIDADE (tendÃªncia histÃ³rica) ============
-- Um snapshot por mÃªs (snapshot_date = dia 1Âº do mÃªs), com os percentuais
-- das dimensÃµes do relatÃ³rio de conformidade em jsonb. Gerado pela aplicaÃ§Ã£o
-- quando um usuÃ¡rio staff abre o relatÃ³rio e o mÃªs corrente ainda nÃ£o tem snapshot.

CREATE TABLE public.compliance_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL UNIQUE,
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compliance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots_read_all"     ON public.compliance_snapshots FOR SELECT USING (true);
CREATE POLICY "snapshots_staff_insert" ON public.compliance_snapshots FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "snapshots_staff_update" ON public.compliance_snapshots FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "snapshots_admin_delete" ON public.compliance_snapshots FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ============ 20260611600000_audit_log.sql ============

-- ============ AUDITORIA CENTRALIZADA ============
-- Trilha imutÃ¡vel de quem alterou o quÃª nas tabelas de conformidade.
-- Preenchida exclusivamente por triggers de banco (SECURITY DEFINER) â€”
-- a API nÃ£o tem polÃ­tica de INSERT/UPDATE/DELETE.

CREATE TABLE public.audit_log (
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
CREATE INDEX idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at);

-- Leitura apenas para autenticados (a trilha contÃ©m dados pessoais)
CREATE POLICY "audit_read_authenticated" ON public.audit_log
  FOR SELECT TO authenticated USING (true);
-- Sem polÃ­ticas de INSERT/UPDATE/DELETE: escrita sÃ³ via trigger

-- FunÃ§Ã£o genÃ©rica de auditoria
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

-- Triggers nas tabelas de conformidade
CREATE TRIGGER audit_employees           AFTER INSERT OR UPDATE OR DELETE ON public.employees            FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_nr10_trainings      AFTER INSERT OR UPDATE OR DELETE ON public.nr10_trainings       FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_work_authorizations AFTER INSERT OR UPDATE OR DELETE ON public.work_authorizations  FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_it_trainings        AFTER INSERT OR UPDATE OR DELETE ON public.it_trainings         FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_nr10_documents      AFTER INSERT OR UPDATE OR DELETE ON public.nr10_documents       FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_epis                AFTER INSERT OR UPDATE OR DELETE ON public.epis                 FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_epi_tests           AFTER INSERT OR UPDATE OR DELETE ON public.epi_tests            FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_asos                AFTER INSERT OR UPDATE OR DELETE ON public.asos                 FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
CREATE TRIGGER audit_incidents           AFTER INSERT OR UPDATE OR DELETE ON public.electrical_incidents FOR EACH ROW EXECUTE FUNCTION public.fn_audit();


