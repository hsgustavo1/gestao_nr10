# Campo PWA — Cofre e Portão (segurança da coleta + ergonomia de campo)

**Data:** 2026-07-08
**Status:** design aprovado em brainstorm; aguarda plano de implementação.
**Objetivo imediato:** implementar, validar em bancada e depois em **inspeção de campo real**.
**Contexto estratégico:** primeiro recorte (B) da evolução do Campo PWA rumo a app genérico
de inspeção técnica (ver [análise multi-NR 2026-07-03](../plans/2026-07-03-analise-estrategica-multi-nr.md)).
Ordem de brainstorm definida pelo founder: **B → C → A → D** (ver §Roadmap ao final).

---

## 1. Premissas (validadas com o founder)

- **Cenário de campo prioritário:** (a) celular Android pessoal do técnico e (b) tablet
  compartilhado da consultoria — **sem sinal durante a coleta**; internet só na
  portaria/escritório. Cenário (c) sinal intermitente é plausível, mas a garantia
  deve valer para a/b: **o aparelho é o cofre; a nuvem é redundância**.
- **Sync oportunista já existe** (`campo-pwa/src/sync/engine.ts`): cada mudança é
  enfileirada individualmente e tentada a cada 30s (heartbeat) + evento `online`,
  com backoff exponencial, upsert idempotente e dead-letter com retry manual.
  No cenário (c), a janela de perda já é "desde a última janela de rede".
- **Foto→NC já é parcialmente ergonômico:** a 1ª foto do ponto abre o formulário
  de NC na hora (`PointCapture.tsx`); o gate de saída é rede de segurança.
  (Nota do ROADMAP anterior a isso está desatualizada.)
- **Blob de foto é descartado do IndexedDB após sync** (decisão 2026-06-23).
  Consequência: num dia 100% offline os blobs acumulam localmente — é exatamente
  aí que eviction/quebra de aparelho machuca, e é o que este design protege.
- Confirmado por busca no código: **não existem hoje** `navigator.storage.persist()`,
  geolocalização, export de backup completo, portão de saída nem retomada de contexto.

## 2. Escopo

Abordagem escolhida: **"Cofre + portão"** (opção 2 de 3 apresentadas). Entram:

1. Persistência garantida + backup exportável/reimportável (§3).
2. Portão de saída — conferência pré-partida (§4).
3. Captura ergonômica "modo luva" + associação foto↔achado + modo sol (§5).
4. GPS/timestamp por foto + retomada de contexto (§6).
5. Matriz de erros, testes e protocolo de validação em campo (§7–§9).

**Fora de escopo (deliberado):** login offline multiusuário (trilha própria — mexe em
auth/segurança, já registrado no ROADMAP), export automático em background, journal
append-only (overengineering no volume atual). Ver §10 e §11 para portas abertas e
itens diferidos para as trilhas C/A/D.

## 3. Cofre local

### 3.1 Persistência garantida
- No boot (junto do `startConnectivityWatcher`): `navigator.storage.persist()`.
- Estado exibido no banner de sync existente: "Armazenamento protegido ✓" ou aviso
  discreto se negado, com orientação ("instale o app na tela inicial" — PWA instalado
  quase sempre recebe a concessão no Android).
- `navigator.storage.estimate()` vigiado: banner mostra volume pendente
  ("43 fotos aguardando envio, 180 MB") e alerta quando o aparelho estiver enchendo.

### 3.2 Backup exportável
Botão "Gerar backup" na tela da inspeção; também disparado pelo portão de saída (§4).

```
backup-{slug-da-inspecao}-{data-hora}.zip
├── manifest.json        → versão do app, versão do schema, usuário, org,
│                          exported_at, contagens (validação no import)
├── inspecao.json        → inspeção + árvore (nodes) + pontos + achados +
│                          metadados de fotos + estado da fila de sync
└── fotos/{ponto}/{id}.jpg → SÓ os blobs ainda não sincronizados
```

- Foto já sincronizada entra só como referência (blob já foi descartado e está no
  Supabase) → **o ZIP contém exatamente o que existe apenas no aparelho**. Dia com
  sinal parcial = ZIP pequeno; dia 100% offline = ZIP completo.
- Entrega: Web Share API (WhatsApp, Drive, Bluetooth p/ aparelho do colega) com
  fallback de download direto. Base de código: `export-fotos.ts` (JSZip) existente.

### 3.3 Restauração
- Tela "Restaurar backup" no PWA (e, depois, import no app principal — fase posterior).
- Valida `manifest.json` (versão de schema compatível, contagens) e faz **upsert por
  `id`** em todas as tabelas locais — reimportar não duplica nada que já sincronizou.
- Caso de uso alvo: aparelho quebrou → abrir num aparelho reserva → importar →
  continuar o trabalho no mesmo dia.

## 4. Portão de saída (conferência pré-partida)

Nova tela "Revisão da visita" por inspeção — acessível sempre, pensada para o portão
da fábrica. Checklist automático sobre os dados locais:

| Verificação | Fonte |
|---|---|
| Setores planejados sem nenhum ponto coletado | árvore vs. pontos |
| Pontos sem foto | `photos` por ponto |
| Fotos sem achado vinculado / achados sem modo de falha | `findings` (+ §5.2) |
| Itens parados na fila de sync + dead-letters | `sync_queue` |
| Dados que existem só no aparelho (blobs não sincronizados) | `photos.blob != null` |

- Cada pendência é **link direto** para o ponto/setor correspondente.
- Ação final **"Encerrar visita"**: se houver dado não sincronizado, dispara o backup
  ZIP (§3.2) e mostra resumo ("62 pontos, 18 achados, 145 fotos — 40 aguardando
  envio, backup gerado").
- **Consultivo, não bloqueante**: nunca impede a saída; garante que o técnico saia
  sabendo o que leva e o que falta.

## 5. Captura ergonômica

### 5.1 "Modo luva" no formulário de NC
O `FindingForm` atual é formulário de escritório (select nativo, input numérico,
4 textareas). Redesenho mantendo os mesmos dados:

- **Modo de falha:** lista de botões grandes (~56px), agrupados por categoria, com os
  **mais usados pelo técnico no topo** (frequência contada localmente no Dexie).
  Selecionar pré-preenche tudo (comportamento atual, mantido) e **salva direto** —
  caso comum resolvido em 1 toque. Detalhes ("ajustar ▾": descrição, recomendação,
  observação) colapsados para quem quiser editar em campo.
- **Prioridade:** 5 botões segmentados. **Tipo execução:** 2 botões (O.S./Investimento).
- **Digitação opcional em campo, nunca obrigatória.** Refinamento fino de texto
  acontece no app principal (decisão validada com o founder).
- Meta de ergonomia: **caso comum ≤ 3 toques** (foto → modo de falha → salvar).

### 5.2 Associação foto↔achado (mudança de schema)
Gap de modelo encontrado: fotos e achados são ambos filhos do ponto, **sem vínculo
entre si** — com 2+ NCs no mesmo ponto, o relatório não sabe qual foto evidencia qual
NC (`comporRti` anexa tudo do ponto). Decisão aprovada:

- Coluna **`finding_id uuid NULL`** (FK `field_findings`) em `field_photos`.
  Migration via MCP + arquivo em `supabase/migrations/`; `types.ts` e
  `packages/campo-core` atualizados à mão (convenção do projeto).
- A foto que dispara o formulário nasce vinculada à NC criada; fotos extras podem ser
  vinculadas com um toque no card. Nullable — fotos antigas e fotos "gerais do ponto"
  continuam válidas.
- Dividendo direto na trilha C (wizard de relatório): evidência certa na NC certa.

### 5.3 Modo sol
- Toggle no header (1 toque, persistido): **tema claro de alto contraste** (fundo
  branco, texto preto pesado, bordas grossas) ↔ tema escuro atual (bom para sala
  elétrica escura, ruim sob sol).

## 6. Evidência forense + retomada

### 6.1 GPS por foto
- No disparo da câmera, capturar `geolocation` **em paralelo** (nunca bloqueia nem
  atrasa a foto); `maximumAge` alto para reusar posição recente.
- Colunas novas em `field_photos`: `gps_lat`, `gps_lng`, `gps_accuracy` (NULL quando
  indisponível/negado — foto marcada "sem localização", captura segue).
- Achado herda localização das fotos vinculadas (via §5.2). Timestamp já existe
  (`created_at`). GPS funciona **sem rede** (satélite) — cenário a/b não atrapalha.
- Uso: dossiê/laudo ("foto registrada em -22.34, -47.89 às 14:32 por Fulano") e
  valor de procedência do dado (ativo da plataforma).

### 6.2 Retomada de contexto
- A cada navegação, gravar em `localStorage` a última posição
  (inspeção → setor → ponto + timestamp).
- Ao abrir o app, se houver posição recente (<12h), banner na lista de inspeções:
  **"Continuar: Subestação 2 → Painel QGBT-03 (há 40 min)"** — 1 toque volta ao ponto.
- Sem mudança de schema; resolve interrupções constantes de campo (DDS, escolta, almoço).

## 7. Tratamento de erro

Princípio: **nunca bloquear a coleta; degradar avisando.**

| Falha | Comportamento |
|---|---|
| `persist()` negado pelo SO | Aviso no banner + orientação; app segue funcionando |
| Armazenamento enchendo | Alerta antecipado no banner e no portão de saída |
| Web Share indisponível | Fallback: download direto do ZIP |
| Manifest inválido / schema incompatível no import | Recusa com motivo claro; import idempotente (reimportar não duplica) |
| GPS negado/timeout | Foto salva normalmente, "sem localização"; nunca atrasa o disparo |
| Dead-letters na fila | Já no banner; passam a aparecer também no portão de saída |

## 8. Testes

O campo-pwa não tem infra de teste hoje (os testes existentes são do app principal).
Esta trilha introduz **vitest no PWA**, focado nas funções puras novas:

- Cálculo de pendências do portão de saída (dados locais → lista de avisos).
- Montagem e validação do manifest do backup.
- Merge do import — round-trip export→import→verificação com `fake-indexeddb`.
- Ordenação de modos de falha por frequência local.

UI (modo luva, modo sol) valida-se em campo, não em teste unitário. TDD nas puras
(convenção superpowers).

## 9. Protocolo de validação em campo

**Bancada (1 dia, antes da visita):** modo avião; coletar 15+ pontos com fotos;
matar o app e reabrir (retomada?); gerar backup; restaurar num 2º aparelho; sair do
modo avião; conferir sync e `comporRti` com fotos vinculadas às NCs certas.

**Visita real:** modo sol sob sol de verdade; modo luva com luva de verdade;
permanecer offline o dia todo (cenário a/b); no portão, rodar a revisão de saída e
compartilhar o ZIP para um 2º aparelho antes de deixar a planta; sincronizar só no
escritório.

**Métricas:** tempo por ponto; toques por NC (meta ≤ 3 no caso comum); precisão do
GPS em área industrial/interna; cada momento em que foi preciso tirar a luva ou
sombrear a tela. A lista de fricções vira o backlog de ajuste fino.

## 10. Portas abertas (desenhadas, NÃO construídas nesta fase)

- **Áudio por achado:** gravar nota de voz offline anexada ao achado; transcrição por
  IA depois, no app principal (encaixa no wizard da trilha C). O design do modo luva
  não deve impedir um botão de áudio futuro no formulário de NC.
- **Medições estruturadas:** valor medido (ΔT termografia, resistência de isolamento…)
  com tipos de campo por template — pertence ao Motor 2 (inspeção genérica). O schema
  de achado não precisa mudar agora; só não fechar a porta.

## 11. Roadmap das trilhas seguintes (ordem definida: B → C → A → D)

Gaps mapeados neste brainstorm e endereçados **fora** desta spec:

- **C — Wizard de relatório (próxima trilha, após validação em campo):** interface
  seriada pré-configurada por tipo de relatório; substitui `window.print()`
  (Motor 3 / Horizonte 1 da análise multi-NR). Herda daqui: fotos vinculadas a NC
  (§5.2), GPS/autoria no laudo, futura transcrição de áudio. **Decisão pendente
  registrada:** compressão 1024px pode ser agressiva para evidência de detalhe —
  arbitrar trade-off storage×qualidade nesta trilha (ex.: "foto de detalhe" opcional
  em resolução maior).
- **A — Curadoria de padrões:** setores/estruturas viram sugestões para trabalhos
  futuros. Dois requisitos já identificados: (1) **agregação automática** (padrão
  candidato emerge de N cadastros similares; o dono cura catálogos consolidados, não
  cada cadastro — senão vira gargalo de um humano); (2) **generalização/anonimização**
  antes de publicar (nome de linha/máquina/produto de um cliente não pode vazar a
  outro — LGPD/confidencialidade). Inclui a regra de merge planejamento↔campo
  (recomendação registrada: **campo vence e edições são aditivas** — campo nunca
  deleta o que o PC criou, só acrescenta e marca "não encontrado").
- **D — Experiência do cliente:** alertas, snapshots, planos de ação vivos, importação
  fácil de base legada ("efeito UAU"). Parcialmente coberto por dossiê/evolução
  mensal/upload de certificados já entregues.
- **Trilha própria (segurança/auth):** login offline multiusuário no tablet
  compartilhado (sessões cacheadas + PIN) — já detalhado no ROADMAP; brainstorm
  específico antes de implementar.

## 12. Mapa de arquivos afetados (implementação)

| Área | Arquivo | Mudança |
|---|---|---|
| Boot/persistência | `campo-pwa/src/main.tsx` ou `Layout.tsx` | `storage.persist()` + `estimate()` no watcher |
| Banner de sync | `campo-pwa/src/components/SyncStatus.tsx`, `useSyncStatus.ts` | estado de proteção + volume pendente |
| Schema local | `campo-pwa/src/db/dexie.ts` | versão 3: `finding_id` e GPS em `photos` |
| Backup | novo `campo-pwa/src/lib/backup.ts` (+ `export-fotos.ts` como base) | export/import ZIP + manifest |
| Portão de saída | nova página `campo-pwa/src/pages/RevisaoVisita.tsx` | checklist + encerrar visita |
| Captura | `campo-pwa/src/pages/PointCapture.tsx` | modo luva, vínculo foto↔NC, GPS |
| Tema | `campo-pwa/src/components/Layout.tsx` + CSS | toggle modo sol |
| Retomada | `campo-pwa/src/pages/InspectionList.tsx` | banner "Continuar" |
| Banco | nova migration `supabase/migrations/` (via MCP + arquivo) | `field_photos.finding_id`, `gps_lat/lng/accuracy` |
| Tipos | `src/integrations/supabase/types.ts`, `packages/campo-core`, `src/lib/campo.ts` | à mão (convenção) |
| Sync | `campo-pwa/src/sync/engine.ts` | payload de foto com novos campos |
| Testes | novo setup vitest em `campo-pwa` | puras de §8 |
