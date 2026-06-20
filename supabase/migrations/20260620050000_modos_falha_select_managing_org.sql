-- Adiciona 4º ramo à policy SELECT de rti_modos_falha:
-- org gestora (consultoria) pode ver modos criados pelos seus clientes.
--
-- Ramo 3 original: cliente herda modos da consultoria que o gere.
-- Ramo 4 novo: consultoria pode ver modos criados por um cliente gerido por ela.
-- Sem este ramo, o consultor que troca o switcher para um cliente fica cego
-- ao catálogo criado pelo ADM daquele cliente (RLS bloqueava silenciosamente).

DROP POLICY IF EXISTS "modos_select" ON public.rti_modos_falha;

CREATE POLICY "modos_select" ON public.rti_modos_falha FOR SELECT
  USING (
    -- 1. Modo global (dono do app) — visível para todos
    org_id IS NULL

    -- 2. Sou membro direto da org que criou o modo
    OR EXISTS (
      SELECT 1 FROM public.org_memberships
       WHERE user_id = auth.uid()
         AND org_id  = rti_modos_falha.org_id
    )

    -- 3. Sou cliente: minha org é gerida pela org que criou o modo
    --    (herdo os modos da consultoria que me gere — propagação top-down)
    OR EXISTS (
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations   myorg ON myorg.id = om.org_id
       WHERE om.user_id              = auth.uid()
         AND myorg.managed_by_org_id = rti_modos_falha.org_id
    )

    -- 4. Sou consultoria: a org que criou o modo é gerida por mim
    --    (ao acessar o cliente no switcher, o consultor enxerga o catálogo dele)
    OR EXISTS (
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations   modo_org ON modo_org.id = rti_modos_falha.org_id
       WHERE om.user_id              = auth.uid()
         AND modo_org.managed_by_org_id = om.org_id
    )
  );
