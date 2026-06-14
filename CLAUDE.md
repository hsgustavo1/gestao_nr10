# gestao_nr10 — instruções do projeto

## Mapa do código (obrigatório ao iniciar)

Antes de qualquer exploração do código (Glob, Grep, Read em arquivos fonte), leia:

```
graphify-out/GRAPH_REPORT.md  — seções: God Nodes, Surprising Connections, Communities
```

Este relatório foi gerado pelo graphify e contém o mapa estrutural completo do projeto (1.834 nós, 4.419 arestas, 127 comunidades). Use-o como ponto de partida para entender impacto de mudanças, localizar módulos e evitar exploração desnecessária de arquivos.

**Regra:** se a resposta estiver no relatório, não leia os arquivos fonte. Só abra um arquivo quando precisar do detalhe de implementação específico.

### Comunidades principais (referência rápida)

| Comunidade | O que contém |
|---|---|
| LOTO Padlock Management | Cadeados, bloqueios, LOTO |
| RTI NC Tracking & Costs | NCs, custos, histórico RTI |
| Campo PWA Inspection Tree | App offline, árvore de inspeção |
| PWA Icons & Archive | `useSetArquivadaCampo()`, flag `arquivada_campo`, fluxo arquivar/reexportar |
| Campo→RTI Pipeline | `comporRti()`, importação campo→RTI |
| Compliance Aggregation | `conformidade.ts`, snapshots mensais |
| Aptidão NR-10 §10.8 Rules | `computeAptidao()`, bloqueantes |
| NR-10 Training & Qualifications | Treinamentos, autorizações, certificados |
| EPI/PPE Management | Luvas, detectores, testes dielétricos |
| Auth Guard & Dialogs | AuthProvider, guards de rota |
| Route Tree Registry | Todas as rotas TanStack |

### God Nodes (mudanças de alto impacto)

- `useAuth()` — 82 arestas (afeta o sistema inteiro)
- `cn()` — 72 arestas (utilitário de classes CSS)
- `Button` — 53 arestas
- `formatDatePtBR()` — 37 arestas

## Stack

- **Frontend:** TanStack Start + TanStack Router, React, shadcn/ui, Tailwind
- **Backend:** Supabase (PostgreSQL + RLS + Storage)
- **PWA offline:** campo-pwa com Dexie.js (IndexedDB) + fila de sync
- **Padrão:** `foo.ts` (tipos/lógica pura) + `foo-queries.ts` (React Query + Supabase)
- **Shared lib:** `@gestao/campo-core` (tipos e helpers compartilhados entre app e PWA)

## Convenções

- Migrations: manuais via SQL Editor do Supabase
- `types.ts` atualizado à mão
- Commits direto na `main`
- Erros tsc pré-existentes são conhecidos — não reportar como bugs novos
