-- ============ AUDITORIA CENTRALIZADA ============
-- Trilha imutável de quem alterou o quê nas tabelas de conformidade.
-- Preenchida exclusivamente por triggers de banco (SECURITY DEFINER) —
-- a API não tem política de INSERT/UPDATE/DELETE.

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

-- Leitura apenas para autenticados (a trilha contém dados pessoais)
CREATE POLICY "audit_read_authenticated" ON public.audit_log
  FOR SELECT TO authenticated USING (true);
-- Sem políticas de INSERT/UPDATE/DELETE: escrita só via trigger

-- Função genérica de auditoria
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
