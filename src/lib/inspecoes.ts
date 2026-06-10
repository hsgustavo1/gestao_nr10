// ── Tipos e constantes do motor de inspeções (RTI, Termografia, SPDA, Cercon) ──

export const INSPECTION_TYPES = ["rti", "termografia", "spda", "cercon"] as const;
export type InspectionType = typeof INSPECTION_TYPES[number];

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  rti: "RTI — Relatórios de Teste de Isolamento",
  termografia: "Inspeções Termográficas",
  spda: "SPDA — Descargas Atmosféricas e Aterramentos",
  cercon: "Cercon — Certificação de Conformidade",
};

export const INSPECTION_TYPE_SHORT: Record<InspectionType, string> = {
  rti: "RTI",
  termografia: "Termografia",
  spda: "SPDA",
  cercon: "Cercon",
};

export const INSPECTION_RESULTS = ["conforme", "conforme_com_ressalvas", "nao_conforme"] as const;
export type InspectionResult = typeof INSPECTION_RESULTS[number];

export const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  conforme: "Conforme",
  conforme_com_ressalvas: "Conforme com ressalvas",
  nao_conforme: "Não conforme",
};

export const ACTION_STATUSES = ["pendente", "em_andamento", "concluida"] as const;
export type ActionStatus = typeof ACTION_STATUSES[number];

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

export type Inspection = {
  id: string;
  inspection_type: InspectionType;
  equipment: string;
  sector: string | null;
  inspection_date: string;
  validity_date: string | null;
  result: InspectionResult;
  report_path: string | null;
  responsavel: string | null;
  art: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type InspectionAction = {
  id: string;
  inspection_id: string;
  description: string;
  responsible: string | null;
  due_date: string | null;
  status: ActionStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
