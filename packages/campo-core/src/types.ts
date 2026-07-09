// Domain types shared between campo-pwa and the main app.
// Field names match the Supabase tables exactly.
//
// Multi-tenancy: cada tabela de domínio tem `org_id NOT NULL` no banco. Aqui ele
// é OPCIONAL de propósito — é uma coluna autoritativa do servidor:
//  - registros BAIXADOS do servidor sempre trazem org_id;
//  - registros criados localmente (offline) podem não conhecê-lo ainda. A trigger
//    de cascata no banco (filho herda org_id do pai) e a fn_default_org_id (raiz,
//    usuário single-org) preenchem no INSERT. Só as RAÍZES (field_inspections,
//    rti_reports) precisam informar org_id quando o usuário pertence a 2+ orgs.

// ── RTI modos de falha ────────────────────────────────────────────────────────

export type NormaRef = { norma: string; item: string };

export type RtiTipoExecucao = "os" | "investimento";

export type RtiModoFalha = {
  id: string;
  codigo: string;
  label: string;
  categoria: string;
  descricao_padrao: string;
  recomendacao_padrao: string | null;
  prioridade_sugerida: number;
  tipo_execucao_sugerido: RtiTipoExecucao;
  normas: NormaRef[];
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

// ── Inspeção de campo ─────────────────────────────────────────────────────────

export const FIELD_INSPECTION_STATUSES = ["em_andamento", "finalizada", "importada"] as const;
export type FieldInspectionStatus = (typeof FIELD_INSPECTION_STATUSES)[number];

export type FieldInspection = {
  id: string;
  org_id?: string;
  titulo: string;
  cliente: string | null;
  local: string | null;
  engenheiro: string | null;
  data_inspecao: string;
  status: FieldInspectionStatus;
  report_id: string | null;
  notes: string | null;
  created_by_name: string | null;
  arquivada_campo: boolean;
  created_at: string;
  updated_at: string;
};

// ── Árvore Setor → Ativo → Componente ────────────────────────────────────────

export const NIVEIS_ARVORE = ["setor", "ativo", "componente"] as const;
export type NivelArvore = (typeof NIVEIS_ARVORE)[number];
/** Alias for NivelArvore — used in campo.ts helpers. */
export type NodeType = NivelArvore;

export type FieldNode = {
  id: string;
  org_id?: string;
  inspection_id: string;
  parent_id: string | null;
  nivel: NivelArvore;
  nome: string;
  ordem: number;
  created_at: string;
  updated_at: string;
};

// ── Ponto de coleta ───────────────────────────────────────────────────────────

export type FieldPoint = {
  id: string;
  org_id?: string;
  inspection_id: string;
  node_id: string;
  titulo: string | null;
  observacoes: string | null;
  ordem: number;
  /** Quem estava logado quando o ponto foi criado — null em dados pré-migração. */
  collected_by_user_id: string | null;
  collected_by_name: string | null;
  created_at: string;
  updated_at: string;
};

// ── Achado (finding) ──────────────────────────────────────────────────────────

export type FieldFinding = {
  id: string;
  org_id?: string;
  point_id: string;
  modo_falha_id: string | null;
  descricao: string;
  recomendacao: string | null;
  prioridade: number;
  tipo_execucao: RtiTipoExecucao;
  observacao: string | null;
  created_at: string;
  updated_at: string;
};

// ── Foto ──────────────────────────────────────────────────────────────────────

export type FieldPhoto = {
  id: string;
  org_id?: string;
  point_id: string;
  file_path: string;
  file_name: string;
  legenda: string | null;
  ordem: number;
  /** NC evidenciada por esta foto (null = foto geral do ponto ou pré-migração). */
  finding_id: string | null;
  /** Posição no momento da captura (null = GPS indisponível/negado). */
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  created_at: string;
};
