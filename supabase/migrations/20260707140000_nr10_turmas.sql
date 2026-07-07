-- ============ NR-10 TURMAS ============
-- Evento de treinamento de 1a classe: 1 turma agrupa N participacoes
-- (nr10_trainings). ART/instrutor/carga/conteudo passam a ter a turma como
-- fonte da verdade; as linhas filhas continuam espelhando por compatibilidade
-- com os caminhos de leitura existentes. Migracao ADITIVA (nenhuma coluna
-- removida) + backfill nao-destrutivo. RLS multi-tenant no padrao de
-- training_certificates/nr10-docs (can_access_org p/ SELECT; org_role_at_least
-- OR fn_org_is_manager p/ escrita). NAO usa is_staff()/has_role() legados.
CREATE TABLE public.nr10_turmas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id),
  training_type         text NOT NULL,   -- nr10_basico | nr10_areas_classificadas | sep
  category              text NOT NULL,   -- formacao | reciclagem
  data                  date,            -- data de realizacao/conclusao
  art                   text,            -- opcional (nem toda empresa usa ART)
  art_arquivo_url       text,
  instrutor             text,
  entidade              text,
  responsavel_tecnico   text,
  carga_horaria         integer,
  conteudo_programatico text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nr10_turmas ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_turmas_org ON public.nr10_turmas(org_id);
CREATE INDEX idx_turmas_match ON public.nr10_turmas(org_id, training_type, category, data);

CREATE POLICY "nr10_turmas_org_select" ON public.nr10_turmas FOR SELECT
  USING (public.can_access_org(auth.uid(), org_id));
CREATE POLICY "nr10_turmas_org_insert" ON public.nr10_turmas FOR INSERT
  WITH CHECK (public.org_role_at_least(auth.uid(), org_id, 'member')
             OR public.fn_org_is_manager(auth.uid(), org_id));
CREATE POLICY "nr10_turmas_org_update" ON public.nr10_turmas FOR UPDATE
  USING (public.org_role_at_least(auth.uid(), org_id, 'member')
         OR public.fn_org_is_manager(auth.uid(), org_id));
CREATE POLICY "nr10_turmas_org_delete" ON public.nr10_turmas FOR DELETE
  USING (public.org_role_at_least(auth.uid(), org_id, 'member')
         OR public.fn_org_is_manager(auth.uid(), org_id));

-- Vinculo participacao -> turma (nullable: legados nao agrupados ficam null).
ALTER TABLE public.nr10_trainings
  ADD COLUMN turma_id uuid REFERENCES public.nr10_turmas(id) ON DELETE SET NULL;
CREATE INDEX idx_nr10_trainings_turma ON public.nr10_trainings(turma_id);

-- Duas datas no certificado: data_realizacao (confrontada com a turma) e a ja
-- existente issue_date (emissao, informativa).
ALTER TABLE public.training_certificates
  ADD COLUMN data_realizacao date;

-- Backfill: agrupa linhas existentes por (org, tipo, categoria, data, art) e cria
-- uma turma por grupo, herdando os metadados de uma linha representativa.
WITH grupos AS (
  SELECT org_id, training_type, category, training_date AS data,
         art,
         (array_agg(art_arquivo_url) FILTER (WHERE art_arquivo_url IS NOT NULL))[1] AS art_arquivo_url,
         (array_agg(instrutor)       FILTER (WHERE instrutor IS NOT NULL))[1]       AS instrutor,
         (array_agg(entidade)        FILTER (WHERE entidade IS NOT NULL))[1]        AS entidade,
         (array_agg(responsavel_tecnico) FILTER (WHERE responsavel_tecnico IS NOT NULL))[1] AS responsavel_tecnico,
         (array_agg(carga_horaria)   FILTER (WHERE carga_horaria IS NOT NULL))[1]   AS carga_horaria,
         (array_agg(conteudo_programatico) FILTER (WHERE conteudo_programatico IS NOT NULL))[1] AS conteudo_programatico
  FROM public.nr10_trainings
  GROUP BY org_id, training_type, category, training_date, art
),
inseridas AS (
  INSERT INTO public.nr10_turmas
    (org_id, training_type, category, data, art, art_arquivo_url, instrutor,
     entidade, responsavel_tecnico, carga_horaria, conteudo_programatico)
  SELECT org_id, training_type, category, data, art, art_arquivo_url, instrutor,
         entidade, responsavel_tecnico, carga_horaria, conteudo_programatico
  FROM grupos
  RETURNING id, org_id, training_type, category, data, art
)
UPDATE public.nr10_trainings t
SET turma_id = i.id
FROM inseridas i
WHERE t.org_id = i.org_id
  AND t.training_type = i.training_type
  AND t.category = i.category
  AND t.training_date IS NOT DISTINCT FROM i.data
  AND t.art IS NOT DISTINCT FROM i.art;

-- Backfill data_realizacao dos certificados existentes a partir da issue_date
-- (melhor aproximacao ate reprocessar; issue_date era usada como data do treino).
UPDATE public.training_certificates
SET data_realizacao = issue_date
WHERE data_realizacao IS NULL;
