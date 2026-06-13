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

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [sync])

  return { syncState, lastSyncAt, pendingCount, sync, formatTimeAgo }
}
