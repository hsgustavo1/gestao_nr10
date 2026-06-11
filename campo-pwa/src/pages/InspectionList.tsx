import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '@/db/dexie'
import { supabase } from '@/lib/supabase'
import { downloadAll, enqueue } from '@/sync/engine'
import { Plus, LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'

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

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await downloadAll()
    } finally {
      setRefreshing(false)
    }
  }

  async function handleNewInspection() {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const inspection = {
      id,
      titulo: `Inspeção ${now.slice(0, 10)}`,
      cliente: null,
      local: null,
      engenheiro: null,
      data_inspecao: now,
      status: 'em_andamento' as const,
      report_id: null,
      notes: null,
      created_by_name: null,
      created_at: now,
      updated_at: now,
      _synced: false,
    }
    await db.inspections.add(inspection)
    await enqueue('inspections', 'insert', inspection, id)
    navigate(`/inspecoes/${id}`)
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
          onClick={handleNewInspection}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 px-4 py-3.5 font-semibold transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nova inspeção
        </button>
      </div>
    </div>
  )
}
