# Autoria de coleta em campo — separar "quem coletou" de "quem entrega"

**Data:** 2026-07-01
**Status:** 📝 Spec — não implementado.
**Escopo:** `packages/campo-core`, `campo-pwa` (Dexie + sync), `field_points`
(Supabase), `src/lib/campo-queries.ts` (`comporRti`), `campo.inspecao.$id.tsx`.
Branch: `staging`.

## Contexto — isto não é greenfield

O modelo atual carimba **um único nome** (`inspection.engenheiro`) na
inspeção inteira, capturado do usuário logado no momento da criação
(`CreateInspectionModal.tsx`), e esse nome é copiado cegamente para
`rti_reports.responsavel_auditoria` na hora de compor o RTI
(`campo-queries.ts:872`). Isso já foi identificado como frágil nesta sessão:
o campo "Engenheiro" foi removido da UX de criação (só continua sendo
capturado em background), o que deixa a fragilidade ainda mais exposta —
hoje não sobra nem um ponto na UI onde esse nome poderia ser corrigido.

**O que já existe e funciona, não precisa ser inventado:**

| Já existe | Onde |
|---|---|
| `rti_reports.created_by` / `created_by_name` — já captura corretamente quem **rodou o `comporRti()`** (o consolidador), não quem coletou | `campo-queries.ts:877`, populado a partir de `actorName` em `campo.inspecao.$id.tsx:1382` |
| Fila de sync já mescla escritas de múltiplos devices na mesma `inspection_id` sem conflito | `campo-pwa/src/sync/engine.ts` |
| Dexie já indexa por tabela com `_synced`; adicionar uma coluna a um store existente é migração de schema local (Dexie `version().stores()`), não reescrita de dados | `campo-pwa/src/db/dexie.ts` |

**O que falta:** granularidade abaixo do nível de inspeção (quem coletou
*este ponto específico*) e desacoplar `responsavel_auditoria` de
`inspection.engenheiro`.

## Problema

Uma inspeção pode ter mais de um autor real, em quatro formas (confirmado
com o usuário nesta sessão):

1. Um único técnico faz tudo.
2. Dois ou mais técnicos coletam em paralelo, em devices separados, e o
   resultado é composto num único relatório.
3. Um técnico começa, outro termina — sequencial, não simultâneo.
4. Um técnico coleta em campo; outro (logado só no web app, sem nenhuma
   evidência coletada por ele) consolida e entrega o relatório ao cliente.

Hoje só existe um nome por inspeção inteira, fixado na criação. Isso já
está tecnicamente errado nos cenários 2 e 3 (que coletou o quê?) e o
cenário 4 revela que o próprio conceito está errado: "quem coletou" e "quem
é responsável pela entrega" são papéis diferentes, mas o schema atual usa
o mesmo campo pros dois — pior, o campo que deveria dizer "responsável pela
auditoria" (`responsavel_auditoria`) hoje herda cegamente o nome de quem
*criou a inspeção*, que pode não ter nenhuma relação com quem assina o
relatório.

## Decisões já tomadas nesta sessão (não reabrir sem motivo)

1. **Granularidade da autoria de campo: por ponto (`field_points`), não por
   achado/foto.** Um técnico caminha até um local físico, abre o ponto, e
   normalmente termina o que começou ali antes de seguir para o próximo —
   é a unidade de trabalho natural do fluxo de campo, e cobre o cenário 3
   (handoff) sem exigir nenhuma tela de "transferir posse". Se no futuro
   handoff *dentro* de um ponto se mostrar comum, dá pra descer o nível pra
   achado sem quebrar este modelo (o achado simplesmente sobrescreveria o
   autor herdado do ponto quando presente) — não construir essa camada
   agora (YAGNI).
2. **Não criar um novo conceito de "responsável pela entrega".** Ele já
   existe: `rti_reports.created_by_name`, populado a partir de `actorName`
   (usuário logado no web app que roda `comporRti()`). Resolve o cenário 4
   de graça — não requer nenhuma mudança de schema.
3. **`responsavel_auditoria` deixa de herdar `inspection.engenheiro`.**
   Passa a ser um campo explícito, editável no diálogo de composição do RTI
   (`ComporRtiDialog` em `campo.inspecao.$id.tsx`), com default = vazio (ou
   `actorName`, a definir na Open Question abaixo) em vez de herdado
   silenciosamente.
4. **Cenário 2 (coleta paralela em devices distintos) não exige nenhum
   trabalho adicional** além do item 1 — a fila de sync já mescla writes de
   múltiplos devices na mesma inspeção; cada device carimba seus próprios
   pontos com seu próprio usuário logado.
5. **`inspection.engenheiro` não é removido do schema** (fica como estava
   antes desta sessão: capturado em background, sem campo visível na
   criação) — só deixa de alimentar `responsavel_auditoria`. Reavaliar se
   vale desativá-lo de vez numa fatia futura, depois que o novo fluxo
   estiver validado em uso real.

## Goals

- Cada `field_points` carrega quem o coletou (`collected_by_user_id` +
  `collected_by_name`), capturado automaticamente no momento da criação do
  ponto — sem exigir nenhuma ação manual do técnico em campo.
- O RTI composto exibe dois nomes/listas distintos e corretos:
  - **Coletado em campo por:** lista deduplicada dos `collected_by_name`
    dos pontos da inspeção.
  - **Responsável pela auditoria:** escolhido explicitamente por quem
    compõe o RTI, não herdado da inspeção.
- Zero regressão no fluxo offline-first: a captura de autoria não pode
  exigir rede no momento da criação do ponto (usar o usuário já
  autenticado localmente via sessão Supabase, mesmo padrão hoje usado para
  `engenheiro` em `CreateInspectionModal`).

## Non-Goals (explícitos)

- **Não** implementar transferência explícita de posse de um ponto já
  criado (reassign). Se técnico A criou o ponto, o ponto é do técnico A —
  mesmo que o técnico B adicione fotos/achados depois.
- **Não** descer a granularidade para achado/foto nesta fatia — decisão 1
  acima.
- **Não** desativar ou remover `inspection.engenheiro`/`created_by_name` do
  schema — decisão 5 acima.
- **Não** mexer em RLS além do necessário para expor a nova coluna
  (`collected_by_user_id`/`collected_by_name` seguem as mesmas policies já
  existentes em `field_points`, que já são org-scoped).
- **Não** construir nenhuma tela de "quem coletou o quê" fora do RTI
  composto (ex.: dashboard de produtividade por técnico) — fora de escopo,
  possível item futuro.

## User Stories

- Como consultor que compõe o RTI a partir de uma coleta feita por dois
  técnicos em paralelo, quero que o relatório mostre os dois nomes como
  coletores, sem eu precisar digitar isso manualmente.
- Como gestor que só consolida relatórios no web app (nunca coleta em
  campo), quero que meu nome apareça como responsável pela auditoria sem
  que isso implique que fui eu quem coletou as evidências.
- Como técnico que retoma uma coleta iniciada por outro colega, quero que
  os pontos que eu crio a partir de agora sejam atribuídos a mim, sem
  precisar de nenhuma tela extra pra "assumir" a inspeção.

## Requirements

### P0 — Must-have

1. **Coluna nova em `field_points`:** `collected_by_user_id uuid null
   references auth.users(id)` + `collected_by_name text null`. Migration
   via MCP do Supabase (`apply_migration`), versionada em
   `supabase/migrations/`. Nullable — pontos já existentes (pré-migração)
   ficam com `null` (tratado como "coletor desconhecido/legado" no
   relatório, não erro).
2. **Captura automática no momento de criar o ponto (PWA).** Mesmo padrão
   já usado em `CreateInspectionModal.tsx` (`supabase.auth.getUser()` →
   `user_metadata.full_name` ?? `email`), mas centralizado num único lugar
   — não repetir a chamada em cada tela que cria ponto. Local exato a
   confirmar durante o plano de implementação (candidato: um hook
   compartilhado chamado no ponto de criação em `PointCapture.tsx`, ou
   dentro do próprio `enqueue()` se o payload já carregar o autor).
   - Acceptance: criar um ponto offline (sem rede) ainda captura o autor,
     desde que o usuário tenha feito login pelo menos uma vez neste device
     (sessão Supabase local já teria os dados de user_metadata cacheados).
3. **`LocalPoint`/`FieldPoint` (types.ts em `campo-core`) e `LocalPoint` no
   Dexie ganham os dois campos novos.** Dexie: nova versão do schema
   (`db.version(3).stores(...)`) — não precisa de índice novo (não há
   necessidade de buscar pontos por coletor nesta fatia), só o campo no
   objeto armazenado.
4. **`comporRti()` para de copiar `inspection.engenheiro` para
   `responsavel_auditoria`.** Passa a receber `responsavelAuditoria:
   string | null` como parâmetro explícito, vindo do diálogo de composição.
5. **`ComporRtiDialog` (`campo.inspecao.$id.tsx`) ganha um campo de texto
   "Responsável pela auditoria"**, editável, default a definir (ver Open
   Question).
6. **RTI composto exibe "Coletado em campo por"**: lista deduplicada de
   `collected_by_name` não-nulos entre os pontos da inspeção, calculada no
   momento da composição e persistida em algum lugar legível no relatório
   final — mecanismo exato (novo campo em `rti_reports`, ou string
   concatenada em `notes`, ou tabela de junção) a decidir no plano de
   implementação, não nesta spec.
   - Acceptance: se todos os pontos tiverem `collected_by_name = null`
     (dado legado, pré-migração), a seção mostra algo como "não
     registrado" em vez de lista vazia silenciosa.

### P1 — Nice-to-have

- Exibir o nome do coletor por ponto na tela `InspectionDetail.tsx` (PWA) e
  `campo.inspecao.$id.tsx` (web), como metadado discreto — útil pra
  conferência em campo antes de compor o RTI.

### P2 — Future considerations (não construir agora)

- Descer granularidade de autoria para achado/foto, se handoff mid-ponto
  se mostrar comum na prática.
- Tela de "produtividade por técnico" (quantos pontos/achados por
  coletor).
- Reassign explícito de pontos entre coletores.
- Desativar de vez `inspection.engenheiro`/`created_by_name` do schema.

## Open Questions

- [produto] Default do campo "Responsável pela auditoria" no diálogo de
  composição: vazio (força escolha explícita) ou pré-preenchido com
  `actorName` (quem está compondo agora), editável? Definir antes de
  implementar o requirement P0-5.
- [engenharia] Mecanismo de persistência de "Coletado em campo por"
  (requirement P0-6) — campo estruturado vs. texto livre. Decidir no plano
  de implementação, considerando se algum consumidor futuro (P2) vai
  precisar consultar isso de forma estruturada.

## Timeline

- Sem prazo externo. Prioridade a definir pelo usuário em relação aos
  outros itens do `ROADMAP.md` — esta spec fica pronta para virar plano
  quando for priorizada.
