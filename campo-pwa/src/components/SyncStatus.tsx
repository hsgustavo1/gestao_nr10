import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/dexie'
import { processQueue, retryFailed, MAX_SYNC_ATTEMPTS } from '@/sync/engine'
import { useState } from 'react'

const ZERO = { pending: 0, failed: 0 }

export function SyncStatus() {
  // pending = ainda dentro do limite de tentativas (em backoff ou prontos);
  // failed  = esgotaram MAX_SYNC_ATTEMPTS (dead-letter, exigem ação manual).
  const counts =
    useLiveQuery(async () => {
      const pending = await db.sync_queue.where('attempts').below(MAX_SYNC_ATTEMPTS).count()
      const failed = await db.sync_queue.where('attempts').aboveOrEqual(MAX_SYNC_ATTEMPTS).count()
      return { pending, failed }
    }, []) ?? ZERO
  const { pending: pendingCount, failed: failedCount } = counts
  const isOnline = navigator.onLine
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      await processQueue()
    } finally {
      setSyncing(false)
    }
  }

  async function handleRetry() {
    setSyncing(true)
    try {
      await retryFailed()
    } finally {
      setSyncing(false)
    }
  }

  function plural(n: number) {
    return n === 1 ? 'item' : 'itens'
  }

  if (!isOnline) {
    const total = pendingCount + failedCount
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 text-red-300 text-xs">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        Offline — {total} {plural(total)} aguardando envio
      </div>
    )
  }

  if (failedCount > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-900/40 text-orange-300 text-xs">
        <span className="h-2 w-2 rounded-full bg-orange-400" />
        {failedCount} {plural(failedCount)} com falha após várias tentativas
        <button
          onClick={handleRetry}
          disabled={syncing}
          className="ml-auto underline disabled:opacity-50"
        >
          {syncing ? 'Tentando...' : 'Tentar novamente'}
        </button>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/40 text-yellow-300 text-xs">
        <span className="h-2 w-2 rounded-full bg-yellow-400" />
        {pendingCount} {plural(pendingCount)} {pendingCount === 1 ? 'pendente' : 'pendentes'}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="ml-auto underline disabled:opacity-50"
        >
          {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/40 text-green-300 text-xs">
      <span className="h-2 w-2 rounded-full bg-green-400" />
      Online — sincronizado
    </div>
  )
}
