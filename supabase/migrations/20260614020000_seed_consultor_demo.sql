-- ============================================================================
-- Fase 2 — Seed do cenário MVP: consultor entregando RTI+PWA
-- ----------------------------------------------------------------------------
-- Idempotente, aditiva. Aplicar manualmente no SQL Editor APÓS as migrações
-- 20260614000000 (fundação) e 20260614010000 (cascata de org_id).
--
-- Cria:
--   - Consultoria Demo (org tipo consultoria) — o "revendedor".
--   - Cliente Demo A (org tipo cliente) gerenciado pela Consultoria Demo.
--   - Cliente Demo B (org tipo cliente) INDEPENDENTE — serve ao teste de
--     isolamento negativo (consultor de A NÃO pode ver B).
--   - Entitlement rti_pwa nos clientes (e gestao_completa na consultoria).
--
-- Os VÍNCULOS de usuários (org_memberships) ficam como template comentado no
-- fim: crie os usuários de teste via a edge function admin-users (passando
-- org_id + org_role) ou pelo dashboard, e então rode os inserts com os UUIDs
-- reais. Veja supabase/tests/fase2_isolation_test.sql para validar.
-- ============================================================================

-- UUIDs fixos do cenário demo (fáceis de reconhecer):
--   Consultoria : 00000000-0000-0000-0000-0000000000c0
--   Cliente A   : 00000000-0000-0000-0000-0000000000a0  (managed_by consultoria)
--   Cliente B   : 00000000-0000-0000-0000-0000000000b0  (independente)

INSERT INTO public.organizations (id, nome, tipo) VALUES
  ('00000000-0000-0000-0000-0000000000c0', 'Consultoria Demo', 'consultoria'),
  ('00000000-0000-0000-0000-0000000000a0', 'Cliente Demo A',   'cliente'),
  ('00000000-0000-0000-0000-0000000000b0', 'Cliente Demo B',   'cliente')
ON CONFLICT (id) DO NOTHING;

-- Cliente A é gerenciado pela Consultoria Demo (revenda). Cliente B não.
UPDATE public.organizations
  SET managed_by_org_id = '00000000-0000-0000-0000-0000000000c0'
  WHERE id = '00000000-0000-0000-0000-0000000000a0';

INSERT INTO public.org_entitlements (org_id, module) VALUES
  ('00000000-0000-0000-0000-0000000000c0', 'gestao_completa'),
  ('00000000-0000-0000-0000-0000000000c0', 'rti_pwa'),
  ('00000000-0000-0000-0000-0000000000a0', 'rti_pwa'),
  ('00000000-0000-0000-0000-0000000000b0', 'rti_pwa')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- TEMPLATE — vincular usuários de teste (rode após criar os usuários)
-- ----------------------------------------------------------------------------
-- Recomendado: criar via edge function admin-users, que já insere a membership:
--   create { email, password, org_id, org_role }
--     consultor → org_id = ...c0, org_role = 'owner'
--     usuário do Cliente A → org_id = ...a0, org_role = 'member'
--     usuário do Cliente B → org_id = ...b0, org_role = 'member'
--
-- Ou, se criar os usuários pelo dashboard, vincule manualmente (troque os UUIDs):
--
-- INSERT INTO public.org_memberships (user_id, org_id, org_role) VALUES
--   ('<UUID_CONSULTOR>',  '00000000-0000-0000-0000-0000000000c0', 'owner'),
--   ('<UUID_CLIENTE_A>',  '00000000-0000-0000-0000-0000000000a0', 'member'),
--   ('<UUID_CLIENTE_B>',  '00000000-0000-0000-0000-0000000000b0', 'member')
-- ON CONFLICT (user_id, org_id) DO NOTHING;
