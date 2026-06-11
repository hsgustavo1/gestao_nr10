// Domain types for campo-pwa — mirrors main app's src/lib/campo.ts and src/lib/rti.ts
// Field names match the Supabase tables exactly.

// ── RTI modos de falha ────────────────────────────────────────────────────────

export type NormaRef = { norma: string; item: string }

export type RtiTipoExecucao = 'os' | 'investimento'

export type RtiModoFalha = {
  id: string
  codigo: string
  label: string
  categoria: string
  descricao_padrao: string
  recomendacao_padrao: string | null
  prioridade_sugerida: number
  tipo_execucao_sugerido: RtiTipoExecucao
  normas: NormaRef[]
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

// ── Inspeção de campo ─────────────────────────────────────────────────────────

export const FIELD_INSPECTION_STATUSES = ['em_andamento', 'finalizada', 'importada'] as const
export type FieldInspectionStatus = typeof FIELD_INSPECTION_STATUSES[number]

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

// ── Árvore Setor → Ativo → Componente ────────────────────────────────────────

export const NIVEIS_ARVORE = ['setor', 'ativo', 'componente'] as const
export type NivelArvore = typeof NIVEIS_ARVORE[number]

export type FieldNode = {
  id: string
  inspection_id: string
  parent_id: string | null
  nivel: NivelArvore
  nome: string
  ordem: number
  created_at: string
  updated_at: string
}

// ── Ponto de coleta ───────────────────────────────────────────────────────────

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

// ── Achado (finding) ──────────────────────────────────────────────────────────

export type FieldFinding = {
  id: string
  point_id: string
  modo_falha_id: string | null
  descricao: string
  recomendacao: string | null
  prioridade: number
  tipo_execucao: RtiTipoExecucao
  observacao: string | null
  created_at: string
  updated_at: string
}

// ── Foto ──────────────────────────────────────────────────────────────────────

export type FieldPhoto = {
  id: string
  point_id: string
  file_path: string
  file_name: string
  legenda: string | null
  ordem: number
  created_at: string
}
