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
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-slate-900 rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Editar inspeção</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800">
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
          type="button"
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
