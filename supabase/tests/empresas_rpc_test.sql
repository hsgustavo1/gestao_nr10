-- ============================================================================
-- Teste de autorização das RPCs de gestão de empresas + regressão de desativação
-- ----------------------------------------------------------------------------
-- Roda via MCP (execute_sql) ou no SQL Editor. Cole os 5 UUIDs reais abaixo e
-- execute TODO o script de uma vez. Retorna 1 tabela; coluna `passou` = true
-- significa que a RPC se comportou como esperado.
--
-- Pré-requisitos (seed 20260614020000 — Consultoria Demo / Cliente Demo A):
--   pa        = platform admin (linha em platform_admins)
--   cons      = usuário admin+ (org_role>=admin) NA consultoria `consorg`
--   cliA      = usuário admin (org_role='admin') no cliente `cliA_org`
--   consorg   = id da consultoria que GERENCIA cliA_org (managed_by_org_id)
--   cliA_org  = id de um cliente gerido por consorg
--
-- RESULTADO ESPERADO: todas as linhas com passou = true.
-- ============================================================================

CREATE TEMP TABLE _r(cenario text, esperado text, obtido text, passou boolean) ON COMMIT DROP;

DO $$
DECLARE
  pa       uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  cons     uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  cliA     uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  consorg  uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  cliA_org uuid := '00000000-0000-0000-0000-000000000000';  -- <<< EDITE
  v uuid;
BEGIN
  -- 1. platform admin cria consultoria -> sucesso
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pa)::text, true);
  BEGIN
    v := public.fn_create_org('Teste Cons (apagar)', 'consultoria', NULL, NULL, ARRAY['rti_pwa']);
    DELETE FROM public.organizations WHERE id = v;  -- limpa
    INSERT INTO _r VALUES ('1 PA cria consultoria', 'sucesso', 'sucesso', true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('1 PA cria consultoria', 'sucesso', 'erro: ' || SQLERRM, false);
  END;

  -- 2. consultor NÃO cria empresa -> exceção
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cons)::text, true);
  BEGIN
    v := public.fn_create_org('Hack', 'cliente', consorg, NULL, ARRAY['rti_pwa']);
    DELETE FROM public.organizations WHERE id = v;
    INSERT INTO _r VALUES ('2 consultor cria empresa', 'erro', 'sucesso (FURO!)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('2 consultor cria empresa', 'erro', 'erro: ' || SQLERRM, true);
  END;

  -- 3. consultor edita nome do cliente gerido -> sucesso
  BEGIN
    PERFORM public.fn_update_org(cliA_org, 'Cliente A (renomeado pelo teste)', NULL, NULL);
    INSERT INTO _r VALUES ('3 consultor edita cliente gerido', 'sucesso', 'sucesso', true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('3 consultor edita cliente gerido', 'sucesso', 'erro: ' || SQLERRM, false);
  END;

  -- 4. consultor NÃO altera entitlements -> exceção
  BEGIN
    PERFORM public.fn_set_org_entitlements(cliA_org, ARRAY['loto']);
    INSERT INTO _r VALUES ('4 consultor altera entitlements', 'erro', 'sucesso (FURO!)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('4 consultor altera entitlements', 'erro', 'erro: ' || SQLERRM, true);
  END;

  -- 5. consultor NÃO desativa -> exceção
  BEGIN
    PERFORM public.fn_set_org_active(cliA_org, false);
    INSERT INTO _r VALUES ('5 consultor desativa empresa', 'erro', 'sucesso (FURO!)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('5 consultor desativa empresa', 'erro', 'erro: ' || SQLERRM, true);
  END;

  -- 6. admin do próprio cliente (não consultor) NÃO edita a org -> exceção
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cliA)::text, true);
  BEGIN
    PERFORM public.fn_update_org(cliA_org, 'Hack pelo cliente', NULL, NULL);
    INSERT INTO _r VALUES ('6 admin-cliente edita própria org', 'erro', 'sucesso (FURO!)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('6 admin-cliente edita própria org', 'erro', 'erro: ' || SQLERRM, true);
  END;

  -- 7. regressão: cliente desativado some para o membro, persiste p/ platform admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pa)::text, true);
  PERFORM public.fn_set_org_active(cliA_org, false);
  INSERT INTO _r VALUES (
    '7a desativado: membro perde acesso', 'false',
    public.can_access_org(cliA, cliA_org)::text,
    public.can_access_org(cliA, cliA_org) = false
  );
  INSERT INTO _r VALUES (
    '7b desativado: platform admin mantém', 'true',
    public.can_access_org(pa, cliA_org)::text,
    public.can_access_org(pa, cliA_org) = true
  );
  PERFORM public.fn_set_org_active(cliA_org, true);  -- restaura

  -- 8. consultor NÃO exclui empresa -> exceção
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cons)::text, true);
  BEGIN
    PERFORM public.fn_delete_org(cliA_org);
    INSERT INTO _r VALUES ('8 consultor exclui empresa', 'erro', 'sucesso (FURO!)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('8 consultor exclui empresa', 'erro', 'erro: ' || SQLERRM, true);
  END;

  -- 9. platform admin NÃO exclui consultoria com cliente gerido -> bloqueio de órfão
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pa)::text, true);
  BEGIN
    PERFORM public.fn_delete_org(consorg);
    INSERT INTO _r VALUES ('9 PA exclui consultoria c/ cliente', 'erro', 'sucesso (FURO!)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('9 PA exclui consultoria c/ cliente', 'erro', 'erro: ' || SQLERRM, true);
  END;

  -- 10. platform admin exclui org-folha de teste -> sucesso (e some)
  BEGIN
    v := public.fn_create_org('Del Test (apagar)', 'consultoria', NULL, NULL, ARRAY['loto']);
    PERFORM public.fn_delete_org(v);
    INSERT INTO _r VALUES (
      '10 PA exclui org-folha', 'sucesso',
      CASE WHEN EXISTS (SELECT 1 FROM public.organizations WHERE id = v)
           THEN 'ainda existe (FURO!)' ELSE 'sucesso' END,
      NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _r VALUES ('10 PA exclui org-folha', 'sucesso', 'erro: ' || SQLERRM, false);
  END;
END $$;

SELECT * FROM _r ORDER BY cenario;
