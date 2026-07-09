-- ============================================================================
-- Trilha A — Curadoria de Padrões (2026-07-09)
-- estrutura_modelos: modelos de árvore Setor→Ativo→Componente por segmento,
-- curados pelo platform admin. Regra dura: nenhum conteúdo de uma org é sugerido
-- a outra sem passar pela curadoria da raiz (spec §3). Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.estrutura_modelos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  segmento           text NOT NULL,
  descricao          text,
  arvore             jsonb NOT NULL,   -- [{nome, filhos:[{nome, filhos:[{nome}]}]}] — snapshot, sem ids
  publicado          boolean NOT NULL DEFAULT false,
  -- rastreabilidade interna da curadoria; o RLS de field_inspections impede
  -- não-admins de resolverem este id para dados do cliente de origem.
  origem_inspecao_id uuid REFERENCES public.field_inspections(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estrutura_modelos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_estrutura_modelos_segmento ON public.estrutura_modelos(segmento);

DROP TRIGGER IF EXISTS estrutura_modelos_touch ON public.estrutura_modelos;
CREATE TRIGGER estrutura_modelos_touch
  BEFORE UPDATE ON public.estrutura_modelos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Publicados: qualquer autenticado lê. Rascunhos e escrita: só platform admin.
DROP POLICY IF EXISTS "estrutura_modelos_select" ON public.estrutura_modelos;
CREATE POLICY "estrutura_modelos_select" ON public.estrutura_modelos FOR SELECT
  USING (publicado OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "estrutura_modelos_admin_write" ON public.estrutura_modelos;
CREATE POLICY "estrutura_modelos_admin_write" ON public.estrutura_modelos FOR ALL
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Segmento na inspeção (agrupa no painel e dispara a sugestão de modelo).
ALTER TABLE public.field_inspections
  ADD COLUMN IF NOT EXISTS segmento text;
