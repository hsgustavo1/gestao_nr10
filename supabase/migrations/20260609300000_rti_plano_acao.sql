-- ============ RTI — RELATÓRIO TÉCNICO DAS INSPEÇÕES (PLANO DE AÇÃO NR-10) ============
-- Gestão completa do plano de ação das não conformidades apontadas no RTI:
-- relatórios (ciclos de auditoria), áreas auditadas, NCs, evidências e histórico.

-- Relatórios de inspeção (um por ciclo de auditoria)
CREATE TABLE public.rti_reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo                text NOT NULL,
  empresa_auditora      text,
  responsavel_auditoria text,
  responsavel_plano     text,
  periodo_inicio        date,
  periodo_fim           date,
  report_path           text,            -- PDF do relatório no bucket rti-evidencias
  notes                 text,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rti_reports ENABLE ROW LEVEL SECURITY;

-- Áreas/setores auditados (ex.: "Geral Fábrica", "Subestação", "Caldeira"...)
CREATE TABLE public.rti_areas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  uuid NOT NULL REFERENCES public.rti_reports(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  ordem      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, nome)
);
ALTER TABLE public.rti_areas ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rti_areas_report ON public.rti_areas(report_id);

-- Não conformidades do plano de ação
CREATE TABLE public.rti_ncs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid NOT NULL REFERENCES public.rti_reports(id) ON DELETE CASCADE,
  area_id         uuid NOT NULL REFERENCES public.rti_areas(id) ON DELETE CASCADE,
  numero          integer NOT NULL,                 -- número global da NC no relatório
  descricao       text NOT NULL,                    -- a não conformidade constatada
  recomendacao    text,                             -- recomendação do auditor
  prioridade      smallint NOT NULL DEFAULT 3 CHECK (prioridade BETWEEN 1 AND 4),  -- P4 = mais grave
  responsavel     text,
  status          text NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_andamento','concluida')),
  progresso       smallint NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  prazo           date,
  tipo_execucao   text NOT NULL DEFAULT 'os'
                  CHECK (tipo_execucao IN ('os','investimento')),  -- OS = manutenção; investimento = CAPEX
  os_numero       text,                             -- nº da Ordem de Serviço, quando houver
  custo_planejado numeric(14,2) NOT NULL DEFAULT 0,
  custo_realizado numeric(14,2) NOT NULL DEFAULT 0,
  situacao_atual  text,                             -- observações sobre o andamento
  concluida_em    date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, numero)
);
ALTER TABLE public.rti_ncs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rti_ncs_report ON public.rti_ncs(report_id);
CREATE INDEX idx_rti_ncs_area ON public.rti_ncs(area_id);
CREATE INDEX idx_rti_ncs_status ON public.rti_ncs(status);
CREATE INDEX idx_rti_ncs_prazo ON public.rti_ncs(prazo);

-- Evidências (fotos/PDFs): constatação da NC e comprovação da correção
CREATE TABLE public.rti_nc_evidencias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id           uuid NOT NULL REFERENCES public.rti_ncs(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('constatacao','correcao')),
  file_path       text NOT NULL,                    -- caminho no bucket rti-evidencias
  file_name       text NOT NULL,
  mime_type       text,
  descricao       text,
  created_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rti_nc_evidencias ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rti_nc_evidencias_nc ON public.rti_nc_evidencias(nc_id);

-- Histórico/timeline da NC (comentários e alterações registradas pelo app)
CREATE TABLE public.rti_nc_historico (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id      uuid NOT NULL REFERENCES public.rti_ncs(id) ON DELETE CASCADE,
  tipo       text NOT NULL DEFAULT 'comentario' CHECK (tipo IN ('comentario','alteracao')),
  texto      text NOT NULL,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rti_nc_historico ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rti_nc_historico_nc ON public.rti_nc_historico(nc_id);

CREATE TRIGGER rti_reports_touch
  BEFORE UPDATE ON public.rti_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER rti_ncs_touch
  BEFORE UPDATE ON public.rti_ncs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: leitura geral, escrita staff, exclusão admin (evidências: staff pode excluir)
CREATE POLICY "rti_reports_read_all"     ON public.rti_reports FOR SELECT USING (true);
CREATE POLICY "rti_reports_staff_insert" ON public.rti_reports FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "rti_reports_staff_update" ON public.rti_reports FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "rti_reports_admin_delete" ON public.rti_reports FOR DELETE USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "rti_areas_read_all"     ON public.rti_areas FOR SELECT USING (true);
CREATE POLICY "rti_areas_staff_insert" ON public.rti_areas FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "rti_areas_staff_update" ON public.rti_areas FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "rti_areas_admin_delete" ON public.rti_areas FOR DELETE USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "rti_ncs_read_all"     ON public.rti_ncs FOR SELECT USING (true);
CREATE POLICY "rti_ncs_staff_insert" ON public.rti_ncs FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "rti_ncs_staff_update" ON public.rti_ncs FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "rti_ncs_admin_delete" ON public.rti_ncs FOR DELETE USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "rti_evid_read_all"     ON public.rti_nc_evidencias FOR SELECT USING (true);
CREATE POLICY "rti_evid_staff_insert" ON public.rti_nc_evidencias FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "rti_evid_staff_update" ON public.rti_nc_evidencias FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "rti_evid_staff_delete" ON public.rti_nc_evidencias FOR DELETE USING (public.is_staff(auth.uid()));

CREATE POLICY "rti_hist_read_all"     ON public.rti_nc_historico FOR SELECT USING (true);
CREATE POLICY "rti_hist_staff_insert" ON public.rti_nc_historico FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "rti_hist_admin_delete" ON public.rti_nc_historico FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ============ BUCKET rti-evidencias ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('rti-evidencias', 'rti-evidencias', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "rti_evidencias_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'rti-evidencias');

CREATE POLICY "rti_evidencias_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rti-evidencias' AND public.is_staff(auth.uid()));

CREATE POLICY "rti_evidencias_staff_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'rti-evidencias' AND public.is_staff(auth.uid()));

CREATE POLICY "rti_evidencias_staff_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'rti-evidencias' AND public.is_staff(auth.uid()));
