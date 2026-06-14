import Dexie, { type Table } from 'dexie'
import type {
  FieldInspection, FieldNode, FieldPoint, FieldFinding, FieldPhoto, RtiModoFalha,
} from '@/lib/types'

export type SyncOperation = 'insert' | 'update' | 'delete'

export interface SyncQueueItem {
  id: string
  operation: SyncOperation
  table: 'inspections' | 'nodes' | 'points' | 'findings' | 'photos'
  payload: unknown
  local_id: string
  remote_id: string | null
  attempts: number
  created_at: string
  // Backoff: instante (ISO) a partir do qual o item pode ser retentado.
  // Opcional — itens gravados antes do backoff não têm o campo (= pronto já).
  next_attempt_at?: string | null
  // Última mensagem de erro, para diagnóstico de itens em dead-letter.
  last_error?: string | null
}

export type LocalInspection = FieldInspection & { _synced: boolean }
export type LocalNode = FieldNode & { _synced: boolean }
export type LocalPoint = FieldPoint & { _synced: boolean }
export type LocalFinding = FieldFinding & { _synced: boolean }
export type LocalPhoto = Omit<FieldPhoto, 'file_path'> & {
  file_path: string | null
  blob: Blob | null
  _synced: boolean
}
export type LocalModoFalha = RtiModoFalha

class CampoDatabase extends Dexie {
  inspections!: Table<LocalInspection>
  nodes!: Table<LocalNode>
  points!: Table<LocalPoint>
  findings!: Table<LocalFinding>
  photos!: Table<LocalPhoto>
  modos_falha!: Table<LocalModoFalha>
  sync_queue!: Table<SyncQueueItem>

  constructor() {
    super('campo-nr10')
    this.version(2).stores({
      inspections: 'id, _synced, status, responsavel_id, created_at',
      nodes: 'id, inspection_id, parent_id, _synced',
      points: 'id, inspection_id, node_id, _synced',
      findings: 'id, point_id, _synced',
      photos: 'id, point_id, _synced',
      modos_falha: 'id, categoria',
      sync_queue: '++id, created_at, attempts, table',
    })
  }
}

export const db = new CampoDatabase()

// If another tab holds the old DB version open and blocks our upgrade, reload to break the deadlock.
db.on('blocked', () => {
  window.location.reload()
})

// If this tab is superseded by a newer DB version opened elsewhere, close our connection so the upgrade can proceed.
db.on('versionchange', () => {
  db.close()
  window.location.reload()
})
