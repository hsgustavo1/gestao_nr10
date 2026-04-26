-- Garante unicidade de cor+numero apenas entre cadeados ativos
DROP INDEX IF EXISTS public.padlocks_color_number_active_unique;
CREATE UNIQUE INDEX padlocks_color_number_active_unique
  ON public.padlocks (color, number)
  WHERE cancelled = false;

-- 1 cadeado azul ativo por matrícula
DROP INDEX IF EXISTS public.padlocks_one_azul_per_registration;
CREATE UNIQUE INDEX padlocks_one_azul_per_registration
  ON public.padlocks (owner_registration)
  WHERE cancelled = false AND color = 'azul' AND owner_registration IS NOT NULL;

-- 1 cadeado latão ativo por matrícula
DROP INDEX IF EXISTS public.padlocks_one_latao_per_registration;
CREATE UNIQUE INDEX padlocks_one_latao_per_registration
  ON public.padlocks (owner_registration)
  WHERE cancelled = false AND color = 'latao' AND owner_registration IS NOT NULL;