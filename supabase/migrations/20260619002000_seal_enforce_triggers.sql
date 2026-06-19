-- ============================================================================
-- Selo de Entrega — enforcement (UPDATE/DELETE) + provença no INSERT.
-- ----------------------------------------------------------------------------
-- Aplicado via Supabase MCP em 2026-06-19. Idempotente.
--
-- Enforcement em dois níveis (este trigger + gate na UI). O trigger é a fonte
-- com dentes: quando a linha está entregue e o ator não bypassa, bloqueia as
-- colunas congeladas (seal_policy) e o DELETE.
--
-- Nota: a auditoria de mutação pós-entrega fica a cargo do log do app
-- (logBulkHistorico) — o trigger de auditoria foi descartado para não duplicar
-- entradas no histórico da NC (decisão de 2026-06-19).
-- ============================================================================

-- ---------- 1. Enforcement de colunas congeladas e DELETE ----------
CREATE OR REPLACE FUNCTION public.fn_enforce_seal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pol         public.seal_policy%ROWTYPE;
  _row_org     uuid;
  _entregue_por uuid;
  _entregue_em timestamptz;
  _col         text;
  _old_j       jsonb;
  _new_j       jsonb;
  _filter_ok   boolean;
BEGIN
  SELECT * INTO _pol FROM public.seal_policy WHERE table_name = TG_TABLE_NAME;
  IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;

  _old_j := to_jsonb(OLD);
  _entregue_em := (_old_j ->> 'entregue_em')::timestamptz;
  IF _entregue_em IS NULL THEN
    RETURN COALESCE(NEW, OLD);  -- não selada: nada a barrar
  END IF;

  _row_org      := (_old_j ->> 'org_id')::uuid;
  _entregue_por := (_old_j ->> 'entregue_por_org')::uuid;

  -- Ator que bypassa o selo passa direto.
  IF public.fn_can_bypass_seal(auth.uid(), _row_org, _entregue_por) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- row_filter: só protege linhas que casam (avalia lendo a linha OLD pela id).
  IF _pol.row_filter IS NOT NULL THEN
    EXECUTE format('SELECT (%s) FROM public.%I WHERE id = $1', _pol.row_filter, TG_TABLE_NAME)
      INTO _filter_ok USING (_old_j ->> 'id')::uuid;
    IF _filter_ok IS NOT TRUE THEN RETURN COALESCE(NEW, OLD); END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF _pol.allow_delete THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Registro entregue não pode ser excluído (%).', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  -- UPDATE: rejeita se alguma coluna congelada mudou.
  _new_j := to_jsonb(NEW);
  IF _pol.frozen_columns = ARRAY['*'] THEN
    IF _old_j IS DISTINCT FROM _new_j THEN
      RAISE EXCEPTION 'Registro entregue é somente leitura (%).', TG_TABLE_NAME
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  FOREACH _col IN ARRAY _pol.frozen_columns LOOP
    IF (_old_j ->> _col) IS DISTINCT FROM (_new_j ->> _col) THEN
      RAISE EXCEPTION 'Campo "%" pertence ao registro entregue e não pode ser alterado.', _col
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ---------- 2. Provença no INSERT (filho de relatório já entregue) ----------
-- Se o pai está entregue, um filho novo nasce selado se quem insere bypassa
-- (consultor/dono/owner); se é o admin-padrão do cliente, nasce livre.
CREATE OR REPLACE FUNCTION public.fn_seal_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _parent_table text := TG_ARGV[0];
  _fk_col       text := TG_ARGV[1];
  _fk_val       uuid;
  _p_entregue   timestamptz;
  _p_por_org    uuid;
BEGIN
  IF NEW.entregue_em IS NOT NULL THEN RETURN NEW; END IF;  -- já definido (cascata)
  _fk_val := (to_jsonb(NEW) ->> _fk_col)::uuid;
  IF _fk_val IS NULL THEN RETURN NEW; END IF;

  EXECUTE format('SELECT entregue_em, entregue_por_org FROM public.%I WHERE id = $1', _parent_table)
    INTO _p_entregue, _p_por_org USING _fk_val;

  IF _p_entregue IS NOT NULL
     AND public.fn_can_bypass_seal(auth.uid(), NEW.org_id, _p_por_org) THEN
    NEW.entregue_em := now();
    NEW.entregue_por_org := _p_por_org;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- 3. Anexa triggers ----------
DO $$
DECLARE
  -- child_table, parent_table, fk_column
  rels text[][] := ARRAY[
    ['rti_areas',         'rti_reports', 'report_id'],
    ['rti_ncs',           'rti_reports', 'report_id'],
    ['rti_nc_evidencias', 'rti_ncs',     'nc_id']
  ];
  i int;
  enforce_tables text[] := ARRAY['rti_ncs','rti_nc_evidencias','rti_areas'];
  t text;
BEGIN
  -- enforcement (UPDATE/DELETE)
  FOREACH t IN ARRAY enforce_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_seal ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_seal BEFORE UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_seal()', t);
  END LOOP;

  -- provença no INSERT (roda após trg_inherit_org_* pela ordem alfabética)
  FOR i IN 1 .. array_length(rels,1) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_seal_on_insert ON public.%I', rels[i][1]);
    EXECUTE format(
      'CREATE TRIGGER trg_seal_on_insert BEFORE INSERT ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.fn_seal_on_insert(%L, %L)',
      rels[i][1], rels[i][2], rels[i][3]);
  END LOOP;
END $$;
