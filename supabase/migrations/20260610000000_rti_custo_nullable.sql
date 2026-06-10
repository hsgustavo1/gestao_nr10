-- RTI — custos passam a distinguir "não informado" (NULL) de "zero explícito" (0).
-- Antes: custo_planejado/custo_realizado eram NOT NULL DEFAULT 0, então não havia
-- como diferenciar uma NC sem custo informado de uma com custo realmente zero.
-- Depois: colunas nullable. NULL = não informado; 0 = custo zero (sem barreira p/ executar).

ALTER TABLE rti_ncs ALTER COLUMN custo_planejado DROP DEFAULT;
ALTER TABLE rti_ncs ALTER COLUMN custo_planejado DROP NOT NULL;
ALTER TABLE rti_ncs ALTER COLUMN custo_realizado DROP DEFAULT;
ALTER TABLE rti_ncs ALTER COLUMN custo_realizado DROP NOT NULL;

-- Dados existentes: os zeros atuais vieram do default/importação (nunca foram
-- informados explicitamente), então convertem-se para NULL = não informado.
UPDATE rti_ncs SET custo_planejado = NULL WHERE custo_planejado = 0;
UPDATE rti_ncs SET custo_realizado = NULL WHERE custo_realizado = 0;
