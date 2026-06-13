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
  const [titulo, setTitulo] = useState(
    () => `Inspeção ${new Date().toISOString().slice(0, 10)}`
  )
  const [cliente, setCliente] = useState('')
  const [local, setLocal] = useState('')
  const [engenheiro, setEngenheiro] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (cancelled) return
        setEngenheiro(data.user?.user_metadata?.full_name ?? data.user?.email ?? '')
      } catch {
        // Offline or unauthenticated — silently degrade; engenheiro stays ''
      }
    })()
    return () => { cancelled = true }
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-slate-900 rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Nova inspeção</h2>
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
          type="button"
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
