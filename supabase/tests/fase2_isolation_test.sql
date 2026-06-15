-- ============================================================================
-- Fase 2 — Teste de isolamento multi-tenant (RLS)
-- ----------------------------------------------------------------------------
-- Roda TUDO numa transação com ROLLBACK no fim: insere "sondas" (1 inspeção por
-- org), simula cada usuário definindo o JWT claim `sub` + role authenticated,
-- e mede o que cada um enxerga. Nada persiste.
--
-- Pré-requisitos:
--   1. Migrações aplicadas: 20260614000000, 20260614010000, 20260614020000.
--   2. Usuários de teste criados e vinculados (ver seed). Substitua os 4 UUIDs:
--        :consultor   = membro 'owner' da Consultoria Demo (...c0)
--        :cliente_a   = membro da org Cliente A (...a0)
--        :cliente_b   = membro da org Cliente B (...b0)
--        :plat_admin  = seu usuário (linha em platform_admins)
--
-- Como simular um usuário no SQL Editor: o editor roda como postgres (superuser),
-- que BYPASSA o RLS. Por isso cada bloco faz `SET LOCAL ROLE authenticated` —
-- assim auth.uid() passa a ler o claim `sub` e o RLS é aplicado de verdade.
--
-- Resultado esperado (cada linha = um usuário):
--   consultor   →  ve_A>=1   ve_B=0    ve_consultoria>=1   (revenda: vê A, não B)
--   cliente_a   →  ve_A>=1   ve_B=0    ve_consultoria=0    (só a própria org)
--   cliente_b   →  ve_A=0    ve_B>=1   ve_consultoria=0    (só a própria org)
--   plat_admin  →  ve_A>=1   ve_B>=1   ve_consultoria>=1   (cross-tenant)
-- ============================================================================

\set consultor  '00000000-0000-0000-0000-000000000000'
\set cliente_a  '00000000-0000-0000-0000-000000000000'
\set cliente_b  '00000000-0000-0000-0000-000000000000'
\set plat_admin '00000000-0000-0000-0000-000000000000'
-- ^ Substitua os 4 UUIDs acima. (No SQL Editor da web, troque direto no texto
--   onde aparecem :'consultor' etc., pois \set é recurso do psql/CLI.)

BEGIN;

-- Sondas: 1 inspeção por org (inseridas como superuser, RLS bypassado).
INSERT INTO public.field_inspections (id, org_id, titulo, data_inspecao, status, arquivada_campo)
VALUES
  ('11111111-1111-1111-1111-1111111111a0', '00000000-0000-0000-0000-0000000000a0', 'PROBE A', now(), 'em_andamento', false),
  ('11111111-1111-1111-1111-1111111111b0', '00000000-0000-0000-0000-0000000000b0', 'PROBE B', now(), 'em_andamento', false),
  ('11111111-1111-1111-1111-1111111111c0', '00000000-0000-0000-0000-0000000000c0', 'PROBE C', now(), 'em_andamento', false);

-- Função auxiliar inline: conta o que o usuário corrente enxerga.
-- (repetida por usuário; SET LOCAL ROLE garante a aplicação do RLS)

-- ── consultor ───────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'consultor', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT 'consultor' AS quem,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000a0') AS ve_A,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000b0') AS ve_B,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000c0') AS ve_consultoria
FROM public.field_inspections;
RESET ROLE;

-- ── cliente_a ────────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'cliente_a', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT 'cliente_a' AS quem,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000a0') AS ve_A,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000b0') AS ve_B,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000c0') AS ve_consultoria
FROM public.field_inspections;
RESET ROLE;

-- ── cliente_b ────────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'cliente_b', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT 'cliente_b' AS quem,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000a0') AS ve_A,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000b0') AS ve_B,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000c0') AS ve_consultoria
FROM public.field_inspections;
RESET ROLE;

-- ── plat_admin (você) ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'plat_admin', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT 'plat_admin' AS quem,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000a0') AS ve_A,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000b0') AS ve_B,
  count(*) FILTER (WHERE org_id='00000000-0000-0000-0000-0000000000c0') AS ve_consultoria
FROM public.field_inspections;
RESET ROLE;

ROLLBACK; -- descarta as sondas; nada persiste
