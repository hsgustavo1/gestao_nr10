
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
