-- ============================================================================
-- Teste de visibilidade por entrega (inspeção/RTI) — matriz de leitura
-- ----------------------------------------------------------------------------
-- Roda via MCP (execute_sql) ou no SQL Editor. Cole os UUIDs reais abaixo e
-- execute TODO o script. Retorna 1 tabela; `passou = true` = comportou como
-- esperado. Testa o predicado real da policy de SELECT:
--   can_access_org(uid, org) AND fn_delivery_visible(uid, org, created_by, entregue)
--
-- Pré-requisitos (seed 20260614020000 — Consultoria Demo / Cliente Demo A/B):
--   cons     = usuário da consultoria que GERENCIA cliA_org
--   cliA     = usuário membro (qualquer papel) de cliA_org
--   cliB     = usuário membro de outra org (cliB_org), NÃO gerida pela consultoria
--   pa       = platform admin
--   cliA_org = id do cliente gerido pela consultoria
--   consorg  = id da consultoria (procedência das inspeções "do consultor")
--
-- RESULTADO ESPERADO: todas as linhas com passou = true.
-- ============================================================================

CREATE TEMP TABLE _r(cenario text, esperado boolean, obtido boolean, passou boolean) ON COMMIT DROP;

DO $$
DECLARE
  cons     uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  cliA     uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  cliB     uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  pa       uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  cliA_org uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  consorg  uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  ts timestamptz := now();
BEGIN
  -- Helper inline: avalia o predicado da policy para um viewer + cenário no cliA_org.
  -- (created_by = consorg → "feito pelo consultor"; = cliA_org → "feito pelo cliente")

  -- Consultor (gestor): vê tudo, inclusive rascunho do próprio consultor.
  INSERT INTO _r SELECT 'consultor vê rascunho do consultor', true,
    can_access_org(cons, cliA_org) AND fn_delivery_visible(cons, cliA_org, consorg, NULL),
    (can_access_org(cons, cliA_org) AND fn_delivery_visible(cons, cliA_org, consorg, NULL)) = true;

  -- Cliente A: NÃO vê inspeção do consultor não entregue.
  INSERT INTO _r SELECT 'cliente A NÃO vê rascunho do consultor', false,
    can_access_org(cliA, cliA_org) AND fn_delivery_visible(cliA, cliA_org, consorg, NULL),
    (can_access_org(cliA, cliA_org) AND fn_delivery_visible(cliA, cliA_org, consorg, NULL)) = false;

  -- Cliente A: vê o que a própria org criou (mesmo sem entrega).
  INSERT INTO _r SELECT 'cliente A vê o que ele mesmo criou', true,
    can_access_org(cliA, cliA_org) AND fn_delivery_visible(cliA, cliA_org, cliA_org, NULL),
    (can_access_org(cliA, cliA_org) AND fn_delivery_visible(cliA, cliA_org, cliA_org, NULL)) = true;

  -- Cliente A: vê inspeção do consultor APÓS entrega.
  INSERT INTO _r SELECT 'cliente A vê inspeção do consultor entregue', true,
    can_access_org(cliA, cliA_org) AND fn_delivery_visible(cliA, cliA_org, consorg, ts),
    (can_access_org(cliA, cliA_org) AND fn_delivery_visible(cliA, cliA_org, consorg, ts)) = true;

  -- Cliente B: isolado — não vê nada do cliA_org (nem entregue).
  INSERT INTO _r SELECT 'cliente B isolado (mesmo entregue)', false,
    can_access_org(cliB, cliA_org) AND fn_delivery_visible(cliB, cliA_org, consorg, ts),
    (can_access_org(cliB, cliA_org) AND fn_delivery_visible(cliB, cliA_org, consorg, ts)) = false;

  -- Platform admin: vê tudo, inclusive rascunho.
  INSERT INTO _r SELECT 'platform admin vê rascunho', true,
    can_access_org(pa, cliA_org) AND fn_delivery_visible(pa, cliA_org, consorg, NULL),
    (can_access_org(pa, cliA_org) AND fn_delivery_visible(pa, cliA_org, consorg, NULL)) = true;
END $$;

SELECT cenario, esperado, obtido, passou FROM _r ORDER BY cenario;
