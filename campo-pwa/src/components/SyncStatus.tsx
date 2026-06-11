import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/dexie'
import { processQueue } from '@/sync/engine'
import { useState } from 'react'

export function SyncStatus() {
  const pendingCount = useLiveQuery(() => db.sync_queue.count(), []) ?? 0
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

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 text-red-300 text-xs">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        Offline — {pendingCount} {pendingCount === 1 ? 'item pendente' : 'itens pendentes'}
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/40 text-yellow-300 text-xs">
        <span className="h-2 w-2 rounded-full bg-yellow-400" />
        {pendingCount} {pendingCount === 1 ? 'item pendente' : 'itens pendentes'}
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
