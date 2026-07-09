-- ============================================================================
-- Trilha C — Wizard de Relatório RTI (2026-07-09)
-- 1) rti_report_wizard: rascunho 1:1 do wizard (etapas, identificação, overrides).
-- 2) rti_report_pdfs: versões emitidas do PDF (imutável, auditoria).
-- 3) organizations: identidade mínima do consultor no PDF (white-label mínimo).
-- 4) fn_set_org_branding: escrita de branding sem policy column-level.
-- 5) bucket org-assets: logo do consultor.
-- Idempotente. Aplicada via Supabase MCP (apply_migration) + versionada aqui.
-- ============================================================================

-- ---------- 1. Rascunho do wizard ----------
CREATE TABLE IF NOT EXISTS public.rti_report_wizard (
  report_id     uuid PRIMARY KEY REFERENCES public.rti_reports(id) ON DELETE CASCADE,
  etapa_atual   smallint NOT NULL DEFAULT 1 CHECK (etapa_atual BETWEEN 1 AND 5),
  identificacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ncs_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { [ncId]: {descricao?, recomendacao?, incluir?, fotosExcluidas?} }
  parecer          text,
  resumo_executivo text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rti_report_wizard ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS rti_report_wizard_touch ON public.rti_report_wizard;
CREATE TRIGGER rti_report_wizard_touch
  BEFORE UPDATE ON public.rti_report_wizard
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Visibilidade espelha o report: o EXISTS roda sob o RLS de rti_reports do
-- próprio usuário — se ele enxerga o report, enxerga o rascunho.
DROP POLICY IF EXISTS "rti_wizard_select" ON public.rti_report_wizard;
CREATE POLICY "rti_wizard_select" ON public.rti_report_wizard FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rti_reports r WHERE r.id = report_id));

-- Escrita: membro da org do report ou consultoria que a gere (padrão RLS Pessoas).
DROP POLICY IF EXISTS "rti_wizard_write" ON public.rti_report_wizard;
CREATE POLICY "rti_wizard_write" ON public.rti_report_wizard FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.rti_reports r WHERE r.id = report_id
      AND (public.org_role_at_least(auth.uid(), r.org_id, 'member')
           OR public.fn_org_is_manager(auth.uid(), r.org_id))))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rti_reports r WHERE r.id = report_id
      AND (public.org_role_at_least(auth.uid(), r.org_id, 'member')
           OR public.fn_org_is_manager(auth.uid(), r.org_id))));

-- ---------- 2. Versões emitidas ----------
CREATE TABLE IF NOT EXISTS public.rti_report_pdfs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        uuid NOT NULL REFERENCES public.rti_reports(id) ON DELETE CASCADE,
  versao           integer NOT NULL,
  file_path        text NOT NULL,               -- bucket rti-evidencias
  emitido_por      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  emitido_por_nome text,
  emitido_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, versao)
);
ALTER TABLE public.rti_report_pdfs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rti_report_pdfs_report ON public.rti_report_pdfs(report_id);

DROP POLICY IF EXISTS "rti_pdfs_select" ON public.rti_report_pdfs;
CREATE POLICY "rti_pdfs_select" ON public.rti_report_pdfs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rti_reports r WHERE r.id = report_id));

-- Só INSERT (reemissão = versão nova; nunca UPDATE/DELETE — trilha de auditoria).
DROP POLICY IF EXISTS "rti_pdfs_insert" ON public.rti_report_pdfs;
CREATE POLICY "rti_pdfs_insert" ON public.rti_report_pdfs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rti_reports r WHERE r.id = report_id
      AND (public.org_role_at_least(auth.uid(), r.org_id, 'member')
           OR public.fn_org_is_manager(auth.uid(), r.org_id))));

-- ---------- 3. Branding do consultor ----------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS cor_primaria text,
  ADD COLUMN IF NOT EXISTS razao_social_relatorio text,
  ADD COLUMN IF NOT EXISTS registro_profissional text;

-- ---------- 4. RPC de branding ----------
CREATE OR REPLACE FUNCTION public.fn_set_org_branding(
  _org_id uuid,
  _logo_path text,
  _cor_primaria text,
  _razao_social_relatorio text,
  _registro_profissional text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_platform_admin(auth.uid())
          OR public.org_role_at_least(auth.uid(), _org_id, 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão para editar a identidade desta organização';
  END IF;
  UPDATE public.organizations
     SET logo_path = _logo_path,
         cor_primaria = _cor_primaria,
         razao_social_relatorio = _razao_social_relatorio,
         registro_profissional = _registro_profissional
   WHERE id = _org_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_set_org_branding(uuid, text, text, text, text) TO authenticated;

-- ---------- 5. Bucket org-assets (logo) ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-assets', 'org-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Path: {org_id}/logo-<timestamp>.<ext> — 1º segmento é a org dona.
DROP POLICY IF EXISTS "org_assets_public_read" ON storage.objects;
CREATE POLICY "org_assets_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'org-assets');

DROP POLICY IF EXISTS "org_assets_admin_insert" ON storage.objects;
CREATE POLICY "org_assets_admin_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'org-assets'
    AND (public.is_platform_admin(auth.uid())
         OR public.org_role_at_least(auth.uid(), ((string_to_array(name, '/'))[1])::uuid, 'admin')));

DROP POLICY IF EXISTS "org_assets_admin_delete" ON storage.objects;
CREATE POLICY "org_assets_admin_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'org-assets'
    AND (public.is_platform_admin(auth.uid())
         OR public.org_role_at_least(auth.uid(), ((string_to_array(name, '/'))[1])::uuid, 'admin')));
