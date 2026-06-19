# campo-pwa: Integração e Melhorias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar form de criação de inspeção com metadados, sync automático com status visível, edição de metadados inline no detalhe, e pacote de tipos compartilhados entre campo-pwa e app principal.

**Architecture:** 3 novos componentes React + 1 hook em campo-pwa. Sync melhorado adicionando `downloadAll()` no `online` event (engine.ts) e `visibilitychange` (useSyncStatus). Shared types via path alias Vite/TS apontando para `packages/campo-core/src/` — sem npm workspaces.

**Tech Stack:** Vite 6 · React 19 · TypeScript 5.8 · Dexie 4 · Supabase JS v2 · TailwindCSS v4 · lucide-react · react-router-dom v7

---

## ⚠️ GateGuard Hook

Antes do **primeiro** Edit/Write em cada arquivo novo desta sessão, declare como texto:
1. Quem importa / chama este arquivo
2. Qual API é afetada
3. Schema de dados envolvido
4. Instrução verbatim do usuário

---

## Mapa de Arquivos

| Ação | Caminho | Responsabilidade |
|------|---------|-----------------|
| Criar | `campo-pwa/src/components/CreateInspectionModal.tsx` | Bottom sheet de criação com form |
| Criar | `campo-pwa/src/hooks/useSyncStatus.ts` | Estado de sync + visibilitychange trigger |
| Criar | `campo-pwa/src/components/EditMetadataModal.tsx` | Modal edição de título/cliente/local |
| Criar | `packages/campo-core/src/types.ts` | Tipos espelho do schema Supabase |
| Criar | `packages/campo-core/src/helpers.ts` | Helpers de árvore (re-export de campo-pwa) |
| Criar | `packages/campo-core/src/index.ts` | Re-exports do pacote |
| Modificar | `campo-pwa/src/pages/InspectionList.tsx` | Usa modal + useSyncStatus header |
| Modificar | `campo-pwa/src/pages/InspectionDetail.tsx` | Header editável + EditMetadataModal |
| Modificar | `campo-pwa/src/sync/engine.ts` | downloadAll() no evento online |

---

## Task 1: CreateInspectionModal

**Files:**
- Create: `campo-pwa/src/components/CreateInspectionModal.tsx`
- Modify: `campo-pwa/src/pages/InspectionList.tsx`

**Contexto:** `InspectionList.tsx` hoje cria inspeção diretamente no `handleNewInspection` sem perguntar nada. Vamos substituir por um bottom sheet modal com form.

O campo `engenheiro` é **sempre read-only** — populado via `supabase.auth.getUser()` → `user?.user_metadata?.full_name ?? user?.email`. Nunca é um campo livre.

- [ ] **Step 1.1: Criar CreateInspectionModal.tsx**

```tsx
// campo-pwa/src/components/CreateInspectionModal.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/dexie'
import { enqueue } from '@/sync/engine'
import { generateId } from '@/lib/uuid'
import { supabase } from '@/lib/supabase'
import { X } from 'lucide-react'

type Props = { onClose: () => void }

export function CreateInspectionModal({ onClose }: Props) {
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 10)
  const [titulo, setTitulo] = useState(`Inspeção ${today}`)
  const [cliente, setCliente] = useState('')
  const [local, setLocal] = useState('')
  const [engenheiro, setEngenheiro] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name ?? data.user?.email ?? ''
      setEngenheiro(name)
    })
  }, [])

  async function handleCreate() {
    if (!titulo.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const id = generateId()
      const now = new Date().toISOString()
      const inspection = {
        id,
        titulo: titulo.trim(),
        cliente: cliente.trim() || null,
        local: local.trim() || null,
        engenheiro: engenheiro || null,
        data_inspecao: now,
        status: 'em_andamento' as const,
        report_id: null,
        notes: null,
        created_by_name: engenheiro || null,
        created_at: now,
        updated_at: now,
        _synced: false,
      }
      await db.inspections.add(inspection)
      await enqueue('inspections', 'insert', inspection, id)
      navigate(`/inspecoes/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar inspeção')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-slate-900 rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Nova inspeção</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-slate-400">Título *</span>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Cliente</span>
            <input
              type="text"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Local</span>
            <input
              type="text"
              value={local}
              onChange={e => setLocal(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Engenheiro</span>
            <input
              type="text"
              value={engenheiro}
              readOnly
              className="mt-1 w-full rounded-lg bg-slate-800/50 px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed"
            />
          </label>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={!titulo.trim() || saving}
          className="w-full flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 px-4 py-3.5 font-semibold transition-colors"
        >
          {saving ? 'Criando...' : 'Criar inspeção'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 1.2: Reescrever InspectionList.tsx**

Substituir completamente o conteúdo atual (remove `creating`/`createError`/`handleNewInspection`, adiciona `showModal`):

```tsx
// campo-pwa/src/pages/InspectionList.tsx
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '@/db/dexie'
import { supabase } from '@/lib/supabase'
import { downloadAll } from '@/sync/engine'
import { Plus, LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { CreateInspectionModal } from '@/components/CreateInspectionModal'

const STATUS_LABEL: Record<string, string> = {
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
  importada: 'Importada',
}

const STATUS_COLOR: Record<string, string> = {
  em_andamento: 'bg-blue-900/50 text-blue-300',
  finalizada: 'bg-green-900/50 text-green-300',
  importada: 'bg-slate-700 text-slate-400',
}

export default function InspectionList() {
  const navigate = useNavigate()
  const inspections = useLiveQuery(
    () => db.inspections.orderBy('created_at').reverse().toArray(),
    [],
  )
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await downloadAll()
    } finally {
      setRefreshing(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h1 className="font-semibold text-lg">Inspeções</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || !navigator.onLine}
            className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-40"
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-slate-800"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {inspections === undefined && (
          <p className="text-slate-400 text-sm text-center pt-8">Carregando...</p>
        )}
        {inspections?.length === 0 && (
          <p className="text-slate-400 text-sm text-center pt-8">
            Nenhuma inspeção. Crie uma nova.
          </p>
        )}
        {inspections?.map((insp) => (
          <Link
            key={insp.id}
            to={`/inspecoes/${insp.id}`}
            className="block rounded-xl bg-slate-800 p-4 active:bg-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{insp.titulo}</p>
                {insp.cliente && (
                  <p className="text-sm text-slate-400 mt-0.5">{insp.cliente}</p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[insp.status] ?? 'bg-slate-700 text-slate-400'}`}
              >
                {STATUS_LABEL[insp.status] ?? insp.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {new Date(insp.data_inspecao).toLocaleDateString('pt-BR')}
              {!insp._synced && (
                <span className="ml-2 text-yellow-500">● não sincronizado</span>
              )}
            </p>
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 px-4 py-3.5 font-semibold transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nova inspeção
        </button>
      </div>

      {showModal && <CreateInspectionModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
```

- [ ] **Step 1.3: Verificar manualmente no celular**

Abrir campo-pwa → clicar "Nova inspeção" → bottom sheet abre com título (pré-preenchido com data), cliente, local, engenheiro (email do usuário, somente leitura) → criar → navega para a inspeção.

- [ ] **Step 1.4: Commit**

```bash
git add campo-pwa/src/components/CreateInspectionModal.tsx campo-pwa/src/pages/InspectionList.tsx
git commit -m "feat(campo-pwa): modal de criação com título, cliente, local e engenheiro do login"
```

---

## Task 2: useSyncStatus + sync automático por visibilidade

**Files:**
- Create: `campo-pwa/src/hooks/useSyncStatus.ts`
- Modify: `campo-pwa/src/sync/engine.ts` (adicionar `downloadAll()` no evento `online`)
- Modify: `campo-pwa/src/pages/InspectionList.tsx` (header com status de sync)

**Contexto:** `startConnectivityWatcher()` em `engine.ts` (linha 252) chama apenas `processQueue()` no evento `online` e a cada 30s. `downloadAll()` nunca é chamado automaticamente depois da montagem — por isso inspeções criadas no app principal não aparecem no celular até clique manual de "Atualizar".

Solução em duas partes:
1. Adicionar `downloadAll()` na função `flush` dentro de `startConnectivityWatcher` (cobre o evento `online`)
2. Criar `useSyncStatus` hook que adiciona `visibilitychange` listener chamando `downloadAll()` (cobre o retorno ao foreground)

- [ ] **Step 2.1: Adicionar downloadAll() no evento online em engine.ts**

Localizar a função `flush` dentro de `startConnectivityWatcher()` (aproximadamente linha 253) e substituir:

```ts
// ANTES (linhas 253-256):
  const flush = () => {
    if (navigator.onLine) {
      processQueue().catch(console.error)
    }
  }

// DEPOIS:
  const flush = () => {
    if (navigator.onLine) {
      processQueue().catch(console.error)
      downloadAll().catch(console.error)
    }
  }
```

- [ ] **Step 2.2: Criar useSyncStatus.ts**

```ts
// campo-pwa/src/hooks/useSyncStatus.ts
import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/dexie'
import { downloadAll, processQueue } from '@/sync/engine'

const LAST_SYNC_KEY = 'campo-last-sync-at'

export type SyncState = 'idle' | 'syncing' | 'error'

export function formatTimeAgo(date: Date | null): string {
  if (!date) return 'Nunca sincronizado'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Agora mesmo'
  if (diffMin === 1) return 'Há 1 min'
  if (diffMin < 60) return `Há ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH === 1) return 'Há 1 hora'
  return `Há ${diffH} horas`
}

export function useSyncStatus() {
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(() => {
    const stored = localStorage.getItem(LAST_SYNC_KEY)
    return stored ? new Date(stored) : null
  })

  const pendingCount = useLiveQuery(() => db.sync_queue.count(), [], 0)

  const sync = useCallback(async () => {
    if (!navigator.onLine) return
    setSyncState('syncing')
    try {
      await downloadAll()
      await processQueue()
      const now = new Date()
      setLastSyncAt(now)
      localStorage.setItem(LAST_SYNC_KEY, now.toISOString())
      setSyncState('idle')
    } catch {
      setSyncState('error')
    }
  }, [])

  // Sync ao voltar ao foreground (minimizar app e reabrir, ou bloquear/desbloquear tela)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [sync])

  return { syncState, lastSyncAt, pendingCount, sync, formatTimeAgo }
}
```

- [ ] **Step 2.3: Atualizar InspectionList.tsx — adicionar useSyncStatus e redesenhar header**

Substituir o conteúdo de `InspectionList.tsx` (que foi reescrito no Task 1):

```tsx
// campo-pwa/src/pages/InspectionList.tsx
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '@/db/dexie'
import { supabase } from '@/lib/supabase'
import { Plus, LogOut, RefreshCw, Cloud, CloudOff } from 'lucide-react'
import { useState } from 'react'
import { CreateInspectionModal } from '@/components/CreateInspectionModal'
import { useSyncStatus } from '@/hooks/useSyncStatus'

const STATUS_LABEL: Record<string, string> = {
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
  importada: 'Importada',
}

const STATUS_COLOR: Record<string, string> = {
  em_andamento: 'bg-blue-900/50 text-blue-300',
  finalizada: 'bg-green-900/50 text-green-300',
  importada: 'bg-slate-700 text-slate-400',
}

export default function InspectionList() {
  const navigate = useNavigate()
  const inspections = useLiveQuery(
    () => db.inspections.orderBy('created_at').reverse().toArray(),
    [],
  )
  const [showModal, setShowModal] = useState(false)
  const { syncState, lastSyncAt, pendingCount, sync, formatTimeAgo } = useSyncStatus()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-col gap-1 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-lg">Inspeções</h1>
          <div className="flex gap-2">
            <button
              onClick={sync}
              disabled={syncState === 'syncing' || !navigator.onLine}
              className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-40"
              aria-label="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-slate-800"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          {navigator.onLine ? (
            <Cloud className="h-3 w-3 text-green-500" />
          ) : (
            <CloudOff className="h-3 w-3 text-slate-500" />
          )}
          <span>{formatTimeAgo(lastSyncAt)}</span>
          {(pendingCount ?? 0) > 0 && (
            <span className="ml-1 text-yellow-500">
              · {pendingCount} pendente{(pendingCount ?? 0) > 1 ? 's' : ''}
            </span>
          )}
          {syncState === 'error' && (
            <span className="ml-1 text-red-400">· Erro ao sincronizar</span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {inspections === undefined && (
          <p className="text-slate-400 text-sm text-center pt-8">Carregando...</p>
        )}
        {inspections?.length === 0 && (
          <p className="text-slate-400 text-sm text-center pt-8">
            Nenhuma inspeção. Crie uma nova.
          </p>
        )}
        {inspections?.map((insp) => (
          <Link
            key={insp.id}
            to={`/inspecoes/${insp.id}`}
            className="block rounded-xl bg-slate-800 p-4 active:bg-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{insp.titulo}</p>
                {insp.cliente && (
                  <p className="text-sm text-slate-400 mt-0.5">{insp.cliente}</p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[insp.status] ?? 'bg-slate-700 text-slate-400'}`}
              >
                {STATUS_LABEL[insp.status] ?? insp.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {new Date(insp.data_inspecao).toLocaleDateString('pt-BR')}
              {!insp._synced && (
                <span className="ml-2 text-yellow-500">● não sincronizado</span>
              )}
            </p>
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 px-4 py-3.5 font-semibold transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nova inspeção
        </button>
      </div>

      {showModal && <CreateInspectionModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
```

- [ ] **Step 2.4: Verificar no celular**

1. Header mostra ícone de nuvem + "Nunca sincronizado" (primeira vez) ou timestamp da última sync
2. Criar inspeção no app principal → minimizar campo-pwa no celular e reabrir → inspeção deve aparecer automaticamente (via visibilitychange)
3. Clicar ⟳ manualmente → spinner enquanto sincroniza → timestamp atualiza

- [ ] **Step 2.5: Commit**

```bash
git add campo-pwa/src/hooks/useSyncStatus.ts campo-pwa/src/pages/InspectionList.tsx campo-pwa/src/sync/engine.ts
git commit -m "feat(campo-pwa): sync automático ao voltar ao foreground + status visível na header"
```

---

## Task 3: EditMetadataModal + header editável no InspectionDetail

**Files:**
- Create: `campo-pwa/src/components/EditMetadataModal.tsx`
- Modify: `campo-pwa/src/pages/InspectionDetail.tsx`

**Contexto:** `InspectionDetail.tsx` mostra o header da inspeção em linha 209. Adicionamos um botão ✎ que abre `EditMetadataModal` para editar título, cliente e local. `engenheiro` é sempre read-only (do auth). Salva no Dexie + enfileira para sync.

O tipo `LocalInspection` é exportado de `@/db/dexie` (é `FieldInspection & { _synced: boolean }`).

- [ ] **Step 3.1: Criar EditMetadataModal.tsx**

```tsx
// campo-pwa/src/components/EditMetadataModal.tsx
import { useState } from 'react'
import { db } from '@/db/dexie'
import type { LocalInspection } from '@/db/dexie'
import { enqueue } from '@/sync/engine'
import { X } from 'lucide-react'

type Props = {
  inspection: LocalInspection
  onClose: () => void
}

export function EditMetadataModal({ inspection, onClose }: Props) {
  const [titulo, setTitulo] = useState(inspection.titulo)
  const [cliente, setCliente] = useState(inspection.cliente ?? '')
  const [local, setLocal] = useState(inspection.local ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!titulo.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const updated = {
        titulo: titulo.trim(),
        cliente: cliente.trim() || null,
        local: local.trim() || null,
        updated_at: new Date().toISOString(),
        _synced: false,
      }
      await db.inspections.update(inspection.id, updated)
      await enqueue('inspections', 'update', { id: inspection.id, ...updated }, inspection.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-slate-900 rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Editar inspeção</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-slate-400">Título *</span>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Cliente</span>
            <input
              type="text"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Local</span>
            <input
              type="text"
              value={local}
              onChange={e => setLocal(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!titulo.trim() || saving}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-4 py-3.5 font-semibold transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
```

> **Nota sobre LocalInspection:** Verificar se `LocalInspection` está exportado em `campo-pwa/src/db/dexie.ts`. Se não existir com esse nome, usar o tipo correto que representa `FieldInspection & { _synced: boolean }` conforme definido no arquivo.

- [ ] **Step 3.2: Atualizar InspectionDetail.tsx**

Adicionar os imports ao topo do arquivo (após os imports existentes):

```tsx
import { Pencil } from 'lucide-react'
import { EditMetadataModal } from '@/components/EditMetadataModal'
```

Adicionar estado dentro do componente `InspectionDetail` (após `const [showAddSetor, setShowAddSetor] = useState(false)`):

```tsx
const [showEditMeta, setShowEditMeta] = useState(false)
```

Substituir o `<header>` atual (linhas 209–226 no arquivo atual):

```tsx
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button
          onClick={() => navigate('/inspecoes')}
          className="p-1 rounded-lg hover:bg-slate-800"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{inspection.titulo}</h1>
          {(inspection.cliente || inspection.local) && (
            <p className="text-xs text-slate-400 truncate">
              {[inspection.cliente, inspection.local].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowEditMeta(true)}
          className="p-1.5 rounded-lg hover:bg-slate-800 shrink-0"
          aria-label="Editar metadados"
        >
          <Pencil className="h-4 w-4 text-slate-400" />
        </button>
        {!inspection._synced && (
          <span className="text-xs text-yellow-500 shrink-0">● não sync</span>
        )}
      </header>
```

Adicionar o modal ao return, antes do `</div>` de fechamento final (após o `{showAddSetor && ...}`):

```tsx
      {showEditMeta && (
        <EditMetadataModal
          inspection={inspection}
          onClose={() => setShowEditMeta(false)}
        />
      )}
```

- [ ] **Step 3.3: Verificar no celular**

Abrir inspeção → ver ícone de lápis na header → clicar → modal abre com dados atuais → editar título → salvar → header atualiza (Dexie LiveQuery) → indicador `● não sync` aparece → após sync, indicador some.

- [ ] **Step 3.4: Commit**

```bash
git add campo-pwa/src/components/EditMetadataModal.tsx campo-pwa/src/pages/InspectionDetail.tsx
git commit -m "feat(campo-pwa): edição de título, cliente e local diretamente pelo celular"
```

---

## Task 4: Shared Types Package (packages/campo-core)

**Objetivo:** Eliminar drift silencioso entre tipos TypeScript do campo-pwa e do app principal. Qualquer mudança no schema Supabase passa a gerar erros de compilação nos dois apps.

**Abordagem:** Path alias — sem npm workspaces. Ambos os apps resolvem `@gestao/campo-core` via alias Vite apontando para `packages/campo-core/src/index.ts`.

**Pré-requisito:** Verificar quais tipos existem atualmente em `campo-pwa/src/lib/types.ts` e `src/lib/campo.ts` antes de criar o pacote, para não omitir nenhum.

- [ ] **Step 4.1: Criar packages/campo-core/src/types.ts**

```ts
// packages/campo-core/src/types.ts

export type FieldInspectionStatus = 'em_andamento' | 'finalizada' | 'importada'

export type FieldInspection = {
  id: string
  titulo: string
  cliente: string | null
  local: string | null
  engenheiro: string | null
  data_inspecao: string
  status: FieldInspectionStatus
  report_id: string | null
  notes: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type NodeType = 'setor' | 'ativo' | 'componente'

export type FieldNode = {
  id: string
  inspection_id: string
  parent_id: string | null
  nivel: NodeType
  nome: string
  ordem: number
  created_at: string
  updated_at: string
}

export type FieldPoint = {
  id: string
  inspection_id: string
  node_id: string
  titulo: string | null
  observacoes: string | null
  ordem: number
  created_at: string
  updated_at: string
}

export type RtiTipoExecucao = 'os' | 'pdm' | 'imediato' | 'desativacao'

export type FieldFinding = {
  id: string
  point_id: string
  modo_falha_id: string | null
  descricao: string
  recomendacao: string | null
  prioridade: number
  tipo_execucao: RtiTipoExecucao
  created_at: string
  updated_at: string
}

export type FieldPhoto = {
  id: string
  point_id: string
  file_path: string | null
  file_name: string | null
  legenda: string | null
  ordem: number
  created_at: string
}

export type NormaRef = {
  norma: string
  item: string
}

export type RtiModoFalha = {
  id: string
  label: string
  categoria: string
  descricao_padrao: string
  recomendacao_padrao: string | null
  prioridade_sugerida: number
  tipo_execucao_sugerido: RtiTipoExecucao
  normas: NormaRef[]
  ordem: number
  ativo: boolean
}
```

> **Nota:** Verificar contra `campo-pwa/src/lib/types.ts` e `src/lib/campo.ts` antes de criar. Adicionar quaisquer tipos extras encontrados nesses arquivos.

- [ ] **Step 4.2: Criar packages/campo-core/src/helpers.ts**

As funções aceitam `FieldNode` (tipo base). Como `LocalNode` é `FieldNode & { _synced: boolean }`, é compatível estruturalmente — não é necessário genérico.

```ts
// packages/campo-core/src/helpers.ts
import type { FieldNode, NodeType, RtiModoFalha } from './types'

export function proximoNivel(tipo: NodeType | null): NodeType | null {
  if (tipo === null) return 'setor'
  if (tipo === 'setor') return 'ativo'
  if (tipo === 'ativo') return 'componente'
  return null
}

export function labelDoTipo(tipo: NodeType | null): string {
  if (tipo === 'setor') return 'Setor'
  if (tipo === 'ativo') return 'Ativo'
  if (tipo === 'componente') return 'Componente'
  return 'Item'
}

export function nodePath(nodeId: string, allNodes: FieldNode[]): FieldNode[] {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  const path: FieldNode[] = []
  let current = nodeMap.get(nodeId)
  let guard = 0
  while (current && guard++ < 10) {
    path.unshift(current)
    current = current.parent_id ? nodeMap.get(current.parent_id) : undefined
  }
  return path
}

export function filhosDoNo(parentId: string | null, allNodes: FieldNode[]): FieldNode[] {
  return allNodes
    .filter((n) => n.parent_id === parentId)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
}

export function modosPorCategoria(modos: RtiModoFalha[]): Map<string, RtiModoFalha[]> {
  const map = new Map<string, RtiModoFalha[]>()
  for (const m of [...modos].sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))) {
    if (!m.ativo) continue
    const arr = map.get(m.categoria)
    if (arr) arr.push(m)
    else map.set(m.categoria, [m])
  }
  return map
}
```

- [ ] **Step 4.3: Criar packages/campo-core/src/index.ts**

```ts
// packages/campo-core/src/index.ts
export * from './types'
export * from './helpers'
```

- [ ] **Step 4.4: Adicionar alias no campo-pwa/vite.config.ts**

No bloco `resolve.alias`, adicionar após a entrada `@`:

```ts
'@gestao/campo-core': path.resolve(__dirname, '../packages/campo-core/src/index.ts'),
```

Resultado esperado:

```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@gestao/campo-core': path.resolve(__dirname, '../packages/campo-core/src/index.ts'),
  },
},
```

- [ ] **Step 4.5: Adicionar path mapping no campo-pwa/tsconfig.app.json**

Localizar (ou criar) a chave `paths` dentro de `compilerOptions`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@gestao/campo-core": ["../packages/campo-core/src/index.ts"]
    }
  }
}
```

- [ ] **Step 4.6: Repetir alias para o app principal**

No `vite.config.ts` da raiz, adicionar ao `resolve.alias`:

```ts
'@gestao/campo-core': path.resolve(__dirname, './packages/campo-core/src/index.ts'),
```

No `tsconfig.app.json` da raiz (verificar o nome correto do arquivo — pode ser `tsconfig.json`):

```json
"@gestao/campo-core": ["./packages/campo-core/src/index.ts"]
```

- [ ] **Step 4.7: Atualizar campo-pwa/src/lib/types.ts para re-exportar**

Substituir todo o conteúdo por re-exports:

```ts
// campo-pwa/src/lib/types.ts
// Tipos de domínio agora vivem em packages/campo-core.
// Modificações devem ser feitas em packages/campo-core/src/types.ts.
export type {
  FieldInspection,
  FieldInspectionStatus,
  FieldNode,
  FieldPoint,
  FieldFinding,
  FieldPhoto,
  RtiModoFalha,
  RtiTipoExecucao,
  NodeType,
  NormaRef,
} from '@gestao/campo-core'
```

- [ ] **Step 4.8: Atualizar campo-pwa/src/lib/campo.ts para re-exportar helpers compartilhados**

Verificar o conteúdo atual do arquivo antes de editar. Substituir as funções que estão em `packages/campo-core/src/helpers.ts` por re-exports, e manter locais apenas as funções que dependem de `LocalNode` (tipo com `_synced`):

```ts
// campo-pwa/src/lib/campo.ts
// Helpers de árvore compartilhados agora vivem em packages/campo-core.
export { proximoNivel, labelDoTipo, nodePath, filhosDoNo, modosPorCategoria } from '@gestao/campo-core'

// Helpers exclusivos do campo-pwa (dependem de LocalNode com _synced):
import type { LocalNode } from '@/db/dexie'
import { nodePath } from '@gestao/campo-core'
import type { NormaRef } from '@gestao/campo-core'

export function setorDoNo(nodeId: string, allNodes: LocalNode[]): LocalNode | null {
  const path = nodePath(nodeId, allNodes)
  return (path[0] ?? null) as LocalNode | null
}

export function caminhoAbaixoDoSetor(nodeId: string, allNodes: LocalNode[]): string {
  const path = nodePath(nodeId, allNodes)
  return path
    .slice(1)
    .map((n) => n.nome)
    .join(' › ')
}

export function formatNormas(normas: NormaRef[]): string {
  return normas
    .map((n) => (n.item && n.item !== '—' ? `${n.norma} ${n.item}` : n.norma))
    .join(' · ')
}
```

> **Nota:** Se `setorDoNo`, `caminhoAbaixoDoSetor`, ou `formatNormas` não existirem no arquivo atual, não adicioná-los. Exportar apenas o que já estava lá.

- [ ] **Step 4.9: Verificar build dos dois apps**

```bash
cd campo-pwa && npx tsc --noEmit
```

```bash
# Voltar para a raiz e verificar o app principal:
npx tsc --noEmit
```

Ambos devem completar sem erros. Se houver erros, significa que um tipo precisa ser adicionado ao pacote ou que algum import ainda está usando o caminho antigo.

- [ ] **Step 4.10: Commit**

```bash
git add packages/ campo-pwa/src/lib/types.ts campo-pwa/src/lib/campo.ts campo-pwa/vite.config.ts campo-pwa/tsconfig.app.json vite.config.ts
git commit -m "refactor: tipos e helpers de domínio extraídos para packages/campo-core"
```

---

## Verificação End-to-End

1. **Form de criação:** celular → "Nova inspeção" → bottom sheet com título pré-preenchido e engenheiro read-only → criar → inspeção aparece na lista
2. **Sync automático:** criar inspeção no app principal → minimizar e reabrir campo-pwa no celular → inspeção aparece sem clicar em nada
3. **Status de sync:** header mostra ícone de nuvem + timestamp + contador de pendentes
4. **Edição offline:** celular sem sinal → editar título de inspeção → `● não sync` aparece → ao reconectar, sync automático remove o indicador
5. **Shared types:** `cd campo-pwa && npx tsc --noEmit` e `npx tsc --noEmit` na raiz — ambos sem erros

---

## Fase 2 (fora do escopo atual)

**Gerenciamento de perfil no app principal:** aba de configurações onde o usuário cadastra nome completo, número de CREA/CRBIO, cargo. Esses dados populam `engenheiro` automaticamente no campo-pwa. Enquanto não implementado, o campo usa `user?.user_metadata?.full_name ?? user?.email`.
