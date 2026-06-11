-- ============================================================================
-- COLETA EM CAMPO (RTI) v2 — árvore hierárquica + fluxo foto-primeiro
--
-- Reestrutura o módulo de campo: a coleta passa a ser organizada numa árvore
-- Setor → Ativo → Componente (field_nodes). O inspetor "estaciona" num nível e
-- cria pontos de coleta sucessivos ali. Cada ponto = fotos + 1..N modos de
-- falha (achados). Foto agora ancora no PONTO (antes ancorava no achado).
--
-- A base rti_modos_falha é PRESERVADA. As 4 tabelas field_* são recriadas
-- (havia apenas 1 inspeção de teste). Idempotente.
-- ============================================================================

-- Dropa em ordem de dependência (cascade limpa pontos/achados/fotos)
DROP TABLE IF EXISTS public.field_photos    CASCADE;
DROP TABLE IF EXISTS public.field_findings  CASCADE;
DROP TABLE IF EXISTS public.field_points     CASCADE;
DROP TABLE IF EXISTS public.field_nodes      CASCADE;
-- field_inspections é mantida na forma; recriada abaixo só se não existir
CREATE TABLE IF NOT EXISTS public.field_inspections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  cliente         text,
  local           text,
  engenheiro      text,
  data_inspecao   date NOT NULL DEFAULT CURRENT_DATE,
  status          text NOT NULL DEFAULT 'em_andamento'
                  CHECK (status IN ('em_andamento','finalizada','importada')),
  report_id       uuid REFERENCES public.rti_reports(id) ON DELETE SET NULL,
  notes           text,
  created_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.field_inspections ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_field_inspections_status ON public.field_inspections(status);
-- Limpa inspeções de teste do modelo antigo (estrutura incompatível)
DELETE FROM public.field_inspections WHERE status <> 'importada';

-- ════════════════════════════════════════════════════════════════════════════
-- ÁRVORE: Setor → Ativo → Componente
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.field_nodes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.field_inspections(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES public.field_nodes(id) ON DELETE CASCADE,  -- NULL = setor (raiz)
  nivel         text NOT NULL CHECK (nivel IN ('setor','ativo','componente')),
  nome          text NOT NULL,
  ordem         integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.field_nodes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_field_nodes_inspection ON public.field_nodes(inspection_id);
CREATE INDEX idx_field_nodes_parent ON public.field_nodes(parent_id);

-- ════════════════════════════════════════════════════════════════════════════
-- PONTOS DE COLETA (ancorados num nó da árvore)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.field_points (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.field_inspections(id) ON DELETE CASCADE,
  node_id       uuid NOT NULL REFERENCES public.field_nodes(id) ON DELETE CASCADE,
  titulo        text,
  observacoes   text,
  ordem         integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.field_points ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_field_points_inspection ON public.field_points(inspection_id);
CREATE INDEX idx_field_points_node ON public.field_points(node_id);

-- ════════════════════════════════════════════════════════════════════════════
-- FOTOS (ancoradas no ponto — 1..N por ponto)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.field_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id   uuid NOT NULL REFERENCES public.field_points(id) ON DELETE CASCADE,
  file_path  text NOT NULL,                 -- bucket rti-evidencias, prefixo campo/
  file_name  text NOT NULL,
  legenda    text,
  ordem      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.field_photos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_field_photos_point ON public.field_photos(point_id);

-- ════════════════════════════════════════════════════════════════════════════
-- ACHADOS / MODOS DE FALHA DO PONTO (1..N por ponto)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.field_findings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id      uuid NOT NULL REFERENCES public.field_points(id) ON DELETE CASCADE,
  modo_falha_id uuid REFERENCES public.rti_modos_falha(id) ON DELETE SET NULL,  -- NULL = manual
  descricao     text NOT NULL,
  recomendacao  text,
  prioridade    smallint NOT NULL DEFAULT 3 CHECK (prioridade BETWEEN 1 AND 4),
  tipo_execucao text NOT NULL DEFAULT 'os' CHECK (tipo_execucao IN ('os','investimento')),
  observacao    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.field_findings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_field_findings_point ON public.field_findings(point_id);

-- ════════════════════════════════════════════════════════════════════════════
-- TRIGGERS de updated_at
-- ════════════════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS field_inspections_touch ON public.field_inspections;
CREATE TRIGGER field_inspections_touch BEFORE UPDATE ON public.field_inspections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER field_nodes_touch    BEFORE UPDATE ON public.field_nodes    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER field_points_touch   BEFORE UPDATE ON public.field_points   FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER field_findings_touch BEFORE UPDATE ON public.field_findings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS: leitura geral, escrita/exclusão staff (material de trabalho do consultor)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['field_inspections','field_nodes','field_points','field_findings','field_photos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_read_all" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_staff_insert" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_staff_update" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_staff_delete" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_read_all"     ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_insert" ON public.%I FOR INSERT WITH CHECK (public.is_staff(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_update" ON public.%I FOR UPDATE USING (public.is_staff(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_delete" ON public.%I FOR DELETE USING (public.is_staff(auth.uid()))', t, t);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- AUDITORIA (se a função existir)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_audit') THEN
    DROP TRIGGER IF EXISTS audit_field_inspections ON public.field_inspections;
    CREATE TRIGGER audit_field_inspections AFTER INSERT OR UPDATE OR DELETE ON public.field_inspections FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
  END IF;
END $$;
