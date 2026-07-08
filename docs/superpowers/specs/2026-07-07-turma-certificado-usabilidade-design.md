# Ajustes de usabilidade — Registrar turma manual ↔ Importar certificados em lote

Data: 2026-07-07
Contexto: sequência do design `2026-07-07-reconciliacao-turma-certificado-design.md` (turma como entidade
própria). Este spec cobre feedback de uso real após aquela implementação.

## Escopo

1. **Fora de escopo agora**: melhorar o prompt/extração da IA (Groq) para lidar com maior variabilidade
   de certificados. Registrado como item de roadmap — ver seção "Roadmap" abaixo.
2. Anexo de ART aceitar imagem, não só PDF.
3. Renomear "Marcar visíveis" → "Selecionar todos" (mesma função).
4. Unificar os dois caminhos de cadastro (manual e import) sem forçar troca de tela: botão
   "Registrar e importar certificados" na tela manual, navegando para o import com a turma pré-selecionada.
5. Import com turma existente selecionada deve permitir editar/completar os campos da turma inline,
   sem a IA sobrescrever automaticamente dado já preenchido.
6. Reconciliação: qualquer caminho (manual, import de uma turma nova, import de uma turma existente)
   deve convergir nos mesmos dados de turma, sem duplicar e sem a IA piorar dado bom já digitado.
7. Fallback de modelo: se `llama-4-scout` falhar após todas as tentativas, usar `qwen/qwen3.6-27b` no Groq
   como segunda tentativa antes de desistir.

## Decisões (confirmadas com o usuário)

- **Política de merge**: turma nunca é sobrescrita automaticamente por leitura da IA. Campo já preenchido
  na turma sempre vence na tela e no salvamento; a IA só pode sugerir preenchimento para campos vazios.
  Divergência entre valor da turma e valor lido pela IA vira alerta informativo (já existe para
  `data_realizacao`; passa a valer também para instrutor/entidade/ART/carga horária), nunca substituição
  automática. Edição manual explícita do usuário no formulário sempre é aplicada ao salvar.
- **Onde editar turma incompleta/incorreta**: diretamente na tela de Importar certificados, no card
  "Turma deste lote", que passa a ficar editável sempre que uma turma existente é selecionada (reusando o
  mesmo formulário hoje restrito ao caminho "criar nova turma").
- **Navegação registrar→importar**: botão adicional "Registrar e importar certificados" ao lado do
  "Registrar turma" existente (que continua com o comportamento atual, só fechar o diálogo).

## Mudanças por arquivo

### `src/components/nr10-turma-dialog.tsx`
- `accept` do input de ART: de `.pdf,application/pdf` para
  `.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png`. Label do bloco passa de
  "Anexar ART (PDF, opcional)" para "Anexar ART (PDF ou imagem, opcional)".
- Texto do botão de seleção em massa: "Marcar visíveis"/"Desmarcar visíveis" →
  "Selecionar todos"/"Desmarcar todos". Nenhuma mudança de lógica (`toggleAllVisible` inalterado).
- Novo botão no `DialogFooter`, "Registrar e importar certificados": roda a mesma validação e
  `registrar.mutateAsync(...)` do submit atual: então navega via `useNavigate()` do TanStack Router para
  `/admin/certificados/importar?turmaId=<id da turma criada/atualizada>`. Para obter o id da turma
  recém-registrada, `useRegistrarTurma`/`upsertTurma` precisa retornar o `turma.id` upserted (hoje o
  retorno não é usado pelo chamador — checar `qualificacoes-queries.ts`).

### `src/routes/admin.certificados.importar.tsx`
- Ler `turmaId` da querystring (TanStack Router `useSearch`) no mount; se presente e existir em `turmas`,
  pré-seleciona (`setTurmaSel(turmaId)`, marca como `turmaTouched`) — pulando o estado `NOVA_TURMA`.
- Quando `turmaSel !== NOVA_TURMA` (turma existente selecionada), o card "Turma deste lote" passa a
  mostrar o mesmo formulário de campos hoje só usado em `isNovaTurma`, mas:
  - pré-preenchido com os valores atuais da turma (`training_type`, `category`, `data`, `carga_horaria`,
    `art`, `instrutor`, `entidade`, `responsavel_tecnico`, `conteudo_programatico`),
  - o usuário pode editar/completar qualquer campo,
  - **não** é sobrescrito automaticamente pelos valores lidos da IA no lote atual (o auto-prefill de
    `novaTurma` a partir de `batchKey`/`capturedCarga`, que hoje só roda para turma nova, não deve rodar
    aqui).
- `gruposComDivergenciaData` (hoje só compara `data_realizacao`) é generalizado para
  `detectTurmaDiscrepancies` cobrir também `carga_horaria` divergente entre o lote e a turma, exibido
  como alerta "média" (reaproveita o tipo `Discrepancy` já existente em `src/lib/turmas.ts`).
- `handleImport`: quando turma existente, os campos editados no formulário substituem os da turma via
  `upsertTurma` (edição manual explícita é sempre aplicada); os certificados do lote continuam vinculados
  por `turma_id` como hoje.

### `src/lib/qualificacoes-queries.ts`
- `upsertTurma` passa a retornar o registro da turma upserted (ou ao menos `{ id }`), para o botão
  "Registrar e importar certificados" poder montar a URL de navegação.

### `src/lib/certificados-ai-server.ts`
- Novo `const FALLBACK_MODEL = "qwen/qwen3.6-27b";`.
- `callGroq` ganha parâmetro `model` (default `MODEL`). Em `analyzeCertificatePage`, se a chamada com
  `MODEL` falhar após esgotar `MAX_RETRIES` (throw), tentar uma vez com `FALLBACK_MODEL` antes de propagar
  o erro. Mesmo `PROMPT_SYSTEM`/`USER_TEXT`, mesma normalização (`normalizePageAnalysis`).

## Roadmap (registrar, não implementar agora)

Adicionar a `docs/superpowers/plans/ROADMAP.md` (ou equivalente): "Melhorar prompt/extração de dados de
certificados via IA para lidar com maior variabilidade de inputs (layouts de diferentes entidades
treinadoras, digitalizações de baixa qualidade, tipos de treinamento mal identificados)."

## Testes

- `src/lib/__tests__/turmas.test.ts`: estender `detectTurmaDiscrepancies` para cobrir mais casos se a
  generalização de carga horária já não estiver coberta (já está — mantém).
- Novo teste (ou ajuste) confirmando que `upsertTurma` retorna o id da turma.
- Sem teste de UI automatizado (padrão do projeto); validação via `tsc --noEmit` + inspeção manual do
  fluxo (preview bloqueado pela porta 57010 conforme regra do projeto).

## Fora de escopo

- Mudar o prompt da IA (item 1, vira roadmap).
- Editor inline de turma na página `/qualificacoes/turmas` (decisão do usuário: só no import por ora).
