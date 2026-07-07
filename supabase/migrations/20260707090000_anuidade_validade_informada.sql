-- A validade da anuidade não é mais calculada (31/01 do ano seguinte) — o
-- consultor informa a data de validade real no pop-up de lançamento, junto do
-- comprovante. `data_pagamento` deixa de ser útil isoladamente e vira a
-- própria data de validade.
ALTER TABLE public.employee_crea_anuidades RENAME COLUMN data_pagamento TO validade_ate;
