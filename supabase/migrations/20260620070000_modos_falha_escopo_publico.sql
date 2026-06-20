-- Modelo de propagação do catálogo de modos de falha (Opção A — robusta).
--
-- Conceitos:
--   • organizations.is_root  → a "dona do app" (Empresa Principal). Única.
--   • rti_modos_falha.publico → modo disponível para TODAS as empresas.
--   • org_id agora é NOT NULL  → todo modo tem procedência (quem o criou).
--
-- Regras de propagação (visibilidade):
--   A. Modo da raiz com publico=true  → visível para todas as empresas.
--   B. Modo de uma consultoria        → visível para a consultoria + clientes
--                                        que ela gere (via managed_by_org_id).
--   C. Modo de uma empresa-filha       → visível só para ela.
--   D. Nível acima pode alterar/excluir os modos do nível abaixo
--      (consultoria sobre seus clientes; platform admin sobre tudo).
--   E. platform_admin (dona do app)   → vê, cria, edita e exclui qualquer modo.
--
-- Antes: "global" era org_id IS NULL (sem dono, sem rastreabilidade) e a
-- Empresa Principal era apenas uma 'cliente' solta — modos criados nela não
-- propagavam para ninguém. Esta migração corrige a raiz do problema.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. organizations.is_root — marca a Empresa Principal como dona do app
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_root boolean NOT NULL DEFAULT false;

UPDATE public.organizations
   SET is_root = true
 WHERE id = '00000000-0000-0000-0000-000000000001';

-- Garante que exista no máximo UMA raiz.
CREATE UNIQUE INDEX IF NOT EXISTS organizations_one_root
  ON public.organizations (is_root)
  WHERE is_root;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. rti_modos_falha.publico + backfill de procedência
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rti_modos_falha
  ADD COLUMN IF NOT EXISTS publico boolean NOT NULL DEFAULT false;

-- Globais legados (org_id IS NULL) viram modos públicos da raiz (procedência).
UPDATE public.rti_modos_falha
   SET publico = true,
       org_id  = '00000000-0000-0000-0000-000000000001'
 WHERE org_id IS NULL;

-- A partir daqui, todo modo tem dono.
ALTER TABLE public.rti_modos_falha
  ALTER COLUMN org_id SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helpers de autorização (SECURITY DEFINER, STABLE)
-- ─────────────────────────────────────────────────────────────────────────────

-- Pode escrever (criar/editar/excluir) um modo de um determinado org?
--   • platform admin (dona do app) → qualquer org
--   • membro da própria org com papel adequado
--   • consultoria que GERE a org do modo (nível acima edita abaixo)
CREATE OR REPLACE FUNCTION public.can_write_modo_falha(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations   o ON o.id = om.org_id
       WHERE om.user_id = auth.uid()
         AND om.org_id  = _org_id
         AND (
           (o.tipo = 'consultoria'          AND om.org_role IN ('member','admin','owner'))
           OR
           (o.tipo IN ('cliente','unidade') AND om.org_role IN ('admin','owner'))
         )
    )
    OR EXISTS (  -- consultoria que gere a org do modo (nível acima)
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations   modo_org ON modo_org.id = _org_id
       WHERE om.user_id = auth.uid()
         AND modo_org.managed_by_org_id = om.org_id
         AND om.org_role IN ('admin','owner')
    );
$$;

-- Pode marcar um modo como público (disponível para todas as empresas)?
--   Só a dona do app: platform admin ou admin/owner da org raiz.
CREATE OR REPLACE FUNCTION public.can_publish_modo_falha()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations   o ON o.id = om.org_id
       WHERE om.user_id = auth.uid()
         AND o.is_root
         AND om.org_role IN ('admin','owner')
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Policies
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "modos_select" ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_insert" ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_update" ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_delete" ON public.rti_modos_falha;

CREATE POLICY "modos_select" ON public.rti_modos_falha FOR SELECT
  USING (
    -- E. dona do app vê tudo
    public.is_platform_admin(auth.uid())

    -- A. modo público — visível para todas as empresas
    OR publico = true

    -- membro direto da org que criou o modo
    OR EXISTS (
      SELECT 1 FROM public.org_memberships
       WHERE user_id = auth.uid()
         AND org_id  = rti_modos_falha.org_id
    )

    -- B. cliente herda os modos da consultoria que o gere
    OR EXISTS (
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations   myorg ON myorg.id = om.org_id
       WHERE om.user_id = auth.uid()
         AND myorg.managed_by_org_id = rti_modos_falha.org_id
    )

    -- consultoria enxerga o catálogo dos clientes que gere
    OR EXISTS (
      SELECT 1
        FROM public.org_memberships om
        JOIN public.organizations   modo_org ON modo_org.id = rti_modos_falha.org_id
       WHERE om.user_id = auth.uid()
         AND modo_org.managed_by_org_id = om.org_id
    )
  );

CREATE POLICY "modos_insert" ON public.rti_modos_falha FOR INSERT
  WITH CHECK (
    public.can_write_modo_falha(org_id)
    AND (publico = false OR public.can_publish_modo_falha())
  );

CREATE POLICY "modos_update" ON public.rti_modos_falha FOR UPDATE
  USING (public.can_write_modo_falha(org_id))
  WITH CHECK (
    public.can_write_modo_falha(org_id)
    AND (publico = false OR public.can_publish_modo_falha())
  );

CREATE POLICY "modos_delete" ON public.rti_modos_falha FOR DELETE
  USING (public.can_write_modo_falha(org_id));
