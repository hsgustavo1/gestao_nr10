# Design: Campo PWA Offline + Correções Mobile

**Data**: 2026-06-11  
**Escopo**: 3 melhorias independentes no projeto gestao_nr10

---

## Contexto

O módulo de coleta em campo (`/campo`) é usado por inspetores em áreas industriais, frequentemente sem cobertura de internet. Além disso, a interface mobile do app principal é difícil de navegar, e há um bug que impede o fluxo de captura de fotos no mobile.

---

## Item 1 — Bug de fechamento do dialog ao capturar foto

### Arquivo afetado
`src/routes/campo.inspecao.$id.tsx` — componente `CapturaPontoSheet`

### Causa raiz
Quando o usuário toca em "Tirar foto", o browser abre a câmera nativa do SO. Ao retornar ao browser após capturar a foto, o iOS/Android dispara um evento `pointerdown` ou `touchstart` no documento. O Radix `Dialog` interpreta esse evento como "interação fora do modal" e chama `onOpenChange(false)`. Como `busy` ainda é `false` nesse momento (o usuário não tocou em Salvar), o dialog fecha — descartando tudo que foi preenchido. A foto chegou a ser processada (preview breve aparece) antes do fechamento.

### Fix
1. Adicionar `onInteractOutside={(e) => e.preventDefault()}` ao `DialogContent` do `CapturaPontoSheet`. O dialog passa a ignorar eventos de foco externo — só fecha via botão "Cancelar" ou após salvar com sucesso.
2. Remover `multiple` do input com `capture="environment"`. No iOS, `capture + multiple` não funciona corretamente (o browser ignora a captura ou fecha imediatamente). Dois inputs separados:
   - Câmera: `capture="environment"` sem `multiple`
   - Galeria: `multiple` sem `capture`

### Impacto
Menos de 10 linhas alteradas. Sem alteração de lógica de negócio.

---

## Item 2 — Navegação mobile hierárquica

### Arquivo afetado
`src/components/site-header.tsx`

### Problema
O Sheet mobile exibe ~30 links em lista plana. O usuário precisa rolar toda a lista para encontrar uma rota.

### Solução
Substituir a lista plana por grupos colapsáveis usando `@radix-ui/react-collapsible` (já instalado). Cada grupo espelha os dropdowns do desktop:

| Grupo | Rotas |
|---|---|
| RAC — Bloqueio | dashboard, cadeados, violações, + admin |
| NR-10 | nr10, relatorio, relatorio/dossie, vencimentos, incidentes, + admin |
| RTI | rti, rti/plano, rti/custos, campo, campo/modos, + staff |
| Inspeções | termografias, cercon, spda |
| Pessoas | qualificacoes/*, + admin |
| EPIs e EPCs | epis (item simples, sem grupo) |

**Comportamento**:
- Grupos fechados por padrão
- Grupo da rota ativa inicia aberto
- Fechar o sheet ao navegar (mantido)
- Permissões admin/staff controlam visibilidade dos itens internos (mantido)

### Impacto
Somente `SiteHeader` — bloco do `Sheet`. Os dropdowns do desktop (`RACDropdown`, `NR10Dropdown`, etc.) não mudam.

---

## Item 3 — Campo PWA Offline

### Visão geral
App Vite + React separado em `campo-pwa/` dentro do mesmo repositório. Acessa o mesmo projeto Supabase. Funciona como Progressive Web App instalável no celular com suporte a uso completamente offline.

### Dois fluxos de uso

**Fluxo A (normal)**: Inspetor abre a PWA com internet → app baixa dados para o dispositivo → inspetor vai a campo sem sinal → coleta fotos e achados → ao retornar com sinal, sincroniza automaticamente.

**Fluxo B (emergência)**: App shell já foi cacheado pelo service worker → base de modos de falha já está no IndexedDB → inspetor cria inspeção offline → sincroniza depois.

### Estrutura de diretórios

```
campo-pwa/
├── src/
│   ├── db/
│   │   └── dexie.ts           # Schema IndexedDB via Dexie.js
│   ├── sync/
│   │   └── engine.ts          # Fila de sincronização offline → Supabase
│   ├── lib/
│   │   ├── supabase.ts        # Client Supabase (mesmas credenciais)
│   │   ├── types.ts           # Tipos de domínio (copiados/extraídos do app principal)
│   │   └── campo.ts           # Lógica de árvore (nodePath, filhosDoNo, proximoNivel)
│   ├── pages/
│   │   ├── Login.tsx              # Auth com Supabase
│   │   ├── InspectionList.tsx     # Tela 1: lista de inspeções
│   │   ├── InspectionDetail.tsx   # Tela 2: árvore Setor/Ativo/Componente
│   │   └── PointCapture.tsx       # Tela 3: captura foto-primeiro
│   ├── components/
│   │   ├── SyncStatus.tsx         # Barra de status: Online / N pendentes / Offline
│   │   ├── Layout.tsx             # Shell mobile-first (sem SiteHeader do app principal)
│   │   └── ui/                    # Botões, cards, toasts mínimos
│   ├── sw.ts                  # Service worker (Workbox via vite-plugin-pwa)
│   └── main.tsx
├── public/
│   ├── manifest.json
│   └── icons/                 # ícones PWA (192x192, 512x512)
├── index.html
├── vite.config.ts             # Vite padrão + vite-plugin-pwa
└── package.json
```

### Schema Dexie (IndexedDB)

```typescript
// db/dexie.ts
class CampoDatabase extends Dexie {
  inspections!: Table<FieldInspection & { synced: boolean }>
  nodes!: Table<FieldNode & { synced: boolean }>
  points!: Table<FieldPoint & { synced: boolean }>
  findings!: Table<FieldFinding & { synced: boolean }>
  photos!: Table<FieldPhotoLocal>   // inclui blob: Blob | null
  modos_falha!: Table<RtiModoFalha>
  sync_queue!: Table<SyncQueueItem>
}

type FieldPhotoLocal = FieldPhoto & {
  blob: Blob | null        // foto armazenada localmente
  synced: boolean
  file_path_remote: string | null  // preenchido após upload
}

type SyncQueueItem = {
  id: string              // uuid local
  operation: "insert" | "update" | "delete"
  table: string
  payload: unknown
  attempts: number
  created_at: string
}
```

Índices relevantes:
- `inspections`: `id, synced`
- `photos`: `id, point_id, synced`
- `sync_queue`: `id, created_at, attempts`

### Engine de sincronização (`sync/engine.ts`)

**Download (online → local)**:
```
1. Baixar modos_falha (sempre — pequeno e estático)
2. Baixar todas as field_inspections do usuário
3. Para cada inspeção em_andamento: baixar nodes, points, findings, photos metadata
4. Marcar todos como synced: true
```

**Upload (local → Supabase)**:
```
Processar sync_queue em FIFO order:
1. Para fotos: upload Blob → Storage bucket rti-evidencias/campo/
2. Para registros: INSERT/UPDATE via Supabase client
3. Atualizar synced: true no Dexie
4. Remover item da fila
```

**Detecção de conectividade**:
- `navigator.onLine` + evento `window.online`
- Ao reconectar: inicia upload automaticamente
- Retry: backoff exponencial (1s, 2s, 4s), máximo 3 tentativas
- Após 3 falhas: item fica na fila com `attempts: 3`, exibe aviso ao usuário

**Resolução de conflitos**: last-write-wins. Aceitável para coleta de campo (uma inspeção por inspetor, sem edição concorrente).

### UI da PWA

Layout tela cheia mobile, sem `SiteHeader` do app principal.

**Barra de status (fixa no topo)**:
- 🟢 Online — sincronizado
- 🟡 Online — N itens pendentes (botão "Sincronizar agora")
- 🔴 Offline — N itens pendentes

**Tela 1 — Lista de inspeções**:
- Cards com título, cliente, data, status
- Badge vermelho com contagem de pendentes por inspeção
- Botão "Nova inspeção" (funciona offline)
- Botão "Instalar app" (prompt PWA, visível apenas quando ainda não instalado)

**Tela 2 — Árvore Setor/Ativo/Componente**:
- Mesma lógica de navegação do app principal (`nodePath`, `filhosDoNo`)
- Breadcrumb compacto no topo
- Botão primário "Novo ponto aqui" (destacado, tela cheia mobile)
- Botões para adicionar Setor/Ativo/Componente manualmente

**Tela 3 — Captura do ponto**:
- Câmera ocupa área principal (sem modal — tela inteira)
- Grid de previews abaixo
- Modos de falha em lista expansível por categoria
- Campo "Título" e "Observação" opcionais
- Botão "Salvar ponto" fixo no rodapé
- `onInteractOutside` preventivo (mesmo fix do Item 1)

### Autenticação
- Mesmo Supabase project — inspetor faz login com as mesmas credenciais
- Token armazenado no `localStorage` da PWA
- Sessão mantida offline (Supabase SDK funciona com token local)
- Se sessão expirar offline: usuário vê aviso "Reconecte para renovar sessão"

### Deployment e origem

A `campo-pwa` precisa ser servida na **mesma origem** (`https://mesmo-dominio.com/campo-pwa/`) para compartilhar `localStorage` com o app principal e reaproveitar a sessão do Supabase sem novo login. Se for servida em subdomínio diferente (`campo.site.com`), o inspetor precisará fazer login separado na primeira abertura — o que é aceitável mas menos conveniente.

Recomendação: servir como subrota estática do mesmo deploy (Cloudflare Pages/Workers), com base `/campo-pwa/` configurada no `vite.config.ts` via `base: '/campo-pwa/'`.

### Service worker (Workbox via vite-plugin-pwa)

Estratégias de cache:
- **App shell** (HTML, JS, CSS): `CacheFirst` — nunca busca na rede se já em cache
- **Ícones e manifest**: `CacheFirst`
- **Supabase API calls**: `NetworkFirst` com fallback para cache (para leitura)
- **Uploads de foto**: sempre via fila offline (não passa pelo service worker)

### Integração com o app principal

- Nenhuma alteração no app principal para o Item 3
- O app principal continua sendo a origem dos dados (Supabase)
- Após sincronização, os dados aparecem normalmente no app principal em `/campo`
- Link "Abrir no app de campo" pode ser adicionado futuramente ao app principal

---

## Ordem de implementação sugerida

1. **Item 1** (bug foto) — cirúrgico, ~10 linhas, desbloqueia os inspetores imediatamente
2. **Item 2** (mobile nav) — contido em um arquivo, melhora usabilidade geral
3. **Item 3** (PWA) — novo app, implementado em fases:
   - Fase 1: Scaffold, auth, Dexie schema, sync engine básico (download online → Dexie; upload Dexie → Supabase quando online; sem service worker ainda)
   - Fase 2: Service worker + manifest PWA + cache do app shell
   - Fase 3: Fluxo B (criação offline de emergência) + retry/backoff

---

## O que NÃO está no escopo

- Substituição do `@lovable.dev/vite-tanstack-config` no app principal (ver Roadmap abaixo)
- Compartilhamento de componentes via monorepo/package (complexidade desnecessária agora)
- Resolução de conflitos sofisticada (multi-inspetor no mesmo ponto)
- Edição offline de inspeções já importadas para o RTI

---

## Roadmap — Item Crítico: Desvinculação do Lovable

### Contexto
O app principal (`gestao_nr10`) tem sua configuração Vite encapsulada em `@lovable.dev/vite-tanstack-config`, herança de uma fase inicial de prototipação no Lovable. Existe em paralelo um projeto RAC separado crescendo ativamente no Lovable (com GitHub integrado). A estratégia é:

1. Deixar o projeto RAC no Lovable evoluir normalmente
2. Periodicamente consultar o GitHub do projeto RAC para identificar upgrades relevantes (componentes, configurações, dependências)
3. Portar manualmente os upgrades úteis para o `gestao_nr10`, já desvinculado do Lovable

### Por que é crítico
- `@lovable.dev/vite-tanstack-config` bloqueia adição de plugins Vite (ex.: `vite-plugin-pwa` no app principal, otimizações de bundle, etc.)
- Impede controle total sobre build, SSR e deploy
- Cria dependência de um pacote privado externo sem SLA para projetos fora do ecossistema Lovable
- A `campo-pwa` já nasce desvinculada — o app principal deve seguir o mesmo caminho antes que a divergência fique grande demais

### Plano de desvinculação

**Pré-requisito**: ler o código-fonte de `@lovable.dev/vite-tanstack-config` (via `node_modules`) para mapear exatamente o que ele configura e não perder nenhum comportamento.

**Etapas**:
1. Extrair config equivalente em `vite.config.ts` nativo, incluindo:
   - `@tanstack/router-plugin/vite`
   - `@vitejs/plugin-react`
   - `@tailwindcss/vite`
   - `vite-tsconfig-paths`
   - `@cloudflare/vite-plugin` (build)
   - aliases `@/` e deduplicação React/TanStack
   - injeção de variáveis `VITE_*`
2. Remover `@lovable.dev/vite-tanstack-config` e `@lovable.dev/*` do `package.json`
3. Verificar build local (`vite build`) e dev server (`vite dev`)
4. Verificar deploy no Cloudflare Pages/Workers
5. Remover `componentTagger` (plugin de dev do Lovable, não necessário fora do ambiente deles)

**Quando fazer**: após a entrega dos itens 1, 2 e 3 deste spec — não bloqueia a implementação atual, mas deve preceder qualquer nova funcionalidade que exija plugins Vite adicionais no app principal.

### Consulta ao GitHub do projeto RAC (Lovable)
Antes de cada ciclo de manutenção do `gestao_nr10`:
- Consultar commits recentes do projeto RAC no GitHub
- Identificar upgrades de dependências (React, TanStack, Supabase, shadcn)
- Identificar novos componentes UI reusáveis
- Portar manualmente o que for relevante — sem merge automático (os projetos têm bases de código diferentes)
