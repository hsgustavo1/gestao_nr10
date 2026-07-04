# Motor 1 — Pedra de Roseta NR-10 (prova de cobertura do motor de requisitos)

**Data:** 2026-07-03
**Status:** análise concluída — insumo para decisão go/no-go do Motor 1 (motor de requisitos configurável)
**Método:** enumeração exaustiva de todas as regras de conformidade hardcoded em `src/lib/{aptidao,qualificacoes,asos,epis,prontuario,vencimentos,conformidade,inspecoes,incidentes}.ts`, com proposta de representação em config e lista explícita do que **não** cabe no modelo tabular.

**Pergunta que este documento responde:** se criarmos uma tabela `compliance_requirements`, que fração das regras NR-10 atuais vira linha de tabela — e o que sobra como código?

**Resposta curta:** das **31 regras** enumeradas, **24 viram config pura** (77%), **4 viram config + um mecanismo genérico escrito uma vez** (avaliador de aplicabilidade, qualificador de evidência), e **3 permanecem código por natureza** (gatilhos por evento, integração cross-módulo, política de agregação do índice). Nenhuma exceção invalida o motor — todas se resolvem com 3 mecanismos genéricos reutilizáveis por qualquer NR futura.

---

## 1. Inventário completo de regras hardcoded

### A. Bloqueantes de aptidão (NR-10 §10.8) — `computeAptidao()`

| # | Regra | Fonte | Norma |
|---|---|---|---|
| A1 | Colaborador deve estar `ativo` (afastado/desligado bloqueia) | `aptidao.ts:94` | — |
| A2 | Deve existir autorização vigente (`is_current`) | `aptidao.ts:101` | 10.8.4 |
| A3 | Autorização não pode estar suspensa (decisão manual do PLH, independente das demais condições) | `aptidao.ts:103` | 10.8.4 |
| A4 | NR-10 Básico deve existir (formação **ou** reciclagem, vale a data mais recente) | `aptidao.ts:108-110`, `latestTrainingDate` `aptidao.ts:70-80` | 10.8.8 |
| A5 | NR-10 Básico não pode estar vencido (bienal) | `aptidao.ts:111` | 10.8.8 |
| A6 | SEP exigido conforme setor (hoje: todos os setores exigem; ver B2) | `aptidao.ts:118` | 10.8.8.3 |
| A7 | SEP não pode estar vencido (mesma bienal) | `aptidao.ts:122` | 10.8.8.3 |
| A8 | Áreas Classificadas é **informativa** — nunca bloqueia | `aptidao.ts:117` (comentário; ausência de check) | — |
| A9 | ASO deve existir | `aptidao.ts:129` | 10.8.7 |
| A10 | ASO não pode estar vencido | `aptidao.ts:130` | 10.8.7 |
| A11 | ASO deve ser `apto` **e** `apto_eletricidade = true` (inapto tem precedência sobre vencido) | `aptidao.ts:131`, `asos.ts:70` | 10.8.7 |
| A12 | Reciclagem extraordinária pendente bloqueia (flag manual; gatilhos: retorno de afastamento, mudança de função) | `aptidao.ts:134-136`, campos em `qualificacoes.ts:64-69` | 10.8.8.2 |

### B. Aplicabilidade condicional (quem deve o quê)

| # | Regra | Fonte |
|---|---|---|
| B1 | Setor GER não exige Áreas Classificadas (só Básico + SEP); demais setores exigem os 3 tipos | `qualificacoes.ts:26-29` |
| B2 | SEP exigido em **todos** os setores (consequência de B1: ambos os ramos incluem `sep`) | `qualificacoes.ts:26-29` + `aptidao.ts:118` |

### C. Periodicidade e vencimento

| # | Regra | Fonte |
|---|---|---|
| C1 | Treinamento NR-10: validade **2 anos** a partir da data | `qualificacoes.ts:176` (`addYears(…, 2)`) |
| C2 | Treinamento: aviso "vencendo" a **≤ 90 dias** | `qualificacoes.ts:179` |
| C3 | Formação é **perene** — nunca vence; quem vence é a reciclagem | `qualificacoes.ts:187-189` |
| C4 | Base do prazo bienal: última reciclagem; sem reciclagem, conta da formação | `qualificacoes.ts:196-203` — **duplicada** em `vencimentos.ts:116-123` |
| C5 | ASO: validade por data explícita (`validity_date` do exame); aviso a **≤ 60 dias** | `asos.ts:71-74` |
| C6 | IT: validade em **meses por instrução** (`validity_months`); default **24** se instrução ausente | `qualificacoes.ts:128`, `vencimentos.ts:142` |
| C7 | EPI: próximo ensaio = último ensaio **aprovado** + `test_interval_months` **do item**; aviso a **≤ 30 dias**; reprovado tem precedência sobre vencido | `epis.ts:68-90` |
| C8 | Documento do prontuário: validade por data explícita; sem data = perene; aviso a **≤ 90 dias** | `prontuario.ts:78-84` |
| C9 | Inspeção (RTI/Termografia/SPDA/Cercon): validade por data explícita do laudo | `inspecoes.ts:44`, `vencimentos.ts:172-183` |
| C10 | Horizonte do painel de vencimentos: **90 dias**; badge do sino: **30 dias** | `vencimentos.ts:79,275` |

### D. Completude documental (Prontuário — PIE)

| # | Regra | Fonte |
|---|---|---|
| D1 | 8 categorias exigidas, cada uma com referência normativa (10.2.3, 10.2.4 a–g); "outros" não conta | `prontuario.ts:5-47` |
| D2 | Categoria atendida = ≥ 1 documento **não vencido** na categoria | `prontuario.ts:110-112` |
| D3 | Categoria `qualificacao_trabalhadores` é auto-atendida (coberta pelo módulo Pessoas) | `prontuario.ts:53,106-108` |

### E. Agregação — índice de conformidade

| # | Regra | Fonte |
|---|---|---|
| E1 | "Em dia" para o índice inclui `expiring` (vencendo ainda conta a favor) | `conformidade.ts:123,161,170` |
| E2 | Universo do denominador: NR-10 Básico = **todos os ativos**; SEP/Áreas Class. = **só quem tem registro** | `conformidade.ts:119` |
| E3 | Autorizações: % de ativos com autorização não suspensa | `conformidade.ts:129-132` |
| E4 | Inspeções: % de laudos não vencidos por tipo; média simples entre tipos com dados | `conformidade.ts:138-154` |
| E5 | Incidentes: pesos por gravidade (sem_lesao/leve=1, moderada=2, grave=3, fatal=4); concluído conta a favor, aberto contra; sem incidentes = 100 | `conformidade.ts:22-47` |
| E6 | Índice global = **média simples** dos módulos com dados (módulo sem dados sai da conta) | `conformidade.ts:180-192` |
| E7 | `pct(x, 0) = 100` (universo vazio = conforme) | `conformidade.ts:53-56` |

### F. Catálogos (conteúdo puro — enums e labels)

Já são "dados disfarçados de código" — migram trivialmente para tabelas de catálogo:

- Tipos de treinamento + labels — `qualificacoes.ts:6-13`
- Níveis de autorização A0–A4 — `qualificacoes.ts:31-32`
- Setores (ELE/INS/GER/ADM) — `qualificacoes.ts:15-20`
- Tipos/resultados de ASO — `asos.ts:5-30`
- Tipos de EPI — `epis.ts:5-25`
- Categorias PIE + referências normativas — `prontuario.ts:5-42`
- Tipos de inspeção — `inspecoes.ts:3-18`
- Tipos/gravidades/status de incidente — `incidentes.ts:3-40`

---

## 2. Modelo proposto — DDL de `compliance_requirements`

Princípio: o requisito é **config**; a ocorrência (treinamento realizado, ASO emitido, ensaio feito) continua nas tabelas de evento existentes (`nr10_trainings`, `asos`, `epi_tests`, `it_trainings`, `nr10_documents`, `inspections`). O motor lê config + eventos e produz status. **Não** se mexe nas tabelas de evento na fase 1 — um adapter mapeia cada tabela existente para o formato genérico de "ocorrência".

```sql
-- Normas cadastradas na plataforma
create table norms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- 'NR-10', 'NR-35'
  title text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Requisitos de conformidade (o coração do Motor 1)
create table compliance_requirements (
  id uuid primary key default gen_random_uuid(),
  norm_id uuid not null references norms(id),
  code text not null,                  -- 'nr10_basico', 'sep', 'aso_eletricidade'
  norm_ref text,                       -- '10.8.8', '35.4.1.2' — exibido no laudo
  label text not null,
  target text not null
    check (target in ('pessoa', 'equipamento', 'documento', 'instalacao')),
  kind text not null
    check (kind in ('treinamento', 'exame_saude', 'autorizacao', 'ensaio',
                    'documento', 'flag_manual')),

  -- Validade / renovação
  validity_mode text not null
    check (validity_mode in ('fixa_meses',        -- validade fixa (NR-10: 24)
                             'por_item',           -- intervalo vive no item (EPI, IT)
                             'data_explicita',     -- data de validade vem do evento (ASO, laudo)
                             'perene')),           -- nunca vence (formação)
  validity_months int,                 -- quando fixa_meses
  renewal_base text
    check (renewal_base in ('ultima_ocorrencia',            -- max(data) qualquer categoria
                            'ultima_renovacao_ou_inicial')), -- reciclagem, senão formação
  warn_days int not null default 90,   -- janela "vencendo" (NR-10: 90; ASO: 60; EPI: 30)

  -- Bloqueio e denominador
  blocking boolean not null default true,     -- bloqueia aptidão? (Áreas Class.: false)
  universe_mode text not null default 'todos_alvos'
    check (universe_mode in ('todos_alvos',    -- denominador = todos os alvos ativos
                             'com_registro')), -- denominador = só quem tem ocorrência

  -- Aplicabilidade condicional (avaliada por mecanismo genérico — ver §4.M1)
  applicability jsonb not null default '{}'::jsonb,
    -- ex.: {"setor_not_in": ["GER"]}  → Áreas Classificadas
    -- ex.: {}                          → vale para todos

  -- Qualificador de evidência (avaliado por mecanismo genérico — ver §4.M2)
  evidence_qualifier jsonb,
    -- ex.: {"field": "apto_eletricidade", "equals": true,
    --       "fail_status": "inapto", "fail_precedence": true}  → ASO

  sort_order int not null default 0,
  active boolean not null default true,
  unique (norm_id, code)
);

-- Categorias documentais exigidas por norma (generaliza o checklist do PIE)
create table norm_document_categories (
  id uuid primary key default gen_random_uuid(),
  norm_id uuid not null references norms(id),
  code text not null,
  label text not null,
  norm_ref text,
  required boolean not null default true,
  covered_by_module text,   -- 'pessoas' → auto-atendida (exceção D3, ver §4)
  sort_order int not null default 0,
  unique (norm_id, code)
);
```

Sem `org_id` de propósito na fase 1: o catálogo de requisitos é **global da plataforma** (a NR-10 é a mesma para todo cliente). Customização por org (ex.: cliente que exige aviso a 120 dias) é fase futura — coluna `org_overrides` ou tabela satélite, decidir só quando houver demanda real.

---

## 3. A pedra de roseta — cada regra como linha de config

Seeds da NR-10 exatamente como o código se comporta hoje:

| Regra(s) | `code` | `kind` | `validity_mode` | `validity_months` | `renewal_base` | `warn_days` | `blocking` | `universe_mode` | `applicability` | `evidence_qualifier` |
|---|---|---|---|---|---|---|---|---|---|---|
| A4, A5, C1–C4, E2 | `nr10_basico` | treinamento | fixa_meses | 24 | ultima_renovacao_ou_inicial | 90 | true | todos_alvos | `{}` | — |
| A6, A7, B2, E2 | `sep` | treinamento | fixa_meses | 24 | ultima_renovacao_ou_inicial | 90 | true | com_registro | `{}` | — |
| A8, B1 | `areas_classificadas` | treinamento | fixa_meses | 24 | ultima_renovacao_ou_inicial | 90 | **false** | com_registro | `{"setor_not_in": ["GER"]}` | — |
| A9–A11, C5 | `aso_eletricidade` | exame_saude | data_explicita | — | ultima_ocorrencia | 60 | true | todos_alvos | `{}` | `{"field":"apto_eletricidade","equals":true,"fail_status":"inapto","fail_precedence":true}` + `{"field":"resultado","not_equals":"inapto",...}` |
| A2, E3 | `autorizacao_servico` | autorizacao | perene | — | ultima_ocorrencia | — | true | todos_alvos | `{}` | `{"field":"suspended","equals":false}` |
| C6 | `it_<code>` (uma por instrução) | treinamento | por_item | — | ultima_ocorrencia | 90 | false | com_registro | `{}` | — |
| C7 | `ensaio_epi` | ensaio | por_item | — | ultima_ocorrencia | 30 | true (para o EPI, não a pessoa) | com_registro | `{}` | `{"field":"result","equals":"aprovado","fail_status":"failed","fail_precedence":true}` |
| C8, C9, D1, D2 | 8 linhas em `norm_document_categories` + docs com `data_explicita` | documento | data_explicita | — | — | 90 | — | — | `{}` | — |
| A12 | `reciclagem_extraordinaria` | flag_manual | — | — | — | — | true | — | `{}` | — |
| A3 | `autorizacao_nao_suspensa` | flag_manual (embutido no qualifier de `autorizacao_servico`) | — | — | — | — | true | — | — | — |
| A1 | — (pré-condição do motor: só avalia alvo ativo) | — | — | — | — | — | — | — | — | — |

**Cobertura: 24 de 31 regras viram linha de config direta.** As demais, abaixo.

---

## 4. O que NÃO cabe — exceções e os 3 mecanismos genéricos

Esta é a parte que define o custo real do motor. Cada exceção com sua resolução:

### M1 — Avaliador de aplicabilidade (escrito 1×, serve toda NR)

- **B1/B2** (GER isento de Áreas Classificadas): a condição cabe no jsonb `applicability`, mas alguém precisa avaliá-lo. Solução: um avaliador genérico de predicados simples (`setor_in`, `setor_not_in`, `funcao_in`, futuro `cargo_in`) — ~50 linhas de TypeScript, testado isoladamente. Toda NR futura reutiliza (NR-35: `{"funcao_in": ["trabalho em altura"]}`).

### M2 — Qualificador de evidência (escrito 1×)

- **A11** (ASO apto + apto_eletricidade, com precedência de `inapto` sobre `vencido`) e **C7** (ensaio reprovado com precedência sobre vencido): o evento não vale só pela data — tem um campo qualitativo que pode invalidá-lo com precedência de status. Solução: `evidence_qualifier` jsonb + avaliador genérico com noção de precedência. É o caso mais sutil do design; o teste de regressão do §5 cobre exatamente ele.

### M3 — Flags manuais com trilha (escrito 1×)

- **A3** (suspensão pelo PLH) e **A12** (reciclagem extraordinária): não derivam de dados — são decisões humanas. O motor as representa como `kind = 'flag_manual'`: o status vem de um registro manual com autor, motivo e timestamp. O que fica **fora** do motor: os *gatilhos* que sugerem a flag (detectar retorno de afastamento, mudança de função — 10.8.8.2). Isso é lógica de evento/notificação, não de requisito. Fase 1: a flag continua manual como hoje; detecção automática de gatilho é feature futura, independente do motor.

### Permanece código (por natureza, não por limitação)

1. **D3 — categoria integrada** (`qualificacao_trabalhadores` auto-atendida porque o módulo Pessoas a cobre): acoplamento cross-módulo. Mitigação: coluna `covered_by_module` em `norm_document_categories` declara o fato; a resolução (o que "módulo pessoas cobre" significa) é código.
2. **E5 — ponderação de incidentes** e **E6 — média simples do índice global**: isso não é requisito, é **política de agregação** — decisão de produto sobre como compor o número que o cliente vê. Manter em código versionado (`conformidade.ts`) é correto: mudar a fórmula do índice deve passar por review, não por UPDATE em tabela. O motor entrega os percentuais por requisito; a composição continua onde está.
3. **A1 — colaborador ativo**: pré-condição universal do avaliador (só se avalia alvo ativo), não um requisito da norma. Hardcoded no motor genérico, de propósito.

### Descoberta colateral (dívida que o motor elimina)

- A regra bienal C4 está **duplicada** em `qualificacoes.ts:196-203` (`reciclagemStatus`) e `vencimentos.ts:116-123` (reimplementada inline). As janelas de aviso divergentes (90/60/30 dias) estão espalhadas em 3 arquivos. O motor centraliza ambos — hoje uma mudança de periodicidade exige tocar 3+ pontos.

---

## 5. Critérios de regressão (condição para extrair o motor)

O motor só substitui o código atual quando passar em **golden tests** de equivalência:

1. **`computeAptidao()` idêntico:** matriz de casos (colaborador ativo/afastado; com/sem cada treinamento; formação recente/vencida; reciclagem posterior; ASO ok/vencido/inapto/sem apto_eletricidade; autorização ausente/suspensa; setor GER vs ELE; flag de reciclagem extraordinária) — o motor deve produzir o mesmo conjunto de bloqueantes, com os mesmos codes, para 100% dos casos. Os codes de `BLOQUEANTE_CODES` (`aptidao.ts:16-28`) viram derivação `<code>_ausente` / `<code>_vencido` / qualifier — o teste trava o mapeamento.
2. **`snapshotPayloadFrom()` idêntico:** mesmo payload jsonb de snapshot mensal para o mesmo dataset (protege a série histórica de `compliance_snapshots` — quebra aqui corrompe a tendência).
3. **`buildVencimentos()` idêntico:** mesmas datas de vencimento e mesma ordenação para o mesmo dataset.
4. **Zero mudança de UX:** nenhuma tela muda na extração; o motor é refactor interno.

## 6. Decisões que este documento deixa travadas

1. Requisito é config global da plataforma; override por org só com demanda real.
2. Tabelas de evento existentes **não mudam** na fase 1 — adapters, não migração de dados.
3. Agregação do índice (pesos, média) fica em código; o motor para no status por requisito.
4. Flags manuais entram no motor como `flag_manual`; gatilhos automáticos ficam fora (feature separada).
5. Extração só acontece quando a 2ª NR estiver contratada/validada (regra de ouro da análise estratégica) — este documento existe para que, nesse dia, o custo já esteja medido: **3 mecanismos genéricos + seeds + golden tests**, sem redesign.

## Próximos passos

- **E2 da sequência:** mapear a NR-35 vigente contra este modelo (cada requisito da NR-35 → linha de `compliance_requirements` ou exceção nova). Se a NR-35 não criar exceção nova, o modelo está validado.
- Quando chegar a hora de implementar: brainstorm → plano task-by-task via superpowers, com os golden tests do §5 escritos **antes** do motor.
