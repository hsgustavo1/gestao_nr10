import { supabase } from '@/lib/supabase'
import { db } from '@/db/dexie'
import type { SyncOperation, SyncQueueItem } from '@/db/dexie'

// Dexie table name → Supabase table name
const SUPABASE_TABLES: Record<string, string> = {
  inspections: 'field_inspections',
  nodes: 'field_nodes',
  points: 'field_points',
  findings: 'field_findings',
  photos: 'field_photos',
}

// ── Download: Supabase → Dexie ────────────────────────────────────────────────

export async function downloadAll(): Promise<void> {
  await downloadModosFalha()
  await downloadInspections()
}

async function downloadModosFalha(): Promise<void> {
  const { data, error } = await supabase
    .from('rti_modos_falha')
    .select('*')
    .eq('ativo', true)
  if (error) throw error
  await db.modos_falha.bulkPut(data ?? [])
}

async function downloadInspections(): Promise<void> {
  // RLS handles user filtering — fetch all accessible inspections
  const { data: inspections, error } = await supabase
    .from('field_inspections')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (inspections ?? []).map((i) => ({ ...i, _synced: true as const }))
  await db.inspections.bulkPut(rows)

  const activeIds = rows
    .filter((i) => i.status === 'em_andamento')
    .map((i) => i.id)

  for (const id of activeIds) {
    await downloadInspectionData(id)
  }
}

async function downloadInspectionData(inspectionId: string): Promise<void> {
  // Fetch points first so we can use their IDs for findings/photos
  const { data: pointsData, error: pointsError } = await supabase
    .from('field_points')
    .select('*')
    .eq('inspection_id', inspectionId)
  if (pointsError) throw pointsError

  const pointIds = (pointsData ?? []).map((p: { id: string }) => p.id)

  const [nodesRes, findingsRes, photosRes] = await Promise.all([
    supabase.from('field_nodes').select('*').eq('inspection_id', inspectionId),
    pointIds.length > 0
      ? supabase.from('field_findings').select('*').in('point_id', pointIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    pointIds.length > 0
      ? supabase
          .from('field_photos')
          .select('id, point_id, file_path, file_name, legenda, ordem, created_at')
          .in('point_id', pointIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ])

  if (nodesRes.error) throw nodesRes.error
  if (findingsRes.error) throw findingsRes.error
  if (photosRes.error) throw photosRes.error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fd = findingsRes.data as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pd = photosRes.data as any[]

  await Promise.all([
    db.points.bulkPut((pointsData ?? []).map((p) => ({ ...p, _synced: true }))),
    nodesRes.data
      ? db.nodes.bulkPut(nodesRes.data.map((n) => ({ ...n, _synced: true })))
      : Promise.resolve(),
    fd
      ? db.findings.bulkPut(fd.map((f) => ({ ...f, _synced: true })))
      : Promise.resolve(),
    pd
      ? db.photos.bulkPut(pd.map((p) => ({ ...p, blob: null, _synced: true })))
      : Promise.resolve(),
  ])
}

// ── Enqueue: record local change for later upload ─────────────────────────────

export async function enqueue(
  table: 'inspections' | 'nodes' | 'points' | 'findings' | 'photos',
  operation: SyncOperation,
  payload: unknown,
  localId: string,
): Promise<void> {
  await db.sync_queue.add({
    id: crypto.randomUUID(),
    operation,
    table,
    payload,
    local_id: localId,
    remote_id: null,
    attempts: 0,
    created_at: new Date().toISOString(),
    next_attempt_at: null,
    last_error: null,
  })
}

// ── Upload: sync_queue → Supabase ─────────────────────────────────────────────

/** Após esgotar as tentativas, o item vira dead-letter (visível na UI, não retentado). */
export const MAX_SYNC_ATTEMPTS = 5
const BACKOFF_BASE_MS = 5_000
const BACKOFF_MAX_MS = 5 * 60_000

/** Atraso exponencial antes da próxima tentativa, dado o número de falhas acumuladas. */
function backoffDelayMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_MAX_MS)
}

/** Item pode ser (re)tentado agora? (não esgotou tentativas e o backoff já venceu) */
function isReady(item: SyncQueueItem, now: number): boolean {
  if (item.attempts >= MAX_SYNC_ATTEMPTS) return false
  if (!item.next_attempt_at) return true
  return Date.parse(item.next_attempt_at) <= now
}

// Trava de reentrância: vários gatilhos (online, heartbeat, botão) podem chamar
// processQueue ao mesmo tempo — sem isto, dois envios do mesmo item duplicariam.
let isProcessing = false

export async function processQueue(): Promise<void> {
  if (isProcessing) return
  isProcessing = true
  try {
    const items = await db.sync_queue.orderBy('created_at').toArray()
    const now = Date.now()
    const ready = items.filter((item) => isReady(item, now))

    for (const item of ready) {
      try {
        if (item.table === 'photos') {
          await uploadPhoto(item.local_id)
        } else {
          await uploadRecord(item)
        }
        await db.sync_queue.delete(item.id)
      } catch (err) {
        const attempts = item.attempts + 1
        await db.sync_queue.update(item.id, {
          attempts,
          next_attempt_at: new Date(now + backoffDelayMs(attempts)).toISOString(),
          last_error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } finally {
    isProcessing = false
  }
}

/** Rearma itens que esgotaram as tentativas (dead-letter) para nova tentativa manual. */
export async function retryFailed(): Promise<void> {
  const dead = await db.sync_queue
    .where('attempts')
    .aboveOrEqual(MAX_SYNC_ATTEMPTS)
    .toArray()
  await Promise.all(
    dead.map((item) =>
      db.sync_queue.update(item.id, {
        attempts: 0,
        next_attempt_at: null,
        last_error: null,
      }),
    ),
  )
  await processQueue()
}

function stripLocalFields(payload: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _synced: _s, blob: _b, ...rest } = payload
  return rest
}

async function uploadRecord(item: {
  id: string
  operation: SyncOperation
  table: string
  payload: unknown
}): Promise<void> {
  const supabaseTable = SUPABASE_TABLES[item.table]
  if (!supabaseTable) throw new Error(`Unknown table: ${item.table}`)

  const raw = item.payload as Record<string, unknown>
  const payload = stripLocalFields(raw)

  if (item.operation === 'insert') {
    const { error } = await supabase.from(supabaseTable).insert(payload)
    if (error) throw error
  } else if (item.operation === 'update') {
    const { id, ...rest } = payload
    const { error } = await supabase.from(supabaseTable).update(rest).eq('id', id)
    if (error) throw error
  } else if (item.operation === 'delete') {
    const { error } = await supabase.from(supabaseTable).delete().eq('id', payload['id'])
    if (error) throw error
  }
}

async function uploadPhoto(localId: string): Promise<void> {
  const photo = await db.photos.get(localId)
  if (!photo?.blob) throw new Error(`Blob not found for photo ${localId}`)

  const ext = photo.blob.type.split('/')[1] ?? 'jpg'
  const remotePath = `campo/${localId}.${ext}`

  const { error: storageError } = await supabase.storage
    .from('rti-evidencias')
    .upload(remotePath, photo.blob, { contentType: photo.blob.type, upsert: true })
  if (storageError) throw storageError

  const { error: dbError } = await supabase.from('field_photos').insert({
    id: photo.id,
    point_id: photo.point_id,
    file_path: remotePath,
    file_name: photo.file_name,
    legenda: photo.legenda,
    ordem: photo.ordem,
    created_at: photo.created_at,
  })
  if (dbError) throw dbError

  await db.photos.update(localId, { file_path: remotePath, _synced: true })
}

// ── Connectivity watcher ──────────────────────────────────────────────────────

/** Heartbeat: reprocessa itens cujo backoff venceu sem depender de evento `online`. */
const SYNC_HEARTBEAT_MS = 30_000

export function startConnectivityWatcher(): () => void {
  const flush = () => {
    if (navigator.onLine) {
      processQueue().catch(console.error)
    }
  }
  // Flush imediato ao montar: esvazia a fila criada offline quando o app
  // reabre já online (o evento `online` não dispara nesse caso).
  flush()
  window.addEventListener('online', flush)
  const heartbeat = window.setInterval(flush, SYNC_HEARTBEAT_MS)
  return () => {
    window.removeEventListener('online', flush)
    window.clearInterval(heartbeat)
  }
}
