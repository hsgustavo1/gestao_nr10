import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '@/db/dexie'
import type { LocalNode } from '@/db/dexie'
import { enqueue } from '@/sync/engine'
import { filhosDoNo, labelDoTipo, proximoNivel } from '@/lib/campo'
import { AlertTriangle, ArrowLeft, Pencil, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { generateId } from '@/lib/uuid'
import { EditMetadataModal } from '@/components/EditMetadataModal'

type Params = { id: string }

function AddNodeModal({
  inspectionId,
  parentId,
  allNodes,
  onClose,
}: {
  inspectionId: string
  parentId: string | null
  allNodes: LocalNode[]
  onClose: () => void
}) {
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)

  const nivel = proximoNivel(
    parentId ? (allNodes.find((n) => n.id === parentId)?.nivel ?? null) : null,
  )
  if (!nivel) return null

  async function handleSave() {
    if (!nome.trim()) return
    setSaving(true)
    const id = generateId()
    const now = new Date().toISOString()
    const siblings = filhosDoNo(parentId, allNodes)
    const node = {
      id,
      inspection_id: inspectionId,
      parent_id: parentId,
      nivel: nivel as NonNullable<typeof nivel>,
      nome: nome.trim(),
      ordem: siblings.length,
      created_at: now,
      updated_at: now,
      _synced: false,
    }
    await db.nodes.add(node)
    await enqueue('nodes', 'insert', node, id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
      <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-4">
        <h2 className="font-semibold">Adicionar {labelDoTipo(nivel)}</h2>
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={`Nome do ${labelDoTipo(nivel).toLowerCase()}`}
          className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-600 py-2.5 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !nome.trim()}
            className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-2.5 text-sm font-semibold"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function NodeRow({
  node,
  allNodes,
  inspectionId,
}: {
  node: LocalNode
  allNodes: LocalNode[]
  inspectionId: string
}) {
  const [showAdd, setShowAdd] = useState(false)
  const children = filhosDoNo(node.id, allNodes)
  const nextLevel = proximoNivel(node.nivel)
  const points = useLiveQuery(
    () => db.points.where('node_id').equals(node.id).sortBy('ordem'),
    [node.id],
  )

  return (
    <div className="pl-4 border-l border-slate-700 mt-2">
      <div className="flex items-center justify-between py-1">
        <span className="text-sm font-medium">{node.nome}</span>
        {nextLevel && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs text-blue-400 flex items-center gap-0.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {labelDoTipo(nextLevel)}
          </button>
        )}
      </div>

      {node.nivel === 'componente' && (
        <div className="space-y-1 mt-1 mb-2">
          {points?.map((pt) => (
            <Link
              key={pt.id}
              to={`/inspecoes/${inspectionId}/ponto/${pt.id}`}
              className="block text-xs rounded-lg bg-slate-700 px-3 py-2 text-slate-300 active:bg-slate-600"
            >
              {pt.titulo ?? 'Ponto sem título'}
            </Link>
          ))}
          <AddPointButton nodeId={node.id} inspectionId={inspectionId} />
        </div>
      )}

      {children.map((child) => (
        <NodeRow key={child.id} node={child} allNodes={allNodes} inspectionId={inspectionId} />
      ))}

      {showAdd && (
        <AddNodeModal
          inspectionId={inspectionId}
          parentId={node.id}
          allNodes={allNodes}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

function AddPointButton({ nodeId, inspectionId }: { nodeId: string; inspectionId: string }) {
  const navigate = useNavigate()
  async function handleAdd() {
    const id = generateId()
    const now = new Date().toISOString()
    const existing = await db.points.where('node_id').equals(nodeId).count()
    const point = {
      id,
      inspection_id: inspectionId,
      node_id: nodeId,
      titulo: null,
      observacoes: null,
      ordem: existing,
      created_at: now,
      updated_at: now,
      _synced: false,
    }
    await db.points.add(point)
    await enqueue('points', 'insert', point, id)
    navigate(`/inspecoes/${inspectionId}/ponto/${id}`)
  }

  return (
    <button
      onClick={handleAdd}
      className="text-xs text-green-400 flex items-center gap-0.5 mt-1"
    >
      <Plus className="h-3.5 w-3.5" />
      Novo ponto
    </button>
  )
}

export default function InspectionDetail() {
  const { id } = useParams<Params>()
  const navigate = useNavigate()
  const [showAddSetor, setShowAddSetor] = useState(false)
  const [showEditMeta, setShowEditMeta] = useState(false)
  const [reopening, setReopening] = useState(false)

  const inspection = useLiveQuery(() => (id ? db.inspections.get(id) : undefined), [id])
  const allNodes = useLiveQuery(
    () => (id ? db.nodes.where('inspection_id').equals(id).toArray() : []),
    [id],
  )
  const pendingSyncCount = useLiveQuery(
    async () => {
      if (!id) return 0
      const unsyncedPoints = await db.points
        .where('inspection_id').equals(id)
        .filter((p) => !p._synced)
        .count()
      if (unsyncedPoints > 0) return unsyncedPoints
      const allPointIds = (await db.points
        .where('inspection_id').equals(id)
        .primaryKeys()) as string[]
      if (allPointIds.length === 0) return 0
      return db.findings
        .where('point_id').anyOf(allPointIds)
        .filter((f) => !f._synced)
        .count()
    },
    [id],
    0,
  )

  const rootNodes = allNodes ? filhosDoNo(null, allNodes) : []

  const isReadOnly = inspection?.status !== 'em_andamento'

  async function handleReopen() {
    if (!inspection || reopening) return
    setReopening(true)
    try {
      const updated = { ...inspection, status: 'em_andamento' as const, _synced: false }
      await db.inspections.put(updated)
      await enqueue('inspections', 'update', updated, inspection.id)
    } finally {
      setReopening(false)
    }
  }

  if (inspection === undefined || allNodes === undefined) return null
  if (!inspection) {
    return (
      <div className="p-8 text-center text-slate-400">
        Inspeção não encontrada.{' '}
        <button onClick={() => navigate('/inspecoes')} className="text-blue-400 underline">
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button
          type="button"
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
        {isReadOnly ? (
          <button
            type="button"
            onClick={handleReopen}
            disabled={reopening}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-semibold disabled:opacity-40 shrink-0"
            aria-label="Reabrir inspeção para edição"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reabrir
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowEditMeta(true)}
            className="p-1.5 rounded-lg hover:bg-slate-800 shrink-0"
            aria-label="Editar inspeção"
          >
            <Pencil className="h-4 w-4 text-slate-400" />
          </button>
        )}
        {!inspection._synced && (
          <span className="text-xs text-yellow-500 shrink-0">● não sync</span>
        )}
      </header>

      {isReadOnly && (pendingSyncCount ?? 0) > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-900/30 border-b border-amber-700/40 text-amber-300 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {pendingSyncCount} alteração{(pendingSyncCount ?? 0) > 1 ? 'ões' : ''} pendente{(pendingSyncCount ?? 0) > 1 ? 's' : ''} não enviada{(pendingSyncCount ?? 0) > 1 ? 's' : ''} ao RTI. Reabra para sincronizar.
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Estrutura
          </p>
          {!isReadOnly && (
            <button
              onClick={() => setShowAddSetor(true)}
              className="text-xs text-blue-400 flex items-center gap-0.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Setor
            </button>
          )}
        </div>

        {rootNodes.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">
            Nenhuma estrutura. Adicione um setor para começar.
          </p>
        )}

        {rootNodes.map((node) => (
          <NodeRow key={node.id} node={node} allNodes={allNodes} inspectionId={id!} />
        ))}
      </div>

      {showAddSetor && (
        <AddNodeModal
          inspectionId={id!}
          parentId={null}
          allNodes={allNodes}
          onClose={() => setShowAddSetor(false)}
        />
      )}
      {showEditMeta && (
        <EditMetadataModal
          inspection={inspection}
          onClose={() => setShowEditMeta(false)}
        />
      )}
    </div>
  )
}
