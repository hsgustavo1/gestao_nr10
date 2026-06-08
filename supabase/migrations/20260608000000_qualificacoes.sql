
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
  instruction_id uuid NOT NULL REFERENCES public.work_instructions(id) ON DELETE CASCADE,
  status         text NOT NULL CHECK (status IN ('ok','pendente','vencido')) DEFAULT 'pendente',
  conclusao_date date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, instruction_id)
);
ALTER TABLE public.it_trainings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_it_employee ON public.it_trainings(employee_id);

-- ============ updated_at triggers ============
-- NOTE: touch_updated_at() function already exists from first migration — do NOT recreate it.
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
