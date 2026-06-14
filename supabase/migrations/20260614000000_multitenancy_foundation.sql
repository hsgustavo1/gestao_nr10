-- ============================================================================
-- FUNDAÇÃO MULTI-TENANT — organizations, memberships, entitlements, RLS por org
-- ----------------------------------------------------------------------------
-- Migration ADITIVA e NÃO-DESTRUTIVA. Não há DROP TABLE nem perda de dados.
-- Idempotente: pode ser reaplicada com segurança (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- Aplicar manualmente no SQL Editor do Supabase.
--
-- ⚠️  ATENÇÃO (mudança de comportamento): este script substitui as políticas de
--     leitura `USING (true)` por leitura escopada por organização. Em particular,
--     as tabelas de LOTO (padlocks, padlock_events, ...) deixam de ter leitura
--     pública/anônima. Se o app LOTO tiver alguma página realmente anônima
--     (sem login), valide ANTES de aplicar. Usuários autenticados existentes
--     continuam com acesso pois são migrados como membros da org semente.
-- ============================================================================

-- ---------- 1. ENUMS ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_tipo') THEN
    CREATE TYPE public.org_tipo AS ENUM ('consultoria','cliente','unidade');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
    CREATE TYPE public.org_role AS ENUM ('viewer','member','admin','owner');
  END IF;
END $$;

-- ---------- 2. TABELAS DE TENANCY ----------
CREATE TABLE IF NOT EXISTS public.organizations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL,
  tipo              public.org_tipo NOT NULL DEFAULT 'cliente',
  -- empresa-mãe vê as unidades filhas:
  parent_org_id     uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  -- consultoria (revendedor) que gerencia este org cliente:
  managed_by_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_org_parent  ON public.organizations(parent_org_id);
CREATE INDEX IF NOT EXISTS idx_org_managed ON public.organizations(managed_by_org_id);

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_role   public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_membership_user ON public.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_org  ON public.org_memberships(org_id);

CREATE TABLE IF NOT EXISTS public.org_entitlements (
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module     text NOT NULL CHECK (module IN ('gestao_completa','rti_pwa','loto')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, module)
);
ALTER TABLE public.org_entitlements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.org_public_tokens (
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- token sem depender de extensão pgcrypto:
  token      text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, token)
);
ALTER TABLE public.org_public_tokens ENABLE ROW LEVEL SECURITY;

-- ---------- 3. FUNÇÕES DE ACESSO (SECURITY DEFINER) ----------
-- Mesmo padrão das funções has_role/is_staff já existentes. SECURITY DEFINER
-- faz o RLS dessas tabelas ser ignorado dentro da função, evitando recursão.

CREATE OR REPLACE FUNCTION public.is_platform_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _uid);
$$;

CREATE OR REPLACE FUNCTION public.org_role_rank(_role public.org_role)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _role
    WHEN 'viewer' THEN 1
    WHEN 'member' THEN 2
    WHEN 'admin'  THEN 3
    WHEN 'owner'  THEN 4
  END;
$$;

-- true se o usuário pode ENXERGAR dados do org: membro direto, membro da
-- empresa-mãe (vê unidade filha), ou membro da consultoria que gerencia o org.
CREATE OR REPLACE FUNCTION public.can_access_org(_uid uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_platform_admin(_uid)
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = _uid AND m.org_id = _org_id)
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      JOIN public.organizations o ON o.parent_org_id = m.org_id
      WHERE m.user_id = _uid AND o.id = _org_id)
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      JOIN public.organizations o ON o.managed_by_org_id = m.org_id
      WHERE m.user_id = _uid AND o.id = _org_id);
$$;

-- true se o usuário tem papel >= _min no org (ou via mãe/consultoria gerenciadora).
CREATE OR REPLACE FUNCTION public.org_role_at_least(_uid uuid, _org_id uuid, _min public.org_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_platform_admin(_uid)
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = _uid AND m.org_id = _org_id
        AND public.org_role_rank(m.org_role) >= public.org_role_rank(_min))
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      JOIN public.organizations o ON o.parent_org_id = m.org_id
      WHERE m.user_id = _uid AND o.id = _org_id
        AND public.org_role_rank(m.org_role) >= public.org_role_rank(_min))
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      JOIN public.organizations o ON o.managed_by_org_id = m.org_id
      WHERE m.user_id = _uid AND o.id = _org_id
        AND public.org_role_rank(m.org_role) >= public.org_role_rank(_min));
$$;

CREATE OR REPLACE FUNCTION public.has_entitlement(_org_id uuid, _module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_entitlements WHERE org_id = _org_id AND module = _module);
$$;

-- dois usuários compartilham ao menos um org (para leitura de profiles).
CREATE OR REPLACE FUNCTION public.shares_org(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_memberships x
    JOIN public.org_memberships y ON x.org_id = y.org_id
    WHERE x.user_id = _a AND y.user_id = _b);
$$;

-- ---------- 4. ORG SEMENTE + MIGRAÇÃO DOS DADOS EXISTENTES ----------
-- A base atual é single-tenant: tudo pertence a uma única empresa.
INSERT INTO public.organizations (id, nome, tipo)
VALUES ('00000000-0000-0000-0000-000000000001', 'Empresa Principal', 'cliente')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.org_entitlements (org_id, module) VALUES
  ('00000000-0000-0000-0000-000000000001', 'gestao_completa'),
  ('00000000-0000-0000-0000-000000000001', 'rti_pwa'),
  ('00000000-0000-0000-0000-000000000001', 'loto')
ON CONFLICT DO NOTHING;

-- Usuários com papel global viram membros da org semente.
-- admin global -> owner do org; demais -> member.
INSERT INTO public.org_memberships (user_id, org_id, org_role)
SELECT ur.user_id,
       '00000000-0000-0000-0000-000000000001',
       CASE WHEN ur.role::text = 'admin' THEN 'owner'::public.org_role
            ELSE 'member'::public.org_role END
FROM public.user_roles ur
ON CONFLICT (user_id, org_id) DO NOTHING;

-- ---------- 5. org_id EM TODAS AS TABELAS DE DOMÍNIO (add + backfill + index + FK) ----------
DO $$
DECLARE
  t text;
  domain_tables text[] := ARRAY[
    'employees','nr10_trainings','work_authorizations','work_instructions','it_trainings',
    'training_certificates','epis','epi_tests','asos','electrical_incidents',
    'nr10_documents','nr10_document_versions','inspections','inspection_actions',
    'rti_reports','rti_areas','rti_ncs','rti_nc_evidencias','rti_nc_historico',
    'field_inspections','field_nodes','field_points','field_photos','field_findings',
    'padlocks','padlock_events','padlock_reports','padlock_report_events','padlock_violations',
    'compliance_snapshots','audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY domain_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id uuid', t);
      EXECUTE format($f$UPDATE public.%I SET org_id='00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL$f$, t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(org_id)', 'idx_'||t||'_org', t);
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t||'_org_fk') THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT',
          t, t||'_org_fk');
      END IF;
    END IF;
  END LOOP;
END $$;

-- SET NOT NULL — exceto audit_log (linhas de tabelas sem org ficariam nulas).
DO $$
DECLARE
  t text;
  notnull_tables text[] := ARRAY[
    'employees','nr10_trainings','work_authorizations','work_instructions','it_trainings',
    'training_certificates','epis','epi_tests','asos','electrical_incidents',
    'nr10_documents','nr10_document_versions','inspections','inspection_actions',
    'rti_reports','rti_areas','rti_ncs','rti_nc_evidencias','rti_nc_historico',
    'field_inspections','field_nodes','field_points','field_photos','field_findings',
    'padlocks','padlock_events','padlock_reports','padlock_report_events','padlock_violations',
    'compliance_snapshots'
  ];
BEGIN
  FOREACH t IN ARRAY notnull_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET NOT NULL', t);
    END IF;
  END LOOP;
END $$;

-- ---------- 6. fn_audit passa a registrar org_id ----------
CREATE OR REPLACE FUNCTION public.fn_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _org := (to_jsonb(OLD)->>'org_id')::uuid;
    INSERT INTO public.audit_log (table_name, record_id, action, actor_id, old_data, org_id)
    VALUES (TG_TABLE_NAME, OLD.id::text, TG_OP, auth.uid(), to_jsonb(OLD), _org);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _org := (to_jsonb(NEW)->>'org_id')::uuid;
    INSERT INTO public.audit_log (table_name, record_id, action, actor_id, old_data, new_data, org_id)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, auth.uid(), to_jsonb(OLD), to_jsonb(NEW), _org);
    RETURN NEW;
  ELSE
    _org := (to_jsonb(NEW)->>'org_id')::uuid;
    INSERT INTO public.audit_log (table_name, record_id, action, actor_id, new_data, org_id)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, auth.uid(), to_jsonb(NEW), _org);
    RETURN NEW;
  END IF;
END;
$$;

-- ---------- 6b. REDE DE SEGURANÇA: default automático de org_id no INSERT ----------
-- Evita quebrar os INSERTs existentes do app ao tornar org_id NOT NULL.
-- Se o usuário pertence a exatamente UMA org e não informou org_id, preenche
-- automaticamente. Se pertence a várias, o app DEVE informar org_id (senão falha).
-- NOTA: não usar min(org_id) — o Postgres não tem agregado min() para uuid (erro 42883).
CREATE OR REPLACE FUNCTION public.fn_default_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cnt int; _org uuid;
BEGIN
  IF NEW.org_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT count(*) INTO _cnt FROM public.org_memberships WHERE user_id = auth.uid();
    IF _cnt = 1 THEN
      SELECT org_id INTO _org FROM public.org_memberships
        WHERE user_id = auth.uid() LIMIT 1;
      NEW.org_id := _org;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  defaulted_tables text[] := ARRAY[
    'employees','nr10_trainings','work_authorizations','work_instructions','it_trainings',
    'training_certificates','epis','epi_tests','asos','electrical_incidents',
    'nr10_documents','nr10_document_versions','inspections','inspection_actions',
    'rti_reports','rti_areas','rti_ncs','rti_nc_evidencias','rti_nc_historico',
    'field_inspections','field_nodes','field_points','field_photos','field_findings',
    'padlocks','padlock_events','padlock_reports','padlock_report_events','padlock_violations',
    'compliance_snapshots'
  ];
BEGIN
  FOREACH t IN ARRAY defaulted_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_default_org_'||t, t);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_default_org_id()',
        'trg_default_org_'||t, t);
    END IF;
  END LOOP;
END $$;

-- ---------- 7. compliance_snapshots: unicidade por (org_id, mês) ----------
ALTER TABLE public.compliance_snapshots DROP CONSTRAINT IF EXISTS compliance_snapshots_snapshot_date_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='compliance_snapshots_org_date_key') THEN
    ALTER TABLE public.compliance_snapshots
      ADD CONSTRAINT compliance_snapshots_org_date_key UNIQUE (org_id, snapshot_date);
  END IF;
END $$;

-- ---------- 8. RLS POR ORG ----------
-- 8a. Tabelas padrão (CRUD por membro; DELETE exige admin do org).
DO $$
DECLARE
  t text; p record;
  standard_tables text[] := ARRAY[
    'employees','nr10_trainings','work_authorizations','work_instructions','it_trainings',
    'training_certificates','epis','epi_tests','asos','electrical_incidents',
    'nr10_documents','nr10_document_versions','inspections','inspection_actions',
    'rti_reports','rti_areas','rti_ncs','rti_nc_evidencias','rti_nc_historico',
    'field_inspections','field_nodes','field_points','field_photos','field_findings',
    'padlocks','padlock_reports','padlock_violations'
  ];
BEGIN
  FOREACH t IN ARRAY standard_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END LOOP;
      EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT USING (public.can_access_org(auth.uid(), org_id))$f$, t||'_sel', t);
      EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.org_role_at_least(auth.uid(), org_id, 'member'))$f$, t||'_ins', t);
      EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE USING (public.org_role_at_least(auth.uid(), org_id, 'member'))$f$, t||'_upd', t);
      EXECUTE format($f$CREATE POLICY %I ON public.%I FOR DELETE USING (public.org_role_at_least(auth.uid(), org_id, 'admin'))$f$, t||'_del', t);
    END IF;
  END LOOP;
END $$;

-- 8b. Tabelas append-only de auditoria de LOTO (sem update/delete).
DO $$
DECLARE
  t text; p record;
  append_tables text[] := ARRAY['padlock_events','padlock_report_events'];
BEGIN
  FOREACH t IN ARRAY append_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END LOOP;
      EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT USING (public.can_access_org(auth.uid(), org_id))$f$, t||'_sel', t);
      EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.org_role_at_least(auth.uid(), org_id, 'member'))$f$, t||'_ins', t);
    END IF;
  END LOOP;
END $$;

-- 8c. compliance_snapshots
DROP POLICY IF EXISTS snapshots_read_all     ON public.compliance_snapshots;
DROP POLICY IF EXISTS snapshots_staff_insert ON public.compliance_snapshots;
DROP POLICY IF EXISTS snapshots_staff_update ON public.compliance_snapshots;
DROP POLICY IF EXISTS snapshots_admin_delete ON public.compliance_snapshots;
CREATE POLICY snapshots_sel ON public.compliance_snapshots FOR SELECT USING (public.can_access_org(auth.uid(), org_id));
CREATE POLICY snapshots_ins ON public.compliance_snapshots FOR INSERT WITH CHECK (public.org_role_at_least(auth.uid(), org_id, 'member'));
CREATE POLICY snapshots_upd ON public.compliance_snapshots FOR UPDATE USING (public.org_role_at_least(auth.uid(), org_id, 'member'));
CREATE POLICY snapshots_del ON public.compliance_snapshots FOR DELETE USING (public.org_role_at_least(auth.uid(), org_id, 'admin'));

-- 8d. audit_log (somente leitura escopada; escrita só via trigger SECURITY DEFINER)
DROP POLICY IF EXISTS audit_read_authenticated ON public.audit_log;
CREATE POLICY audit_sel ON public.audit_log FOR SELECT
  USING (org_id IS NULL OR public.can_access_org(auth.uid(), org_id));

-- ---------- 9. RLS DAS TABELAS DE TENANCY ----------
-- organizations
DROP POLICY IF EXISTS orgs_sel ON public.organizations;
DROP POLICY IF EXISTS orgs_ins ON public.organizations;
DROP POLICY IF EXISTS orgs_upd ON public.organizations;
DROP POLICY IF EXISTS orgs_del ON public.organizations;
CREATE POLICY orgs_sel ON public.organizations FOR SELECT
  USING (public.can_access_org(auth.uid(), id));
CREATE POLICY orgs_ins ON public.organizations FOR INSERT WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (managed_by_org_id IS NOT NULL AND public.org_role_at_least(auth.uid(), managed_by_org_id, 'admin'))
  OR (parent_org_id     IS NOT NULL AND public.org_role_at_least(auth.uid(), parent_org_id,     'admin'))
);
CREATE POLICY orgs_upd ON public.organizations FOR UPDATE
  USING (public.is_platform_admin(auth.uid()) OR public.org_role_at_least(auth.uid(), id, 'owner'));
CREATE POLICY orgs_del ON public.organizations FOR DELETE
  USING (public.is_platform_admin(auth.uid()));

-- org_memberships
DROP POLICY IF EXISTS mem_sel ON public.org_memberships;
DROP POLICY IF EXISTS mem_ins ON public.org_memberships;
DROP POLICY IF EXISTS mem_upd ON public.org_memberships;
DROP POLICY IF EXISTS mem_del ON public.org_memberships;
CREATE POLICY mem_sel ON public.org_memberships FOR SELECT USING (
  user_id = auth.uid() OR public.is_platform_admin(auth.uid()) OR public.can_access_org(auth.uid(), org_id)
);
CREATE POLICY mem_ins ON public.org_memberships FOR INSERT WITH CHECK (
  public.org_role_at_least(auth.uid(), org_id, 'admin')
);
CREATE POLICY mem_upd ON public.org_memberships FOR UPDATE USING (
  public.org_role_at_least(auth.uid(), org_id, 'admin')
);
CREATE POLICY mem_del ON public.org_memberships FOR DELETE USING (
  public.org_role_at_least(auth.uid(), org_id, 'admin')
);

-- org_entitlements: leitura escopada; escrita só do dono da plataforma
DROP POLICY IF EXISTS ent_sel ON public.org_entitlements;
DROP POLICY IF EXISTS ent_ins ON public.org_entitlements;
DROP POLICY IF EXISTS ent_upd ON public.org_entitlements;
DROP POLICY IF EXISTS ent_del ON public.org_entitlements;
CREATE POLICY ent_sel ON public.org_entitlements FOR SELECT USING (public.can_access_org(auth.uid(), org_id));
CREATE POLICY ent_ins ON public.org_entitlements FOR INSERT WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY ent_upd ON public.org_entitlements FOR UPDATE USING (public.is_platform_admin(auth.uid()));
CREATE POLICY ent_del ON public.org_entitlements FOR DELETE USING (public.is_platform_admin(auth.uid()));

-- platform_admins: bootstrap inicial via SQL Editor (service role ignora RLS)
DROP POLICY IF EXISTS pa_sel ON public.platform_admins;
DROP POLICY IF EXISTS pa_ins ON public.platform_admins;
DROP POLICY IF EXISTS pa_upd ON public.platform_admins;
DROP POLICY IF EXISTS pa_del ON public.platform_admins;
CREATE POLICY pa_sel ON public.platform_admins FOR SELECT USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY pa_ins ON public.platform_admins FOR INSERT WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY pa_upd ON public.platform_admins FOR UPDATE USING (public.is_platform_admin(auth.uid()));
CREATE POLICY pa_del ON public.platform_admins FOR DELETE USING (public.is_platform_admin(auth.uid()));

-- org_public_tokens: gerenciado por admin do org (a leitura pública da vitrine
-- será feita por função SECURITY DEFINER em fase posterior, não por RLS direto)
DROP POLICY IF EXISTS opt_sel ON public.org_public_tokens;
DROP POLICY IF EXISTS opt_ins ON public.org_public_tokens;
DROP POLICY IF EXISTS opt_del ON public.org_public_tokens;
CREATE POLICY opt_sel ON public.org_public_tokens FOR SELECT USING (public.org_role_at_least(auth.uid(), org_id, 'admin'));
CREATE POLICY opt_ins ON public.org_public_tokens FOR INSERT WITH CHECK (public.org_role_at_least(auth.uid(), org_id, 'admin'));
CREATE POLICY opt_del ON public.org_public_tokens FOR DELETE USING (public.org_role_at_least(auth.uid(), org_id, 'admin'));

-- ---------- 10. profiles: leitura só de si, co-membros ou platform admin ----------
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
DROP POLICY IF EXISTS profiles_select_scoped ON public.profiles;
CREATE POLICY profiles_select_scoped ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR public.is_platform_admin(auth.uid())
  OR public.shares_org(auth.uid(), id)
);
-- (profiles_update_self permanece inalterada)

-- ============================================================================
-- PÓS-MIGRAÇÃO (manual, fora deste script):
--   1) Definir o platform admin (você). Rode no SQL Editor com seu user_id:
--        INSERT INTO public.platform_admins (user_id) VALUES ('<seu-auth-uid>');
--   2) Conferir backfill: nenhuma linha com org_id NULL nas tabelas de domínio.
--   3) NÃO foi tocada a tabela `user_roles` (papéis globais legados) — continua
--      existindo para compatibilidade até a UI migrar 100% para org_memberships.
-- ============================================================================
