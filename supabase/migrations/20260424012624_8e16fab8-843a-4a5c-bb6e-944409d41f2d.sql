-- 1) Cor do cadeado
DO $$ BEGIN
  CREATE TYPE public.padlock_color AS ENUM ('azul','amarelo','latao','vermelho');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Novas colunas (todas nullable inicialmente; trigger garante coerência)
ALTER TABLE public.padlocks
  ADD COLUMN IF NOT EXISTS color public.padlock_color,
  ADD COLUMN IF NOT EXISTS number integer,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_registration text,
  ADD COLUMN IF NOT EXISTS owner_role text,
  ADD COLUMN IF NOT EXISTS owner_sector text,
  ADD COLUMN IF NOT EXISTS owner_phone text;

-- 3) Backfill para registros existentes: marcar como 'azul' nº 0 (placeholder).
-- Sem registros reais, isto é seguro.
UPDATE public.padlocks
   SET color = COALESCE(color, 'azul'),
       number = COALESCE(number, 0)
 WHERE color IS NULL OR number IS NULL;

ALTER TABLE public.padlocks
  ALTER COLUMN color SET NOT NULL,
  ALTER COLUMN number SET NOT NULL;

-- 4) Unicidade: número único por cor
CREATE UNIQUE INDEX IF NOT EXISTS padlocks_color_number_key
  ON public.padlocks (color, number);

-- 5) Unicidade adicional: 1 cadeado azul ou latão por matrícula
CREATE UNIQUE INDEX IF NOT EXISTS padlocks_owner_unique_blue_brass
  ON public.padlocks (color, lower(owner_registration))
  WHERE color IN ('azul','latao') AND owner_registration IS NOT NULL;

-- 6) Trigger de validação por cor
CREATE OR REPLACE FUNCTION public.validate_padlock_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number < 0 THEN
    RAISE EXCEPTION 'Número do cadeado é obrigatório e deve ser >= 0';
  END IF;

  -- Sincroniza o code visível: "<cor>-<numero>" (preserva busca por código nas URLs)
  NEW.code := NEW.color::text || '-' || NEW.number::text;

  IF NEW.color = 'vermelho' THEN
    -- Vermelho: só exige número e setor
    IF NEW.owner_sector IS NULL OR length(btrim(NEW.owner_sector)) = 0 THEN
      RAISE EXCEPTION 'Setor é obrigatório para cadeados vermelhos';
    END IF;
  ELSE
    -- Demais cores: todos os campos do dono são obrigatórios
    IF NEW.owner_name IS NULL OR length(btrim(NEW.owner_name)) = 0 THEN
      RAISE EXCEPTION 'Nome do dono é obrigatório';
    END IF;
    IF NEW.owner_registration IS NULL OR length(btrim(NEW.owner_registration)) = 0 THEN
      RAISE EXCEPTION 'Matrícula do dono é obrigatória';
    END IF;
    IF NEW.owner_role IS NULL OR length(btrim(NEW.owner_role)) = 0 THEN
      RAISE EXCEPTION 'Função do dono é obrigatória';
    END IF;
    IF NEW.owner_sector IS NULL OR length(btrim(NEW.owner_sector)) = 0 THEN
      RAISE EXCEPTION 'Setor do dono é obrigatório';
    END IF;
    IF NEW.owner_phone IS NULL OR length(btrim(NEW.owner_phone)) = 0 THEN
      RAISE EXCEPTION 'Telefone do dono é obrigatório';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS padlocks_validate_owner ON public.padlocks;
CREATE TRIGGER padlocks_validate_owner
  BEFORE INSERT OR UPDATE ON public.padlocks
  FOR EACH ROW EXECUTE FUNCTION public.validate_padlock_owner();

-- 7) Trigger de updated_at (caso ainda não exista)
DROP TRIGGER IF EXISTS padlocks_touch_updated_at ON public.padlocks;
CREATE TRIGGER padlocks_touch_updated_at
  BEFORE UPDATE ON public.padlocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();