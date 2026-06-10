-- ============ 20260423164152_14820dce-430e-4ced-8360-d5daf40d9e28.sql ============

-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','supervisor')
  )
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PADLOCKS ============
CREATE TYPE public.padlock_status AS ENUM ('disponivel', 'aplicado');

CREATE TABLE public.padlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status public.padlock_status NOT NULL DEFAULT 'disponivel',
  location text,
  applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_by_name text,
  applied_at timestamptz,
  due_at timestamptz,
  reason text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.padlocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_padlocks_status ON public.padlocks(status);
CREATE INDEX idx_padlocks_code ON public.padlocks(code);

-- ============ AUDIT EVENTS ============
CREATE TABLE public.padlock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  padlock_id uuid NOT NULL REFERENCES public.padlocks(id) ON DELETE CASCADE,
  padlock_code text NOT NULL,
  action text NOT NULL, -- created | updated | deleted | applied | released
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  previous_data jsonb,
  new_data jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.padlock_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_events_padlock ON public.padlock_events(padlock_id, created_at DESC);

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER padlocks_touch BEFORE UPDATE ON public.padlocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RLS POLICIES ============

-- profiles: readable by anyone logged in, self-update
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- user_roles: anyone can read (needed for UI), only admin can write
CREATE POLICY "roles_select_all" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "roles_admin_insert" ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_update" ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_delete" ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- padlocks: public read; staff insert/apply; admin edit/delete
CREATE POLICY "padlocks_public_read" ON public.padlocks FOR SELECT USING (true);
CREATE POLICY "padlocks_staff_insert" ON public.padlocks FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()));
-- Supervisors can update only the apply/release fields; Admin can update anything
-- We allow UPDATE for staff; column-level distinction is enforced in application logic + audit
CREATE POLICY "padlocks_staff_update" ON public.padlocks FOR UPDATE
  USING (public.is_staff(auth.uid()));
CREATE POLICY "padlocks_admin_delete" ON public.padlocks FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- padlock_events: public read; any authenticated staff can insert (audit append-only)
CREATE POLICY "events_public_read" ON public.padlock_events FOR SELECT USING (true);
CREATE POLICY "events_staff_insert" ON public.padlock_events FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()));
-- No update/delete on events => immutability

-- ============ 20260423164210_a45d6df4-1239-4d97-926b-3db76c1fab84.sql ============

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ 20260424012014_9246fae2-c5af-48f1-92b5-12948ec9430b.sql ============
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
-- ============ 20260424012624_8e16fab8-843a-4a5c-bb6e-944409d41f2d.sql ============
-- 1) Cor do cadeado
DO $$ BEGIN
  CREATE TYPE public.padlock_color AS ENUM ('azul','amarelo','latao','vermelho');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Novas colunas (todas nullable inicialmente; trigger garante coerÃªncia)
ALTER TABLE public.padlocks
  ADD COLUMN IF NOT EXISTS color public.padlock_color,
  ADD COLUMN IF NOT EXISTS number integer,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_registration text,
  ADD COLUMN IF NOT EXISTS owner_role text,
  ADD COLUMN IF NOT EXISTS owner_sector text,
  ADD COLUMN IF NOT EXISTS owner_phone text;

-- 3) Backfill para registros existentes: marcar como 'azul' nÂº 0 (placeholder).
-- Sem registros reais, isto Ã© seguro.
UPDATE public.padlocks
   SET color = COALESCE(color, 'azul'),
       number = COALESCE(number, 0)
 WHERE color IS NULL OR number IS NULL;

ALTER TABLE public.padlocks
  ALTER COLUMN color SET NOT NULL,
  ALTER COLUMN number SET NOT NULL;

-- 4) Unicidade: nÃºmero Ãºnico por cor
CREATE UNIQUE INDEX IF NOT EXISTS padlocks_color_number_key
  ON public.padlocks (color, number);

-- 5) Unicidade adicional: 1 cadeado azul ou latÃ£o por matrÃ­cula
CREATE UNIQUE INDEX IF NOT EXISTS padlocks_owner_unique_blue_brass
  ON public.padlocks (color, lower(owner_registration))
  WHERE color IN ('azul','latao') AND owner_registration IS NOT NULL;

-- 6) Trigger de validaÃ§Ã£o por cor
CREATE OR REPLACE FUNCTION public.validate_padlock_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number < 0 THEN
    RAISE EXCEPTION 'NÃºmero do cadeado Ã© obrigatÃ³rio e deve ser >= 0';
  END IF;

  -- Sincroniza o code visÃ­vel: "<cor>-<numero>" (preserva busca por cÃ³digo nas URLs)
  NEW.code := NEW.color::text || '-' || NEW.number::text;

  IF NEW.color = 'vermelho' THEN
    -- Vermelho: sÃ³ exige nÃºmero e setor
    IF NEW.owner_sector IS NULL OR length(btrim(NEW.owner_sector)) = 0 THEN
      RAISE EXCEPTION 'Setor Ã© obrigatÃ³rio para cadeados vermelhos';
    END IF;
  ELSE
    -- Demais cores: todos os campos do dono sÃ£o obrigatÃ³rios
    IF NEW.owner_name IS NULL OR length(btrim(NEW.owner_name)) = 0 THEN
      RAISE EXCEPTION 'Nome do dono Ã© obrigatÃ³rio';
    END IF;
    IF NEW.owner_registration IS NULL OR length(btrim(NEW.owner_registration)) = 0 THEN
      RAISE EXCEPTION 'MatrÃ­cula do dono Ã© obrigatÃ³ria';
    END IF;
    IF NEW.owner_role IS NULL OR length(btrim(NEW.owner_role)) = 0 THEN
      RAISE EXCEPTION 'FunÃ§Ã£o do dono Ã© obrigatÃ³ria';
    END IF;
    IF NEW.owner_sector IS NULL OR length(btrim(NEW.owner_sector)) = 0 THEN
      RAISE EXCEPTION 'Setor do dono Ã© obrigatÃ³rio';
    END IF;
    IF NEW.owner_phone IS NULL OR length(btrim(NEW.owner_phone)) = 0 THEN
      RAISE EXCEPTION 'Telefone do dono Ã© obrigatÃ³rio';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS padlocks_validate_owner ON public.padlocks;
CREATE TRIGGER padlocks_validate_owner
  BEFORE INSERT OR UPDATE ON public.padlocks
  FOR EACH ROW EXECUTE FUNCTION public.validate_padlock_owner();

-- 7) Trigger de updated_at (caso ainda nÃ£o exista)
DROP TRIGGER IF EXISTS padlocks_touch_updated_at ON public.padlocks;
CREATE TRIGGER padlocks_touch_updated_at
  BEFORE UPDATE ON public.padlocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- ============ 20260425164048_ff266710-2956-4d86-80a3-fb5380506b28.sql ============
-- =============================================================
-- Onda 0: papÃ©is (apoio), ampliaÃ§Ã£o de padlocks (cancelamento)
-- e tabela de configuraÃ§Ãµes
-- =============================================================

-- 1) Renomear o valor de enum 'supervisor' -> 'apoio'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'supervisor'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'apoio'
  ) THEN
    ALTER TYPE public.app_role RENAME VALUE 'supervisor' TO 'apoio';
  END IF;
END $$;

-- 2) FunÃ§Ã£o is_staff: aceitar 'apoio' (substitui 'supervisor')
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','apoio')
  )
$$;

-- 3) Ampliar padlocks com campos de cancelamento (soft-delete)
ALTER TABLE public.padlocks
  ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_detail text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

-- 4) Trocar Ã­ndices Ãºnicos para parciais (sÃ³ registros ativos)
-- nÃºmero Ãºnico por cor â€” apenas entre nÃ£o-cancelados
DROP INDEX IF EXISTS public.padlocks_color_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS padlocks_color_number_active_key
  ON public.padlocks (color, number)
  WHERE cancelled = false;

-- matrÃ­cula Ãºnica em azul/latÃ£o â€” apenas entre nÃ£o-cancelados
DROP INDEX IF EXISTS public.padlocks_owner_unique_blue_brass;
CREATE UNIQUE INDEX IF NOT EXISTS padlocks_owner_unique_blue_brass_active
  ON public.padlocks (color, lower(owner_registration))
  WHERE color IN ('azul','latao')
    AND cancelled = false
    AND owner_registration IS NOT NULL;

-- 5) Tabela de configuraÃ§Ãµes (chave/valor)
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave text PRIMARY KEY,
  valor text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Todos podem ler (inclusive viewer pÃºblico)
DROP POLICY IF EXISTS "config_public_read" ON public.configuracoes;
CREATE POLICY "config_public_read"
  ON public.configuracoes
  FOR SELECT
  USING (true);

-- Apenas admin pode inserir/atualizar/excluir configuraÃ§Ãµes
DROP POLICY IF EXISTS "config_admin_insert" ON public.configuracoes;
CREATE POLICY "config_admin_insert"
  ON public.configuracoes
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "config_admin_update" ON public.configuracoes;
CREATE POLICY "config_admin_update"
  ON public.configuracoes
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "config_admin_delete" ON public.configuracoes;
CREATE POLICY "config_admin_delete"
  ON public.configuracoes
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
DROP TRIGGER IF EXISTS configuracoes_touch_updated_at ON public.configuracoes;
CREATE TRIGGER configuracoes_touch_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed: pasta de backup vazia (admin pode editar depois)
INSERT INTO public.configuracoes (chave, valor)
VALUES ('pasta_backup', '')
ON CONFLICT (chave) DO NOTHING;

-- ============ 20260426131929_a0c3d159-2116-46dd-bb3e-2aa0f3653598.sql ============
-- Garante unicidade de cor+numero apenas entre cadeados ativos
DROP INDEX IF EXISTS public.padlocks_color_number_active_unique;
CREATE UNIQUE INDEX padlocks_color_number_active_unique
  ON public.padlocks (color, number)
  WHERE cancelled = false;

-- 1 cadeado azul ativo por matrÃ­cula
DROP INDEX IF EXISTS public.padlocks_one_azul_per_registration;
CREATE UNIQUE INDEX padlocks_one_azul_per_registration
  ON public.padlocks (owner_registration)
  WHERE cancelled = false AND color = 'azul' AND owner_registration IS NOT NULL;

-- 1 cadeado latÃ£o ativo por matrÃ­cula
DROP INDEX IF EXISTS public.padlocks_one_latao_per_registration;
CREATE UNIQUE INDEX padlocks_one_latao_per_registration
  ON public.padlocks (owner_registration)
  WHERE cancelled = false AND color = 'latao' AND owner_registration IS NOT NULL;
-- ============ 20260428003019_b1330660-4ff3-45ce-9281-8b0f71714b74.sql ============
-- Bucket pÃºblico para fotos de etiquetas LOTO (uma foto por cadeado, identificada pelo padlock.id)
INSERT INTO storage.buckets (id, name, public)
VALUES ('padlock-photos', 'padlock-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pÃºblica (etiqueta pode ser impressa por visualizadores)
DROP POLICY IF EXISTS "padlock_photos_public_read" ON storage.objects;
CREATE POLICY "padlock_photos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'padlock-photos');

-- Upload/substituiÃ§Ã£o/remoÃ§Ã£o: apenas equipe (admin ou apoio)
DROP POLICY IF EXISTS "padlock_photos_staff_insert" ON storage.objects;
CREATE POLICY "padlock_photos_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'padlock-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "padlock_photos_staff_update" ON storage.objects;
CREATE POLICY "padlock_photos_staff_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'padlock-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "padlock_photos_staff_delete" ON storage.objects;
CREATE POLICY "padlock_photos_staff_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'padlock-photos' AND public.is_staff(auth.uid()));
-- ============ 20260501215140_2049354d-8683-4496-8822-0de7504e9053.sql ============
INSERT INTO public.configuracoes (chave, valor)
VALUES (
  'sectors',
  '["CALDEIRARIA","ELÃ‰TRICA E INSTRUMENTAÃ‡ÃƒO","GERAÃ‡ÃƒO DE ENERGIA","GERAÃ‡ÃƒO DE VAPOR","HIDROJATO","LABORATÃ“RIO E PCTS","MECÃ‚NICA, LUBRIFICAÃ‡ÃƒO E USINAGEM","PCM","PCTS","PRODUÃ‡ÃƒO DE ÃLCOOL","RPE","SERVIÃ‡OS ADMINISTRATIVOS","TRATAMENTO DE ÃGUA - ETA","TRATAMENTO DO CALDO"]'
)
ON CONFLICT (chave) DO NOTHING;
-- ============ 20260504115124_da23de3f-add1-447f-9de7-e89ebe96f47e.sql ============
-- Permitir upload e atualizaÃ§Ã£o pÃºblicos de fotos no bucket padlock-photos
-- (necessÃ¡rio para visualizadores sem login imprimirem etiquetas com foto)
DROP POLICY IF EXISTS padlock_photos_staff_insert ON storage.objects;
DROP POLICY IF EXISTS padlock_photos_staff_update ON storage.objects;

CREATE POLICY padlock_photos_public_insert
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'padlock-photos');

CREATE POLICY padlock_photos_public_update
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'padlock-photos');

-- ============ 20260505223258_f3df9ee4-2f24-4864-b620-6f7390405f0b.sql ============

-- Tabela de reports de inconsistÃªncia em dispositivos
CREATE TABLE public.padlock_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  padlock_id uuid NOT NULL,
  padlock_code text NOT NULL,
  reporter_name text,
  reporter_contact text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando',
  resolution_note text,
  resolved_by uuid,
  resolved_by_name text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT padlock_reports_status_check CHECK (status IN ('aguardando','solucionado','recusado'))
);

CREATE INDEX idx_padlock_reports_padlock ON public.padlock_reports(padlock_id);
CREATE INDEX idx_padlock_reports_status ON public.padlock_reports(status);

ALTER TABLE public.padlock_reports ENABLE ROW LEVEL SECURITY;

-- Qualquer um (logado ou nÃ£o) pode criar um report
CREATE POLICY "reports_public_insert"
  ON public.padlock_reports FOR INSERT
  WITH CHECK (true);

-- Apenas admin (Dono de RAC) pode ver
CREATE POLICY "reports_admin_read"
  ON public.padlock_reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admin pode atualizar (marcar como solucionado/recusado)
CREATE POLICY "reports_admin_update"
  ON public.padlock_reports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admin pode deletar
CREATE POLICY "reports_admin_delete"
  ON public.padlock_reports FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER padlock_reports_touch_updated_at
  BEFORE UPDATE ON public.padlock_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- HistÃ³rico imutÃ¡vel de mudanÃ§as nos reports
CREATE TABLE public.padlock_report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  padlock_id uuid NOT NULL,
  padlock_code text NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  actor_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_padlock_report_events_report ON public.padlock_report_events(report_id);

ALTER TABLE public.padlock_report_events ENABLE ROW LEVEL SECURITY;

-- InserÃ§Ã£o pÃºblica (para registrar 'criado' quando reporter sem login)
CREATE POLICY "report_events_public_insert"
  ON public.padlock_report_events FOR INSERT
  WITH CHECK (true);

-- Apenas admin pode ler o histÃ³rico
CREATE POLICY "report_events_admin_read"
  ON public.padlock_report_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ 20260506164507_46ac5e1a-3dc8-4c4f-933e-48a86b7f3687.sql ============

CREATE TABLE public.padlock_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_date date NOT NULL,
  reason text NOT NULL,
  requester text NOT NULL,
  sector text NOT NULL,
  document_path text NOT NULL,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.padlock_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "violations_public_read"
ON public.padlock_violations FOR SELECT
USING (true);

CREATE POLICY "violations_staff_insert"
ON public.padlock_violations FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('violation-docs', 'violation-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "violation_docs_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'violation-docs');

CREATE POLICY "violation_docs_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'violation-docs' AND public.is_staff(auth.uid()));

-- ============ 20260507163203_3b07a638-2c50-45ba-8ebc-b17897f4f2a6.sql ============
CREATE POLICY "violations_admin_update" ON public.padlock_violations
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- ============ 20260608000000_qualificacoes.sql ============

-- ============ EMPLOYEES ============
CREATE TABLE public.employees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  matricula     text NOT NULL UNIQUE,
  setor         text,
  classificacao text,
  funcao        text,
  escolaridade  text,
  diploma       text,
  diploma_conclusao date,
  crea_cft      text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_employees_matricula ON public.employees(matricula);

-- ============ NR10 TRAININGS ============
CREATE TABLE public.nr10_trainings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  training_type       text NOT NULL CHECK (training_type IN ('nr10_basico','nr10_areas_classificadas','sep')),
  category            text NOT NULL CHECK (category IN ('formacao','reciclagem')),
  training_date       date,
  art                 text,
  responsavel_tecnico text,
  valid               boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, training_type, category)
);
ALTER TABLE public.nr10_trainings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_nr10_employee ON public.nr10_trainings(employee_id);

-- ============ WORK AUTHORIZATIONS ============
CREATE TABLE public.work_authorizations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  level            text NOT NULL CHECK (level IN ('A0','A1','A2','A3','A4')),
  funcao           text,
  abrangencia      text,
  authorization_date date,
  valid            boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id)
);
ALTER TABLE public.work_authorizations ENABLE ROW LEVEL SECURITY;

-- ============ WORK INSTRUCTIONS (IT documents) ============
CREATE TABLE public.work_instructions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  title           text,
  validity_months integer NOT NULL DEFAULT 24,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_instructions ENABLE ROW LEVEL SECURITY;

-- ============ IT TRAININGS ============
CREATE TABLE public.it_trainings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  instruction_id uuid NOT NULL REFERENCES public.work_instructions(id) ON DELETE RESTRICT,
  status         text NOT NULL CHECK (status IN ('ok','pendente','vencido')) DEFAULT 'pendente',
  conclusao_date date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, instruction_id)
);
ALTER TABLE public.it_trainings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_it_employee ON public.it_trainings(employee_id);
CREATE INDEX idx_it_instruction ON public.it_trainings(instruction_id);

-- ============ updated_at triggers ============
-- NOTE: touch_updated_at() function already exists from first migration â€” do NOT recreate it.
CREATE TRIGGER employees_touch      BEFORE UPDATE ON public.employees          FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER nr10_touch           BEFORE UPDATE ON public.nr10_trainings      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER auth_touch           BEFORE UPDATE ON public.work_authorizations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER instructions_touch   BEFORE UPDATE ON public.work_instructions   FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER it_trainings_touch   BEFORE UPDATE ON public.it_trainings        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RLS POLICIES ============
-- employees
CREATE POLICY "emp_read_all"       ON public.employees FOR SELECT USING (true);
CREATE POLICY "emp_staff_insert"   ON public.employees FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "emp_staff_update"   ON public.employees FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "emp_admin_delete"   ON public.employees FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- nr10_trainings
CREATE POLICY "nr10_read_all"      ON public.nr10_trainings FOR SELECT USING (true);
CREATE POLICY "nr10_staff_insert"  ON public.nr10_trainings FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "nr10_staff_update"  ON public.nr10_trainings FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "nr10_admin_delete"  ON public.nr10_trainings FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- work_authorizations
CREATE POLICY "wa_read_all"        ON public.work_authorizations FOR SELECT USING (true);
CREATE POLICY "wa_staff_insert"    ON public.work_authorizations FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "wa_staff_update"    ON public.work_authorizations FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "wa_admin_delete"    ON public.work_authorizations FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- work_instructions
CREATE POLICY "wi_read_all"        ON public.work_instructions FOR SELECT USING (true);
CREATE POLICY "wi_admin_insert"    ON public.work_instructions FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "wi_admin_update"    ON public.work_instructions FOR UPDATE USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "wi_admin_delete"    ON public.work_instructions FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- it_trainings
CREATE POLICY "it_read_all"        ON public.it_trainings FOR SELECT USING (true);
CREATE POLICY "it_staff_insert"    ON public.it_trainings FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "it_staff_update"    ON public.it_trainings FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "it_admin_delete"    ON public.it_trainings FOR DELETE USING (public.has_role(auth.uid(),'admin'));

