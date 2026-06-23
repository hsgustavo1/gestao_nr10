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

- `useAuth()` — 96 arestas (afeta o sistema inteiro)
- `cn()` — 80 arestas (utilitário de classes CSS)
- `Button` — 54 arestas
- `PageShell()` — 41 arestas (novo god node — layout global)
- `formatDatePtBR()` — 37 arestas

## Stack

- **Frontend:** TanStack Start + TanStack Router, React, shadcn/ui, Tailwind
- **Backend:** Supabase (PostgreSQL + RLS + Storage)
- **PWA offline:** campo-pwa com Dexie.js (IndexedDB) + fila de sync
- **Padrão:** `foo.ts` (tipos/lógica pura) + `foo-queries.ts` (React Query + Supabase)
- **Shared lib:** `@gestao/campo-core` (tipos e helpers compartilhados entre app e PWA)

## Convenções

- Migrations: aplicadas via **MCP do Supabase** (`apply_migration` para DDL, `execute_sql` para checagens/seed) no projeto `fumwovtzyhxrjhkjzujs`. Manter também o arquivo `.sql` versionado em `supabase/migrations/`. (Antes era manual via SQL Editor — mudou em 2026-06-19.)
- `types.ts` atualizado à mão
- Commits direto na `main`
- Erros tsc pré-existentes são conhecidos — não reportar como bugs novos

## Design System — Conforme / Gestão NR-10

### Paleta de cores (fonte da verdade)

Todas as cores vivem em `src/styles.css` como variáveis CSS em `:root` / `.dark`.
**Nunca hardcode hex fora dessas variáveis.** Use tokens Tailwind (`bg-primary`,
`text-muted-foreground`, `border`) ou as primitivas expostas (`bg-pine`, `bg-emerald`).

| Token CSS                  | Valor light          | Uso                                      |
|----------------------------|----------------------|------------------------------------------|
| `--conforme-pine`          | `oklch(0.22 0.07 162)` = `#0C3326` | Topbar, drawer mobile, hero dark |
| `--conforme-pine-soft`     | `oklch(0.30 0.07 162)` = `#174830` | Gradiente do topbar                |
| `--conforme-green`         | `oklch(0.60 0.15 161)` = `#059669` | Botões, ações primárias            |
| `--conforme-emerald`       | `oklch(0.76 0.15 162)` = `#34D399` | Destaques, hover, gradiente CTA    |
| `--warning`                | `oklch(0.78 0.16 72)`  = `#F59E0B` | Tensão MT, atenção, vencimentos    |
| `--destructive`            | `oklch(0.63 0.22 25)`  = `#DC2626` | Tensão AT, crítico, cancelado      |

### Gradientes de CTA (sempre verde, nunca laranja)

```tsx
// Botão de destaque / login
className="bg-gradient-to-br from-[#34D399] to-[#059669]"

// Régua decorativa (já coberta pela utility)
className="atvos-rule"   // ou brand-rule
```

### Fontes

- **Principal:** `Hanken Grotesk` (400/500/600/700/800) — carregada em `__root.tsx`
- **Mono:** `JetBrains Mono` (400/500/600) — cadeados, IDs, referências NR-10
- Em CSS use `font-family: var(--font-sans)` / `var(--font-mono)` (não `"Manrope"`)

### Utilities de marca disponíveis

| Classe              | O que faz                                                 |
|---------------------|-----------------------------------------------------------|
| `atvos-topbar`      | Fundo `#0C3326` + texto branco (topbar / sheet mobile)    |
| `atvos-rule`        | Faixa 3 px gradiente esmeralda→verde                      |
| `atvos-avatar`      | Gradiente verde para avatar com iniciais                  |
| `atvos-wordmark`    | Hanken Grotesk 800, tracking −0.03em, branco              |
| `brand-*`           | Aliases idênticos para código novo                        |
| `bg-brand-gradient` | `linear-gradient(135deg, #059669, #34D399)`               |
| `shadow-brand`      | Sombra verde-suave para botões CTA                        |
| `shadow-card-soft`  | Sombra pinho-suave para cards                             |

### Badges LOTO (paleta de segurança — não alterar)

As cores de `badge-azul`, `badge-amarelo`, `badge-vermelho`, `badge-latao` são fixas
por norma de segurança. Não usar tokens semânticos (`primary`, `accent`) nesses badges.

### Limitação Tailwind v4 — gradientes via `@utility`

`@utility bg-brand-pine` usa `background: var(--gradient-pine)` mas o Tailwind v4 não
expõe utilitários de `background` com gradientes como classe aplicável no JSX quando o
valor é uma CSS variable contendo `linear-gradient`. **Solução:** usar `style` inline
diretamente com o valor do gradiente, não a classe.

```tsx
// ❌ Não funciona com gradiente via CSS variable
<div className="bg-brand-pine">

// ✅ Use inline style
<div style={{ background: "linear-gradient(160deg, #0C3326 0%, #174830 100%)" }}>
```

Afeta apenas `bg-brand-pine` (gradiente). `atvos-topbar` / `brand-topbar` (cor sólida)
funcionam normalmente como classe.

### Regras de nova cor

1. Adicionar em `:root` **e** `.dark` no `src/styles.css`
2. Registrar em `@theme inline` como `--color-<name>: var(--<name>)`
3. Usar o padrão OKLCH (`oklch(L C H)`) — nunca hex direto em `:root`
4. Evitar chroma > 0.25 para não quebrar acessibilidade

### Cores proibidas (resíduos Atvos — não usar)

- `#F79220`, `#E35D12` (laranja Atvos) → substituir por `#34D399` / `#059669`
- `#0A2D48` (navy antigo) → substituir por `#0C3326`
- `"Manrope"` → substituir por `"Hanken Grotesk"`
