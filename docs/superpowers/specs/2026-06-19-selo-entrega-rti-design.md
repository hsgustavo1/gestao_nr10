# Selo de Entrega — controle de acesso por provença (RTI, extensível a LOTO)

**Data:** 2026-06-19
**Status:** Aprovado (design) — pronto para plano de implementação
**Escopo desta fatia:** RTI. O mecanismo é genérico; só o RTI é registrado agora.

## Problema

Quando o dono do app ou um consultor entrega um RTI pronto a um cliente, o
administrador desse cliente hoje consegue editar **tudo** — inclusive o registro
técnico do trabalho feito em campo. Isso permite adulterar o relatório recebido
(omitir criticidade, apagar não conformidades, trocar recomendações/evidências).

Precisamos de um nível de autorização **intermediário** entre "admin que muda
tudo" e "visualizador que só lê": um administrador do cliente que faz a **gestão
de rotina** (prazos, custos, andamento, evidências de execução, criar ações
novas) mas **não pode adulterar o registro técnico entregue**.

A solução não pode ser específica de RTI: o mesmo padrão precisa servir o módulo
LOTO existente e módulos futuros (um procedimento LOTO entregue a um cliente tem
a mesma forma — o cliente executa, mas não altera o procedimento).

## Princípio: três camadas ortogonais

| Camada | Pergunta | Status |
|---|---|---|
| **1. Rank** | Quem você é nesta org? | ✅ Existe — `org_role` + `can_access_org` |
| **2. Entitlement** | A org tem este módulo? | ✅ Existe — `org_entitlements` |
| **3. Selo de entrega** | Este registro veio "de cima" e está congelado? | 🆕 Esta fatia |

A camada 3 é **module-agnostic**. Não é uma regra de RTI — é uma propriedade de
qualquer artefato entregue de uma org para outra abaixo dela.

## A. Modelo de papéis

`org_role` passa a usar 3 níveis no cliente (o `member` legado é aposentado da
UI; valores legados continuam válidos no banco e normalizam para o nível mais
próximo no seletor):

| Nível (nome de negócio) | `org_role` | Bypassa o selo? |
|---|---|---|
| Visualizador | `viewer` | — (só lê) |
| Admin padrão | `admin` | ❌ sujeito ao selo |
| Admin geral | `owner` | ✅ ignora o selo |

- Consultor e dono do app ficam **acima** da org (cadeia de gestão via
  `managed_by` / `platform_admin`) e **sempre** bypassam o selo.
- "Admin geral" (`owner`) existe por completude — o usuário declarou que não
  pretende usá-lo no dia a dia, mas o nível precisa existir.
- O seletor de nível em `admin.usuarios` cresce de 2 (admin/viewer) para 3
  opções (admin geral / admin padrão / visualizador).

### Controle de acesso (quem gerencia quem)

- **Dono do app** (`platform_admin`): gerencia todas as orgs e todos os acessos.
- **Consultor**: gerencia a própria org e as orgs sob sua gestão (`managed_by`),
  incluindo o controle de acesso dessas orgs.
- **Admin padrão** e **admin geral**: gerenciam o controle de acesso **da própria
  org** apenas.

## B. Camada "Selo de Entrega" (núcleo, genérico)

Três primitivas. Reusa a maquinaria de trigger declarativo já existente no
projeto (`fn_inherit_org_id`, alimentada por um array `rels[][]`).

### B1. Selo no nó-raiz

O nó-raiz de cada módulo ganha duas colunas:

- `entregue_em timestamptz NULL` — quando foi entregue (NULL = rascunho, editável).
- `entregue_por_org uuid NULL` — a org autora/entregadora (o consultor/dono).

Nesta fatia, o nó-raiz é `rti_reports`. (Roots futuros: `padlock_reports`,
`field_inspections`, etc.)

**Entregar** é uma operação única que:
1. carimba `entregue_em = now()` e `entregue_por_org = <org autora/entregadora>` no root;
2. **cascateia** `entregue_em` **e** `entregue_por_org` para os filhos existentes
   (áreas, NCs, evidências) no momento da entrega.

Os filhos protegidos carregam suas próprias colunas `entregue_em` +
`entregue_por_org`, para que `fn_enforce_seal()` seja **auto-contido por linha**
(não precisa subir até o root para decidir).

### B2. Registro declarativo de política

Uma tabela de configuração, uma linha por tabela protegida:

```
seal_policy(
  table_name        text,
  frozen_columns    text[],     -- colunas congeladas quando a linha está entregue
  allow_delete      boolean,    -- pode apagar linha entregue?
  row_filter        text NULL   -- opcional: só congela linhas que casam (ex.: tipo='constatacao')
)
```

É o **único** ponto que muda quando um módulo novo entra. LOTO = adicionar linhas
aqui, sem trigger novo.

### B3. Um trigger de enforcement

`fn_enforce_seal()` em BEFORE UPDATE/DELETE de cada tabela protegida:

- Se a linha tem `entregue_em IS NOT NULL` **e** o ator **não** bypassa o selo:
  - UPDATE: rejeita se qualquer `frozen_column` mudou (compara OLD/NEW);
  - DELETE: rejeita se `allow_delete = false`.
- Caso contrário, permite.

### B4. Provença por linha (regra-chave)

Depois do relatório entregue, registros-filho novos precisam saber se nascem
congelados:

- Inseridos pelo **lado autor** (consultor/dono/owner) → nascem com
  `entregue_em = now()` (congelados — é continuação do trabalho técnico).
- Inseridos pelo **admin padrão do cliente** → `entregue_em` fica NULL (conteúdo
  do cliente, totalmente editável e apagável por ele).

Decidido por trigger no INSERT, usando o mesmo predicado de bypass.

### B5. Predicado de bypass (fonte única da verdade)

`fn_can_bypass_seal(uid uuid, row_org uuid, entregue_por_org uuid) → boolean`,
`SECURITY DEFINER`. Retorna `true` se o usuário:

- é `platform_admin` (dono); **ou**
- pertence a `entregue_por_org` ou a uma org que a gerencia (consultor autor); **ou**
- tem rank `owner` (admin geral) na org da linha (`row_org`).

Consumido **tanto** pela RLS/trigger **quanto** pela UI — banco e front falam a
mesma língua.

## C. Política de congelamento do RTI

| Tabela | 🔒 Congelado quando entregue | ✅ Livre (rotina) | `allow_delete` / `row_filter` |
|---|---|---|---|
| `rti_ncs` | `descricao`, `prioridade` (criticidade), `recomendacao`, `area_id`, `numero`, `finding_id` | `prazo`, `custo_planejado`, `custo_realizado`, `status`, `progresso`, `situacao_atual`, `responsavel`, `tipo_execucao`, `os_numero`, `concluida_em` | `allow_delete = false` |
| `rti_nc_evidencias` | linhas `tipo='constatacao'` (não edita/apaga) | linhas `tipo='correcao'` (adiciona/edita/apaga à vontade) | `allow_delete = false`, `row_filter = tipo='constatacao'` |
| `rti_areas` | renomear/apagar área entregue | criar nova área (para NCs próprias) | `allow_delete = false` |

Notas:
- Áreas **entregues** ficam congeladas (estrutura técnica), mas o cliente pode
  **criar áreas novas** para as ações dele (confirmado pelo usuário).
- NC criada pelo cliente após a entrega (não congelada) pode ser apagada por ele.
- A NC mistura hoje campos técnicos e operacionais na mesma linha — por isso a
  granularidade é por coluna (Opção 1). Se um módulo precisar de separação total
  Registro × Execução no futuro, o conceito de selo não muda.

## D. Superfície de UI

- **Botão "Entregar relatório"** — visível só para quem bypassa o selo
  (consultor/dono/owner) e só enquanto `entregue_em IS NULL`. Dialog de
  confirmação explicando o efeito (após entregar, o cliente não altera o registro
  técnico).
- Relatório entregue exibe **badge "Entregue em DD/MM/AAAA"**.
- Para admin padrão num relatório entregue:
  - campos congelados → **read-only** (input desabilitado; sem botão de excluir na
    NC entregue) com tooltip "Registro entregue pelo consultor — somente leitura";
  - campos de rotina e "adicionar evidência de correção" → seguem ativos.
- `getRtiCampoAccess(ctx)` generaliza para
  `getRecordAccess(ctx, record) → { canView, canEditOperacional, canEditTecnico, canEntregar, canDelete }`.
  A UI usa `fn_can_bypass_seal` (ou seu espelho em TS no auth-context) + o estado
  `entregue_em` do registro.

## E. Enforcement + auditoria

- **Dois níveis, obrigatório.** A UI esconde/desabilita **e** o trigger no banco
  recusa. O objetivo é anti-adulteração — UI sozinha não basta (um cliente
  determinado bate direto na API).
- **Auditoria de mutação pós-entrega:** fica a cargo do log do app
  (`logBulkHistorico`), que registra em `rti_nc_historico` (tipo `alteracao`) as
  alterações com detalhe e autor. _Decisão 2026-06-19:_ o trigger de auditoria
  no banco foi descartado para não duplicar entradas no histórico da NC (o
  enforcement no banco continua sendo a barreira anti-adulteração).

## Fora de escopo (YAGNI)

- Não construímos código LOTO agora — LOTO só entra como linhas em `seal_policy`
  quando a entrega de LOTO for de fato implementada.
- Não fazemos a refatoração Registro × Execução (Opção 2). Fica como caminho
  aberto, não pago agora.
- "Reabrir/desentregar" um relatório: não há requisito. Consultor/dono editam
  livremente mesmo após a entrega (bypassam), então não é necessário um estado de
  reabertura.

## Invariantes / threat model

- Admin padrão do cliente **nunca** altera `frozen_columns` nem apaga registros
  entregues — garantido no banco, não só na UI.
- O selo respeita o invariante de `org_id` já existente (filho acompanha a org do
  pai). `entregue_por_org` é **independente** de `org_id`: `org_id` = org do
  cliente dono do relatório; `entregue_por_org` = org do consultor que entregou.
- Convenção do projeto: migrations aplicadas **manualmente** no SQL Editor;
  `types.ts` atualizado à mão.
