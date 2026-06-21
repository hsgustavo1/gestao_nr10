# Visibilidade por entrega — inspeções e RTI só aparecem ao cliente após entregues

**Data:** 2026-06-20
**Status:** ✅ Implementado (migration `20260620100000`, aplicada via MCP; teste
6/6 verde). Decisão de implementação: filhos gateados por funções `SECURITY
DEFINER` que resolvem a raiz (não denormalização de colunas) — superfície menor.
**Escopo:** `field_inspections` e `rti_reports` (+ filhos). Mecanismo genérico,
mesmo espírito do [Selo de Entrega](2026-06-19-selo-entrega-rti-design.md).

## Problema

Quando o **consultor** ou o **dono do app** cria uma inspeção/relatório para um
cliente, hoje o cliente passa a vê-lo **imediatamente** (a RLS só filtra por
`org_id`, e a inspeção já nasce com `org_id` = cliente). Isso vaza trabalho em
rascunho: o cliente vê constatações antes do consultor revisar e **entregar**.

Regra de negócio desejada:

- Inspeção/relatório **criado pela própria org do cliente** (técnico do cliente
  no PWA) → **visível na hora** (é trabalho dele).
- Inspeção/relatório **criado pelo consultor ou dono do app** → **invisível ao
  cliente até ser entregue**.
- Consultor e dono do app (os autores) **sempre veem** — inclusive rascunhos.

## Princípio

Duas dimensões ortogonais decidem a visibilidade. Nenhuma é inferível da outra:

| Dimensão | Coluna | Já existe? |
|---|---|---|
| **Procedência** — qual org criou | `created_by_org_id` | 🆕 esta fatia |
| **Estado de entrega** — já foi entregue? | `entregue_em` | ✅ no RTI (Selo); 🆕 na inspeção |

O **Selo de Entrega** (2026-06-19) já controla **edição** pós-entrega via
`entregue_em` + `seal_policy` + `fn_enforce_seal`. Esta fatia adiciona a faceta
que falta: **leitura** condicionada por entrega + procedência. Mesmo `entregue_em`,
nova policy de SELECT. **Não** se cria máquina de estado nova.

## A. Procedência confiável (`created_by_org_id`)

Coluna `uuid NULL` em `field_inspections` e `rti_reports`. **Server-set por
trigger** `BEFORE INSERT` — nunca confiada do cliente (anti-spoofing):

```
NEW.created_by_org_id := fn_creator_org(auth.uid())   -- sobrescreve sempre
```

`fn_creator_org(_uid) → uuid` (`SECURITY DEFINER`, STABLE): a org de membership do
usuário. Resultado por perfil:

| Quem cria | `org_id` da raiz | `created_by_org_id` | Cliente vê antes da entrega? |
|---|---|---|---|
| Técnico do cliente A (PWA) | A | A | ✅ sim (própria org) |
| Consultor (PWA, drill-down → A) | A | consultoria | ❌ só após entrega |
| Dono do app (PA) | A | NULL | ❌ só após entrega |

A simetria `created_by_org_id = org_id` ⇔ "a própria org criou" é o coração da
regra. Para o consultor, `org_id` (=A, escolhido no drill-down) é
**propositalmente diferente** de `created_by_org_id` (=consultoria).

- **Multi-membership:** modelo atual é singular (consultor só na consultoria,
  cliente só na própria org). Se houver 2+, `fn_creator_org` escolhe
  deterministicamente (maior `org_role`, depois `org_id`). Aceitável — procedência
  é só "de onde veio", não decisão de segurança fina.
- **Backfill:** linhas existentes recebem `created_by_org_id = org_id` (assume-se
  trabalho próprio legado → permanece visível, sem regressão de acesso).

## B. Estado de entrega na inspeção

`field_inspections` ganha, espelhando o RTI:

- `entregue_em timestamptz NULL` — NULL = rascunho.
- `entregue_por_org uuid NULL` — org que entregou (o consultor/dono).

**Entregar inspeção** = RPC `fn_entregar_inspecao(inspection_id)` espelhando
[`fn_entregar_rti`](../../../supabase/migrations/20260619001000_seal_entregar_rpc.sql):
carimba `entregue_em = now()` + `entregue_por_org` no root. (Não precisa cascatear
para filhos para *visibilidade* — filhos herdam por EXISTS; ver D.)

Para o **RTI a entrega já existe** (`fn_entregar_rti`) — nada novo aqui, só
passar a usar `entregue_em` também na leitura (seção C).

## C. Visibilidade = uma policy de SELECT nas raízes

Predicado único, `SECURITY DEFINER`:

```
fn_can_view_entregavel(_uid, _row_org, _created_by_org, _entregue_em) → boolean
=
  fn_org_is_manager(_uid, _row_org)                 -- gestor acima da org: vê tudo
  OR (
       EXISTS (membership direta de _uid em _row_org) -- membro do próprio tenant
       AND (_created_by_org = _row_org               --   criado pela própria org
            OR _entregue_em IS NOT NULL)             --   ou já entregue
     )
```

`fn_org_is_manager(_uid, _row_org)` = `is_platform_admin(_uid)` **ou** membership
de `_uid` numa org que gerencia `_row_org` (`managed_by_org_id` / `parent_org_id`).
É o que separa o **gestor** (vê rascunhos) do **membro-cliente** (vê condicional) —
hoje ambos passam por `can_access_org`, que não distingue.

Policy de SELECT das raízes troca `USING (can_access_org(org_id))` por
`USING (fn_can_view_entregavel(auth.uid(), org_id, created_by_org_id, entregue_em))`.

## D. Cascata para os filhos

Filhos (`field_nodes/points/findings/photos`, `rti_areas/ncs/nc_evidencias/...`)
**não** ganham coluna nova. Visibilidade herda da raiz por `EXISTS`:

```
-- SELECT policy de field_nodes (idem demais filhos, trocando a coluna de junção):
USING (EXISTS (
  SELECT 1 FROM field_inspections i
  WHERE i.id = field_nodes.inspection_id
    AND fn_can_view_entregavel(auth.uid(), i.org_id, i.created_by_org_id, i.entregue_em)
))
```

Como `fn_can_view_entregavel` é `SECURITY DEFINER`, não há recursão de RLS — a
regra mora **num lugar só** (a raiz). Mesmo padrão de subquery que o projeto já
usa. (O `entregue_em` que o Selo pôs nos filhos é para *enforcement de edição*,
não para visibilidade — segue valendo, sem conflito.)

## E. Sync do PWA — nada a mudar

`downloadInspections` faz `supabase.from("field_inspections").select()`, que
**respeita a RLS**. Com a policy nova, o aparelho do cliente simplesmente **não
baixa** inspeções não entregues de outras orgs. O aparelho do consultor (gestor)
continua baixando os rascunhos dele. Zero código de sync novo. (Rascunho do
consultor vive no Dexie local dele independentemente; só não se propaga ao cliente
até a entrega.)

## F. Superfície de UI

- **Botão "Entregar ao cliente"** na inspeção (web e/ou PWA), visível só para
  gestor (`fn_org_is_manager` / espelho TS) e só enquanto `entregue_em IS NULL`.
  Dialog de confirmação ("após entregar, o cliente passa a ver esta inspeção").
- Inspeção entregue exibe badge **"Entregue em DD/MM/AAAA"** (igual ao RTI).
- Lista do cliente: itens não entregues simplesmente não aparecem (RLS) — sem
  estado vazio especial.
- RTI: reusa o botão "Entregar relatório" que já existe; só a visibilidade muda.

## Enforcement

**Dois níveis, como o Selo:** a barreira real é a **RLS** (cliente batendo direto
na API não vê o não entregue). A UI é conveniência. A leitura é a fronteira —
diferente do Selo, que protege escrita.

## Fora de escopo / riscos (YAGNI)

- **Hierarquia profunda (unidade):** `fn_org_is_manager` cobre 1 nível
  (`managed_by`/`parent`). Com unidades, um cliente-mãe veria rascunho de inspeção
  da unidade feita pelo consultor (tratado como gestor da unidade). Sem unidades
  cadastradas hoje (consistente com o risco já registrado no ROADMAP); revisitar
  quando unidades existirem.
- **Des-entregar:** sem requisito (igual ao Selo). Gestor edita/recolhe via
  acesso total; não há estado de "reabrir".
- **Granularidade de entrega parcial** (entregar só algumas NCs): não. Entrega é
  por raiz.
- **`arquivada_campo`:** ortogonal — arquivamento de campo não interage com
  visibilidade por entrega.

## Invariantes / threat model

- Cliente-membro **nunca** lê inspeção/RTI de procedência externa não entregue —
  garantido na RLS, não só na UI.
- `created_by_org_id` é **server-set e imutável** pós-insert (trigger sobrescreve
  qualquer valor enviado) — cliente não forja procedência.
- `created_by_org_id` (quem criou) é **independente** de `entregue_por_org` (quem
  entregou) e de `org_id` (dono do registro). Os três podem divergir.

## Convenções

- Migrations aplicadas via **MCP do Supabase** (`apply_migration`), arquivo `.sql`
  versionado em `supabase/migrations/`. `types.ts` à mão (ou wrapper não-tipado
  isolado, como em `auth-context`/`empresas-queries`).
- Teste de autz em `supabase/tests/` cobrindo a matriz: gestor vê rascunho;
  cliente vê próprio; cliente não vê externo-não-entregue; cliente vê
  externo-após-entrega.
