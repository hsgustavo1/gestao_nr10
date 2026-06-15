-- ============================================================================
-- Fase 2 — Teste de isolamento multi-tenant (RLS)
-- ----------------------------------------------------------------------------
-- Roda 100% no SQL Editor da WEB do Supabase. Cole os 4 UUIDs reais no bloco
-- VALUES abaixo e execute — retorna UMA tabela com 1 linha por usuário.
--
-- Como funciona: as políticas de RLS de todas as tabelas chamam por baixo as
-- funções `can_access_org` e `org_role_at_least`. Testá-las diretamente (com o
-- uid de cada usuário) prova o isolamento sem precisar logar como cada um.
--
-- Pré-requisitos:
--   1. Migrações aplicadas: 20260614000000, 20260614010000, 20260614020000.
--   2. Usuários de teste criados e vinculados às orgs (ver seed
--      20260614020000 — criar via edge function admin-users com org_id, ou pelo
--      dashboard + INSERT manual em org_memberships).
--
-- RESULTADO ESPERADO (t = true, f = false):
--   usuario        le_A   le_B   le_consultoria   escreve_A
--   1-consultor     t      f          t              t      (revenda: vê/edita A, NÃO vê B)
--   2-cliente_a     t      f          f              t      (só a própria org)
--   3-cliente_b     f      t          f              f      (só a própria org)
--   4-plat_admin    t      t          t              t      (cross-tenant)
--
-- Qualquer desvio = falha de isolamento. (Se um cliente aparecer com le do outro
-- cliente = true, o RLS está furado.)
-- ============================================================================

WITH ids(usuario, uid) AS (
  VALUES
    -- >>> EDITE AQUI: cole os 4 UUIDs reais (auth.users.id) <<<
    ('1-consultor'::text,  '00000000-0000-0000-0000-000000000000'::uuid),
    ('2-cliente_a',        '00000000-0000-0000-0000-000000000000'::uuid),
    ('3-cliente_b',        '00000000-0000-0000-0000-000000000000'::uuid),
    ('4-plat_admin',       '00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
  usuario,
  public.can_access_org(uid, '00000000-0000-0000-0000-0000000000a0') AS le_A,
  public.can_access_org(uid, '00000000-0000-0000-0000-0000000000b0') AS le_B,
  public.can_access_org(uid, '00000000-0000-0000-0000-0000000000c0') AS le_consultoria,
  public.org_role_at_least(uid, '00000000-0000-0000-0000-0000000000a0', 'member') AS escreve_A,
  public.is_platform_admin(uid) AS eh_plat_admin
FROM ids
ORDER BY usuario;

-- ----------------------------------------------------------------------------
-- (Opcional) Prova end-to-end definitiva: faça LOGIN no app/PWA como cada
-- usuário e confira que cada um só enxerga as inspeções/RTIs da própria org.
-- O teste acima valida a lógica; o login valida o sistema inteiro.
-- ----------------------------------------------------------------------------
