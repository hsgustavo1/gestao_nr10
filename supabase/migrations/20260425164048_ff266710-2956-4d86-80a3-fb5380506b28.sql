-- =============================================================
-- Onda 0: papéis (apoio), ampliação de padlocks (cancelamento)
-- e tabela de configurações
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

-- 2) Função is_staff: aceitar 'apoio' (substitui 'supervisor')
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

-- 4) Trocar índices únicos para parciais (só registros ativos)
-- número único por cor — apenas entre não-cancelados
DROP INDEX IF EXISTS public.padlocks_color_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS padlocks_color_number_active_key
  ON public.padlocks (color, number)
  WHERE cancelled = false;

-- matrícula única em azul/latão — apenas entre não-cancelados
DROP INDEX IF EXISTS public.padlocks_owner_unique_blue_brass;
CREATE UNIQUE INDEX IF NOT EXISTS padlocks_owner_unique_blue_brass_active
  ON public.padlocks (color, lower(owner_registration))
  WHERE color IN ('azul','latao')
    AND cancelled = false
    AND owner_registration IS NOT NULL;

-- 5) Tabela de configurações (chave/valor)
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave text PRIMARY KEY,
  valor text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Todos podem ler (inclusive viewer público)
DROP POLICY IF EXISTS "config_public_read" ON public.configuracoes;
CREATE POLICY "config_public_read"
  ON public.configuracoes
  FOR SELECT
  USING (true);

-- Apenas admin pode inserir/atualizar/excluir configurações
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
