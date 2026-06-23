-- Expande o CHECK constraint da tabela org_entitlements para aceitar os novos módulos.
ALTER TABLE public.org_entitlements
  DROP CONSTRAINT org_entitlements_module_check,
  ADD CONSTRAINT org_entitlements_module_check
    CHECK (module = ANY (ARRAY['gestao_completa', 'rti_pwa', 'loto', 'rti', 'campo_pwa', 'pessoas']));
