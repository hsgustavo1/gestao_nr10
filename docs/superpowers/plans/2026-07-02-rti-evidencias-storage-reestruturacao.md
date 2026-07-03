# RTI-evidências: reestruturação de paths + exclusão confiável — Plano

> **Status:** rascunho para análise (NÃO executado). Escrito em 2026-07-02.
> **Decisões pendentes do usuário** antes de qualquer execução — ver §5.
> Continuação de [`2026-06-23-fotos-nc-storage-organizacao.md`](2026-06-23-fotos-nc-storage-organizacao.md)
> (aquele resolveu compressão; este resolve organização de paths e limpeza).

**Contexto:** o bucket `rti-evidencias` foi deletado/recriado em 2026-07-02 (limpeza das
fotos gigantes). Storage hoje = **0 objetos**, `rti_nc_evidencias` ≈ **0 linhas**. É uma
**janela rara de "clean slate"**: dá pra trocar o esquema de nomes de arquivo **sem
migração de legado**. Depois que voltar a encher, a troca fica cara.

---

## 1. Situação atual (fundamentada no código)

### 1.1 Três esquemas de path convivendo — nenhum namespaceia o relatório

| Origem | Path gerado | Arquivo |
|---|---|---|
| Anexo manual / import em massa (`uploadRtiFile`) | `nc-{numero}/{uuid}.{ext}` | [rti-queries.ts:494-497](../../../src/lib/rti-queries.ts) |
| Foto de campo (`uploadFieldPhoto`) | `{orgId}/campo/{uuid}.{ext}` | [campo-queries.ts:646-653](../../../src/lib/campo-queries.ts) |
| Composição campo→RTI (`comporRti`, via `.copy()`) | `{orgId}/evidencias/{uuid}.{ext}` | [campo-queries.ts:1026-1031](../../../src/lib/campo-queries.ts) |

**Problema do #1 (numeração reinicia por relatório):** a numeração de NC recomeça em 1 a
cada novo RTI. No esquema `nc-{numero}/…`, a pasta `nc-1/` do Relatório A e `nc-1/` do
Relatório B **apontam para o mesmo prefixo**. Não há sobrescrita/duplicação de arquivo
(o nome é UUID, sempre único), mas:
- as evidências de **relatórios diferentes se misturam na mesma pasta** → perde-se a
  rastreabilidade "esta foto é do RTI X";
- fica **impossível apagar "a pasta do relatório"** de uma vez (ela não existe como
  unidade — está espalhada entre `nc-1/`, `nc-2/`… compartilhadas com outros RTIs).

**Excesso de estratificação (o próprio #1):** uma subpasta por NC (`nc-1/`, `nc-2/`, …)
não agrega nada — cada uma costuma ter 1–3 arquivos. É estrutura sem função.

**Duplicação de storage no `comporRti`:** ao compor um RTI a partir do campo, cada foto
é **copiada** (`.copy()`, [campo-queries.ts:1029](../../../src/lib/campo-queries.ts)) de
`{org}/campo/uuid` para `{org}/evidencias/uuid`. Resultado: **2 cópias do mesmo pixel** no
bucket (a original em `field_photos`, a cópia em `rti_nc_evidencias`). Dobra o consumo por
foto composta. Foi decisão consciente ("cópia independente"), mas pesa no storage.

### 1.2 Exclusão (o #3) — por que arquivos ficam órfãos

Os fluxos de delete **até chamam** `.remove()`, mas com três furos:

1. **O erro do `.remove()` nunca é checado.** Em todos os pontos
   ([rti-queries.ts:134](../../../src/lib/rti-queries.ts) / :304 / :422;
   [campo-queries.ts:228](../../../src/lib/campo-queries.ts) / :305 / :531 / :703) o
   retorno `{ error }` é ignorado. Se o `.remove()` falhar, a linha do banco é apagada
   assim mesmo → **arquivo vira órfão em silêncio**, sem erro na tela.
2. **O `report_path` (PDF do relatório) nunca é removido.** `useDeleteRtiReport`
   ([rti-queries.ts:115-149](../../../src/lib/rti-queries.ts)) limpa só as evidências das
   NCs; o PDF importado do relatório fica para sempre.
3. **Janela sem política de DELETE.** Quando o bucket foi recriado hoje, as 4 políticas
   RLS sumiram (restauradas em `20260702000000`). Entre a recriação e o restore,
   **todo `.remove()` do cliente era negado pela RLS** e — por causa do furo (1) —
   ninguém percebeu.

**Sobre o trigger `protect_delete`:** existe (`protect_objects_delete` em `storage.objects`),
mas ele **só bloqueia DELETE via SQL cru** (checa `current_setting('storage.allow_delete_query')`).
O `.remove()` do cliente passa pela **Storage API** e respeita a **RLS de DELETE** — que
agora está restaurada. Ou seja: indo pra frente, o delete do cliente **funciona**; o
problema real são os 3 furos acima, não o trigger.

**Histórico:** as 383 órfãs / ~867 MB citadas no plano de 2026-06-23 já foram embora na
recriação do bucket. Estamos zerados — a hora de fechar os furos é agora, antes de reencher.

---

## 2. Proposta para #1 e #2 — um "diretório" por RTI, arquivos nomeados por NC

Esquema novo, único para todos os fluxos:

```
{orgId}/{reportRef}/nc-{ncNum}-{idx}.{ext}
```

- `{reportRef}` = identificador do relatório (ver decisão A em §5). Ex.: `rti-2026-014`.
- `nc-{ncNum}` = número da NC **dentro daquele relatório** (o mesmo que aparece no PDF).
- `{idx}` = 1, 2, 3… para múltiplas fotos da mesma NC.

Exemplos (exatamente o que o usuário pediu): `…/nc-1-1.jpg`, `…/nc-1-2.jpg`,
`…/nc-2-1.jpg`, `…/nc-3-1.jpg`.

**Ganhos:**
- **Um prefixo por relatório** → resolve a mistura entre RTIs e torna a exclusão trivial:
  `list("{orgId}/{reportRef}")` + `remove(tudo)` apaga o relatório inteiro de forma
  garantida, mesmo que alguma linha do banco esteja inconsistente.
- **Fim da subpasta por NC** → a NC vira parte do nome do arquivo, não uma pasta.
- **Nome legível/rastreável** — bate com a numeração do PDF.

**Pontos de atenção (viram trabalho no plano de execução):**
- **Cálculo do `{idx}` e concorrência.** Nomes sequenciais são bonitos, mas se dois
  uploads da mesma NC rodam juntos, ou se apaga a foto 2 e adiciona outra, o índice pode
  colidir/regredir. Opções: (a) contar evidências existentes da NC + 1 no momento do
  insert (simples, com risco em concorrência/reuso); (b) `nc-{ncNum}-{idx}` + sufixo curto
  anti-colisão só quando necessário. Recomendo (a) com `upsert:false` e retry no conflito
  — mantém o nome limpo que o usuário quer. Decisão B em §5.
- **`comporRti` — parar de duplicar?** Com prefixo por relatório, dá pra decidir se a
  composição continua **copiando** a foto do campo (2× storage, hoje) ou passa a
  **referenciar** o mesmo arquivo (`file_path` compartilhado, 1× storage). Referenciar
  economiza metade, mas exige cuidado na exclusão (não apagar o arquivo do campo enquanto
  o RTI ainda aponta pra ele). Decisão C em §5.
- **Migração:** **nenhuma** — storage vazio. Só mexe em código de escrita.

**Impacto no código (escrita):**
- `uploadRtiFile` ([rti-queries.ts:494](../../../src/lib/rti-queries.ts)) — passa a receber
  `reportRef` + `ncNum` + `idx` em vez de `prefix` livre. Call sites:
  [rti.evidencias.tsx:182](../../../src/routes/rti.evidencias.tsx),
  [rti.nc.$ncId.tsx:743](../../../src/routes/rti.nc.$ncId.tsx).
- `comporRti` ([campo-queries.ts:1021-1047](../../../src/lib/campo-queries.ts)) — gera o
  path novo (e resolve a decisão C).
- Nenhuma mudança de schema no banco (o `file_path` é texto livre; só muda o valor gravado).

---

## 3. Proposta para #3 — exclusão confiável (nunca deixar órfão)

Três camadas, da mais barata à mais robusta:

1. **Checar o erro do `.remove()` em todos os fluxos** (furo 1). Se o `.remove()` falhar,
   **não** apagar a linha do banco (ou apagar e registrar a pendência) — nunca ignorar.
   Pontos: os 7 `.remove()` listados em §1.2.
2. **Incluir o `report_path` na exclusão do relatório** (furo 2), e — já que passamos a
   ter prefixo por relatório — trocar a lógica por **`list(prefixo) + remove(tudo)`**, que
   apaga PDF + todas as fotos do RTI de uma vez, independente do estado das linhas.
3. **Rede de segurança: varredura de órfãos agendada.** O script
   `scripts/cleanup-orphan-evidencias.mjs` (já existe, do plano anterior) roda com
   service-role e apaga objetos sem referência no banco. Opções de automação:
   (a) rodar manual de tempos em tempos; (b) **Edge Function** com cron (Supabase
   Scheduled Functions) fazendo o mesmo com service-role. Decisão D em §5.

**Observação de robustez:** a exclusão de storage **nunca** deveria bloquear a exclusão do
registro de negócio, mas também não pode sumir sem rastro. Padrão sugerido: tentar remover;
em falha, logar/enfileirar para a varredura da camada 3 (garante consistência eventual).

---

## 4. Ordem de execução sugerida

```
Passo 1  Exclusão confiável (§3 camadas 1-2) ...... fecha o vazamento AGORA, risco baixo
Passo 2  Novo esquema de path por relatório (§2) ... aproveita o clean slate
Passo 3  Decidir copy vs referência no comporRti ... economia de storage (decisão C)
Passo 4  Varredura de órfãos agendada (§3 camada 3)  rede de segurança
```

O Passo 1 independe do resto e é o que mais protege o storage hoje. O Passo 2 só vale a
pena **enquanto o bucket está vazio** — se for adiar muito, reavaliar.

---

## 5. Decisões em aberto (preciso da sua análise antes de executar)

- **A — Como nomear o `{reportRef}`?**
  - (a) `report.id` (UUID) — à prova de colisão, mas ilegível no bucket.
  - (b) slug do número do relatório (ex.: `rti-2026-014`) — legível, mas exige garantir
    unicidade por org e tratar renumeração.
  - (c) híbrido `rti-{numero}-{id8}` — legível + único. **Recomendado.**
- **B — Índice do arquivo (`{idx}`):** sequência limpa com retry no conflito (recomendado)
  vs sequência + sufixo anti-colisão. Trade-off nome-bonito × robustez em concorrência.
- **C — `comporRti`: copiar (hoje, 2× storage) ou referenciar (1× storage)?** Referenciar
  economiza metade do storage de campo, ao custo de exclusão mais cuidadosa. Recomendo
  **referenciar**, dado que o objetivo declarado é conter o storage.
- **D — Varredura de órfãos:** manual periódico vs Edge Function agendada. Recomendo
  **Edge Function com cron** (independe de alguém lembrar de rodar).

---

## 6. Resumo executivo

- **#1/#2:** o esquema atual tem 3 padrões de path, nenhum namespaceia o relatório, e a
  subpasta por NC é estratificação sem função — exatamente a intuição do usuário. A
  correção é **`{org}/{reportRef}/nc-{ncNum}-{idx}.ext`** (um prefixo por RTI). **Fazer
  agora, com o bucket vazio, evita migração.**
- **#3:** os deletes já tentam limpar, mas **ignoram o erro do `.remove()`** e **esquecem o
  PDF do relatório**; o trigger `protect_delete` **não** é o culpado (só barra SQL cru).
  Fechar os furos + `list+remove` por prefixo + varredura agendada elimina o vazamento.
- **Bônus de storage:** `comporRti` duplica cada foto composta — dá pra cortar pela metade
  passando a referenciar em vez de copiar (decisão C).

**Antes de executar:** responder A, B, C, D (§5).
