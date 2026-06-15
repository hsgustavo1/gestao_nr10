-- ============================================================================
-- Fase 1.6 — Cascata de org_id (filho herda do pai) + índices de org_id
-- ----------------------------------------------------------------------------
-- Idempotente, aditiva, não-destrutiva. Aplicar manualmente no SQL Editor.
--
-- Problema que resolve:
--   A migração da fundação tornou org_id NOT NULL e adicionou fn_default_org_id
--   (preenche org_id quando o usuário pertence a EXATAMENTE 1 org). Isso quebra
--   para usuários multi-org (ex.: consultor que gerencia vários clientes): o
--   trigger deixa org_id NULL e o INSERT viola NOT NULL.
--
-- Solução (base sólida p/ escalar):
--   Os filhos da árvore campo→RTI herdam org_id do PAI automaticamente, no banco.
--   Assim o cliente só precisa informar org_id nas RAÍZES (field_inspections,
--   rti_reports). Além de simplificar o cliente, isso cria um INVARIANTE de
--   segurança: um filho NUNCA pode ficar numa org diferente da do pai.
--
-- Ordem dos BEFORE INSERT triggers (alfabética por nome):
--   trg_default_org_*  (membership, single-org)  → roda 1º
--   trg_inherit_org_*  (herança do pai)           → roda depois
--   Se o default já preencheu (single-org), a herança vê org_id != NULL e não
--   mexe. Se o usuário é multi-org, o default deixa NULL e a herança preenche a
--   partir do pai. A RLS WITH CHECK roda DEPOIS dos BEFORE triggers, então valida
--   o org_id já preenchido.
-- ============================================================================

-- ---------- 1. Função genérica de herança de org_id ----------
-- TG_ARGV[0] = tabela do pai; TG_ARGV[1] = coluna FK em NEW que aponta o pai.
CREATE OR REPLACE FUNCTION public.fn_inherit_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _parent_table text := TG_ARGV[0];
  _fk_col       text := TG_ARGV[1];
  _fk_val       uuid;
  _org          uuid;
BEGIN
  IF NEW.org_id IS NULL THEN
    _fk_val := (to_jsonb(NEW) ->> _fk_col)::uuid;
    IF _fk_val IS NOT NULL THEN
      EXECUTE format('SELECT org_id FROM public.%I WHERE id = $1', _parent_table)
        INTO _org USING _fk_val;
      NEW.org_id := _org;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- 2. Anexa os triggers de herança (child → parent, fk) ----------
DO $$
DECLARE
  r record;
  -- child_table, parent_table, fk_column
  rels text[][] := ARRAY[
    ['field_nodes',        'field_inspections', 'inspection_id'],
    ['field_points',       'field_inspections', 'inspection_id'],
    ['field_findings',     'field_points',      'point_id'],
    ['field_photos',       'field_points',      'point_id'],
    ['rti_areas',          'rti_reports',       'report_id'],
    ['rti_ncs',            'rti_reports',       'report_id'],
    ['rti_nc_evidencias',  'rti_ncs',           'nc_id'],
    ['rti_nc_historico',   'rti_ncs',           'nc_id']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(rels, 1) LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=rels[i][1]
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
        'trg_inherit_org_'||rels[i][1], rels[i][1]);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW '
        'EXECUTE FUNCTION public.fn_inherit_org_id(%L, %L)',
        'trg_inherit_org_'||rels[i][1], rels[i][1], rels[i][2], rels[i][3]);
    END IF;
  END LOOP;
END $$;

-- ---------- 3. Índices de org_id (escopo por org em todas as queries/RLS) ----------
-- A fundação adicionou org_id mas não criou índice por tabela. Com filtros e RLS
-- por org_id, o índice evita seq scan conforme o volume cresce.
DO $$
DECLARE
  t text;
  org_tables text[] := ARRAY[
    'employees','nr10_trainings','work_authorizations','work_instructions','it_trainings',
    'training_certificates','epis','epi_tests','asos','electrical_incidents',
    'nr10_documents','nr10_document_versions','inspections','inspection_actions',
    'rti_reports','rti_areas','rti_ncs','rti_nc_evidencias','rti_nc_historico',
    'field_inspections','field_nodes','field_points','field_photos','field_findings',
    'padlocks','padlock_events','padlock_reports','padlock_report_events','padlock_violations',
    'compliance_snapshots','audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY org_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='org_id'
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(org_id)', 'idx_'||t||'_org', t);
    END IF;
  END LOOP;
END $$;
