-- ============ SNAPSHOTS DE CONFORMIDADE (tendência histórica) ============
-- Um snapshot por mês (snapshot_date = dia 1º do mês), com os percentuais
-- das dimensões do relatório de conformidade em jsonb. Gerado pela aplicação
-- quando um usuário staff abre o relatório e o mês corrente ainda não tem snapshot.

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
