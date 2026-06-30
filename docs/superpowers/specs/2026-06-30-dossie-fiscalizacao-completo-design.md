# Dossiê de Fiscalização — completar com Incidentes Elétricos

**Data:** 2026-06-30
**Status:** 📝 Spec — não implementado.
**Escopo:** `src/routes/relatorio.dossie.tsx` + `src/lib/conformidade.ts` (extensão).
Branch: `staging`.

## Contexto — isto não é greenfield

Existe um dossiê de fiscalização **já implementado e em uso**, em
`/relatorio/dossie` (linkado no menu NR-10, `app-sidebar.tsx:156`). Antes de
escrever requisitos novos, registrar o que já está pronto, pra não duplicar
trabalho:

| Já existe | Onde |
|---|---|
| 5 seções: Prontuário/Documentos, Aptidão & Treinamentos, Laudos/Inspeções, EPIs, Plano de ação RTI | `relatorio.dossie.tsx` |
| Agregador reutilizável (`ComplianceReport`, índice global de conformidade) | `src/lib/conformidade.ts` |
| Multi-tenant: todas as queries já filtram por `currentOrgId` (RLS + hook) | `qualificacoes-queries.ts`, `prontuario-queries.ts`, `inspecoes-queries.ts`, `epis-queries.ts`, `asos-queries.ts` |
| Exportação client-side via `window.print()` (CSS de impressão já tratado, `print:hidden` no cabeçalho) | `relatorio.dossie.tsx` |
| Visível no menu, dentro do grupo NR-10 (`canViewGestao` — gestor/consultor/PA) | `app-sidebar.tsx` |

**O que falta é só o gap identificado na análise estratégica:** o dossiê hoje
não inclui **Incidentes Elétricos**, e o índice global de conformidade
(`overall`) não pondera esse módulo. **LOTO ficou fora desta fatia** — ver
decisão 5 abaixo.

## Problema

O comprador/gestor precisa de um documento único, apresentável a um fiscal ou
à própria diretoria, que prove a conformidade NR-10 da operação. O dossiê
atual cobre a maior parte mas deixa de fora o registro de incidentes
elétricos — hoje quem precisa mostrar isso pro fiscal apresenta por fora,
quebrando a promessa de "documento único".

## Decisões já tomadas nesta sessão (não reabrir sem motivo)

1. **v1 mostra status real**, incluindo NCs/pendências em aberto com
   prazo/responsável — não o filtro "só conformes". Decisão consciente pra
   não aumentar escopo agora.
   - Variante futura ("modo auditoria", só conformes, espelha a vitrine sem
     login) registrada como item adiado no `ROADMAP.md`.
2. **Período: mês corrente / estado atual** — o dossiê já usa dado vivo
   (`useComplianceReport`, queries em tempo real), não o snapshot mensal
   histórico. Sem seletor de período na v1.
3. **Geradores:** gestor do cliente (`org_role` member/admin), consultor,
   platform admin — mesmo público que já acessa `/relatorio/dossie` hoje via
   gate `canViewGestao`. Sem gate novo a criar.
4. **Branding:** padrão Conforme. — sem logo do cliente na v1 (white-label é
   item futuro já registrado no roadmap geral, fora de escopo aqui).
5. **LOTO fica de fora desta fatia, deliberadamente.** Tecnicamente seria o
   mesmo tratamento (seção condicional a `hasEntitlement("loto")`, igual ao
   gate já usado em `getLotoAccess`), mas o módulo LOTO ainda está sob a
   desvinculação pendente do @lovable.dev (item crítico paralelo, ver memória
   `project-lovable-strategy`). Evitar tocar nesse módulo até essa
   desvinculação fechar. Revisitar depois.
6. **Incidentes entram no índice global de conformidade**: incidente
   **resolvido** conta a favor; incidente **aberto** conta contra, com peso
   maior pra gravidade alta. Ver requirement P0-3 para a fórmula.
7. **Exportação continua via `window.print()`** — não trocar por lib de PDF
   nesta fatia. Risco aceito: layout de impressão da seção nova precisa
   seguir o mesmo padrão CSS das 5 existentes (`break-inside-avoid`, tabelas
   `text-xs`).

## Goals

- Dossiê único passa a cobrir Incidentes Elétricos, sem precisar de
  documento separado.
- Índice global de conformidade (`report.overall`) passa a refletir
  incidentes (resolvidos vs. abertos, ponderado por gravidade).
- Zero regressão nas 5 seções existentes (mesmo componente `Section`, mesmo
  CSS de impressão).

## Non-Goals (explícitos)

- **Não** incluir LOTO nesta fatia — decisão 5 acima (bloqueado pela
  desvinculação Lovable, não pela complexidade técnica).
- **Não** trocar `window.print()` por lib de PDF — decisão 7 acima.
- **Não** implementar o "modo auditoria" (só conformes) — vira item futuro
  separado no roadmap.
- **Não** adicionar seletor de período/histórico — usa estado atual, como já
  é hoje.
- **Não** adicionar branding/logo por cliente — item futuro (white-label).
- **Não** mexer em RLS/backend — os dados de Incidentes já existem e já são
  org-scoped; esta fatia é só consumo no front.

## User Stories

- Como consultor que entrega o dossiê pro cliente final, quero que o índice
  global de conformidade reflita a realidade completa da operação, incluindo
  incidentes.
- Como gestor, quero ver os incidentes elétricos registrados (gravidade,
  status, data) no mesmo documento que já mostra inspeções e EPIs.
- Como gestor com incidentes já resolvidos, quero que isso conte a favor no
  índice — mostra que a empresa trata os problemas, não só que eles existem.

## Requirements

### P0 — Must-have

1. **Seção "Incidentes Elétricos"** no dossiê, posicionada após o Plano de
   Ação (RTI). Conteúdo: lista de incidentes do estado atual com gravidade
   (`INCIDENT_GRAVIDADE_LABELS`), tipo (`INCIDENT_TIPO_LABELS`), status
   (`INCIDENT_STATUS_LABELS`) e data. Fonte: `incidentes-queries.ts` (já
   filtra por org). Resumo numérico no estilo da seção RTI (total por
   status/gravidade).
   - Acceptance: se não houver incidentes, mostrar "Nenhum incidente
     registrado" (mesmo padrão da seção RTI vazia) — a seção sempre aparece
     (diferente de LOTO, que é condicional a entitlement; incidentes fazem
     parte do módulo NR-10 padrão).
2. **Índice global de conformidade atualizado**: `snapshotPayloadFrom` /
   `ComplianceReport.overall` em `src/lib/conformidade.ts` passa a incluir um
   novo fator `incidentPercent`.
   - **Fórmula:** se não há incidentes registrados → `incidentPercent = 100`
     (nada a resolver, eixo limpo). Se há incidentes → cada incidente
     contribui com peso conforme gravidade (`INCIDENT_GRAVIDADE_LABELS`: leve
     = peso 1, moderada = peso 2, grave = peso 3 — confirmar nomes exatos dos
     enums em `incidentes.ts` antes de implementar); incidente com `status`
     resolvido conta o peso cheio a favor, incidente aberto conta o peso
     cheio contra. `incidentPercent = round(pontos_favor / pontos_totais *
     100)`.
   - Acceptance: incidente grave aberto reduz o índice mais que um incidente
     leve aberto; todo incidente resolvido (de qualquer gravidade) empurra o
     índice pra cima; org sem nenhum incidente registrado tem
     `incidentPercent = 100` (não é tratado como dado ausente/null, ao
     contrário de EPI/inspeções — ausência de incidente é informação
     positiva, não falta de rastreamento).
3. Nenhuma regressão visual/funcional nas 5 seções existentes — mesmo
   componente `Section`, mesmas classes de impressão.

### P1 — Nice-to-have

- Contagem de incidentes no resumo da capa do dossiê (ao lado do índice
  global), no mesmo estilo do "Índice global de conformidade".

### P2 — Future considerations (não construir agora)

- **LOTO no dossiê** — revisitar após a desvinculação do @lovable.dev.
  Quando retomado: seção condicional a `hasEntitlement("loto")`, mesmo
  padrão de gate já usado em `getLotoAccess` (`tenancy-gates.ts`).
- "Modo auditoria" (só conformes, sem NCs/pendências) — já registrado no
  `ROADMAP.md`.
- Branding/logo por cliente.
- Exportação via lib de PDF dedicada (layout mais rico, nome de arquivo
  automático).
- Seletor de período/histórico (hoje é sempre "estado atual").

## Open Questions

- [engenharia] Confirmar os valores exatos do enum de gravidade em
  `src/lib/incidentes.ts` (`IncidentGravidade`) pra mapear pesos 1/2/3
  corretamente na fórmula do requirement P0-2 — não assumir nomenclatura sem
  checar o arquivo antes de codar.

## Timeline

- Sem prazo externo (não há compromisso contratual). Prioridade definida
  internamente: este item vai antes da reordenação de captura de achado no
  PWA porque o usuário não tem como testar PWA agora.
- Implementação roda na branch `staging`; validação na preview URL antes de
  merge pra `main`.
