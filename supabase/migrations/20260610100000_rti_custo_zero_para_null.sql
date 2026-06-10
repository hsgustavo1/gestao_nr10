-- Correção de dados: os custos importados da planilha como 0 representam, na
-- realidade, "custo não informado" — ninguém marcou zero explicitamente ainda.
-- Converte os zeros existentes em NULL (não informado). A partir daqui, 0 só
-- existirá quando alguém o informar de propósito (sem barreira p/ executar).

UPDATE rti_ncs SET custo_planejado = NULL WHERE custo_planejado = 0;
UPDATE rti_ncs SET custo_realizado = NULL WHERE custo_realizado = 0;
