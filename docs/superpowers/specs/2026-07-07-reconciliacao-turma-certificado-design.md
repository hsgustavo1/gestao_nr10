# Reconciliação Turma ↔ Certificado — Design

**Data:** 2026-07-07
**Status:** Design aprovado (brainstorming) — pendente escrita de plano de implementação
**Contexto:** módulo NR-10 / Qualificações do `gestao_nr10`

## Problema

Hoje há duas portas de entrada que preenchem **metades diferentes** do mesmo
treinamento e não se enxergam:

- **Lançamento manual de turma:** grava ART, instrutor, data, carga e conteúdo,
  mas não recebe os certificados (PDFs por pessoa).
- **Importação de certificados (IA):** recorta e vincula o PDF por colaborador,
  mas não traz ART — o certificado *pode* conter os dados do treinamento, mas não
  obrigatoriamente.

Consequência: importar antes de lançar a turma cria registros sem ART; lançar a
turma não dá onde pendurar os certificados. O usuário não vê a costura entre as
duas pontas nem tem garantia de ordem.

### Estado atual do modelo (fonte do problema)

Não existe entidade "turma". ART, instrutor, carga horária e conteúdo ficam
gravados **em cada linha de `nr10_trainings`, que é por-colaborador**
(UNIQUE `employee_id, training_type, category`). Uma turma é apenas um conjunto
de linhas que por acaso compartilham a mesma ART/data/instrutor — implícita e
duplicada.

O `importCertificateAsTraining` já faz *find-or-create* dessa linha, então as
pontas **já convergem no dado**; o que falta é tornar isso explícito, visível e
independente da ordem de entrada.

## Decisão de arquitetura

Tornar a **turma um evento de treinamento de primeira classe**. A turma passa a
ser o lugar natural onde as duas metades se encontram:

- **ART é atributo da turma** — 1 lugar, não N cópias por colaborador.
- **Certificado (PDF) continua por pessoa** — vinculado à participação daquela
  pessoa naquela turma.

## Modelo de dados

### Nova tabela `nr10_turmas`

| Campo | Descrição |
|---|---|
| `id`, `org_id` | identidade / multi-tenant |
| `training_type`, `category` | define a turma (Básico/Complementar × formação/reciclagem) |
| `data` | **data de realização/conclusão** do treinamento |
| `art`, `art_arquivo_path` | ART da turma (número + arquivo no bucket) — **opcional** |
| `instrutor`, `entidade`, `carga_horaria`, `conteudo_programatico` | metadados da turma |

RLS multi-tenant no mesmo padrão das demais tabelas de pessoas
(`can_access_org` para SELECT, `fn_employee_editable`/`org_role_at_least` para
escrita — nunca `is_staff()`/`has_role()` legados).

### `nr10_trainings` (vira "participação")

- Ganha `turma_id uuid NULL REFERENCES nr10_turmas(id)`.
- Quando `turma_id` está presente, ART/instrutor/carga/conteúdo são **lidos da
  turma**. Os campos permanecem na linha por compatibilidade, mas a turma é a
  fonte-da-verdade — a linha não guarda ART própria (evita divergência).
- `turma_id = null` só para registros legados ainda não agrupados.

### `training_certificates` (já existe)

- Passa a separar **duas datas**:
  - `issue_date` — data de **emissão** do certificado (pode divergir; informativa).
  - `data_realizacao` — data de **realização/conclusão**; é a que se confronta
    contra `nr10_turmas.data`.
- Continua vinculado à participação (`nr10_training_id`) e mora na pasta
  `{matricula}_{nome}/` do bucket.

### Migração de dados existentes

Linhas atuais que compartilham `training_type + category + data + art` viram uma
`nr10_turma` cada; linhas sem ART viram turmas **válidas sem ART** (não
"incompletas"). Nada é perdido; `turma_id` é backfilled.

## Fluxos

### Manual — lançar turma

Cria a `nr10_turma` e seleciona participantes → gera uma `nr10_training`
(participação) por pessoa, todas com `turma_id`. Mesmo fluxo de hoje, agora
escrevendo na turma + filhos. Certificados podem ou não existir ainda. **ART é
opcional** — empresas que não usam ART lançam a turma normalmente sem ela.

### Import — certificados (casamento sugerido)

Após o recorte por certificado + extração IA (já implementado), entra o passo de
**casamento sugerido**:

1. Agrupa o lote e busca turmas candidatas por `training_type + category`,
   proximidade de `data` (janela ±N dias) e, se algum certificado trouxe número
   de ART, match direto por ART.
2. Card de sugestão:
   *"8 certificados → turma NR-10 Básico 12/03 · ART 123 · Instrutor Fulano."*
   com **[Vincular] · [Escolher outra turma] · [Criar turma nova]**.
3. **Vincular:** cada certificado cai na participação da pessoa naquela turma
   (find-or-create da `nr10_training` com aquele `turma_id`) + anexa o PDF.
   Pessoas do lote fora da turma são **adicionadas como participantes** (com aviso).
4. **Criar turma nova:** abre o form de turma pré-preenchido com o que a IA
   extraiu (ART/instrutor/data/carga quando presentes; em branco quando baixa
   confiança — regra que já vale).

## Regras de conflito (autoridade)

- **Vinculando a turma existente:** a **turma é autoritativa** para
  ART/instrutor/data. O certificado **não sobrescreve** a data da turma — é
  evidência de participação, não redefine o evento.
- **Criando turma a partir dos certificados:** os dados vêm do certificado (não
  há turma pré-existente a confrontar).
- **Duas datas, dois tratamentos:**
  - **`data_realizacao` divergente da turma** → **alerta forte**, bloqueante-de-
    atenção antes de vincular. Um certificado de realização com data que não bate
    com a conclusão da turma não deveria existir — sinaliza certificado errado ou
    erro de lançamento.
  - **`issue_date` (emissão) divergente** → normal, **sem alerta**.
- Qualquer discrepância (carga horária, datas) aparece **explícita** no card
  antes de vincular — nunca silenciosa.

## Visibilidade e reconciliação (UI)

### Selo de completude na turma

- 🎓 **ART** — presente / ausente. **Neutro/informativo**, nunca alerta de
  pendência (ART é prática opcional; nem toda empresa usa).
- 📎 **Certificados** — X de N participantes com PDF anexado.
- **Completude da turma = todos os participantes com certificado.** ART **não**
  entra nessa conta.

### Filtros de pendência (views, não telas novas pesadas)

- *Turmas sem ART* — apenas um **filtro** útil para quem usa ART; não é fila de
  defeito. Quem não usa ART nunca é incomodado.
- *Turmas com certificados faltando* — participantes sem PDF; ação: importar ou
  anexar manual.

### Diálogo do treinamento (aba Capacitações)

Passa a mostrar o cabeçalho da turma (ART, instrutor) herdado, além dos
certificados que já lista — resolvendo o caso observado (treinamento com
certificado anexado que não exibia nem o anexo nem a turma).

### Anexo manual unificado

O "Anexar" manual passa a usar a pasta `{matricula}_{nome}/` (hoje ainda usa a
antiga `{employeeId}/` — inconsistência corrigida aqui).

## Fora de escopo

- Reescrita do motor de extração IA (já implementado) — só ganha o campo
  `data_realizacao` separado de `issue_date`.
- Qualquer mudança em outros módulos (LOTO, RTI, PLH) além do necessário para a
  herança turma→participação.

## Riscos / pontos de atenção

- **Migração:** o agrupamento de linhas legadas em turmas precisa de critério
  determinístico (`training_type + category + data + art`), com fallback claro
  para linhas sem `data` ou sem `art`.
- **Janela de matching (±N dias):** valor a definir na implementação (sugestão
  inicial: ±3 dias), ajustável.
- **Participação fora da turma no import:** adicionar automaticamente participante
  ao vincular precisa de aviso visível para evitar inflar turma por engano.
