// ── Incidentes e quase-acidentes elétricos ───────────────────────────────────

export const INCIDENT_TIPOS = [
  "choque",
  "arco_eletrico",
  "principio_incendio",
  "quase_acidente",
  "outro",
] as const;

export type IncidentTipo = (typeof INCIDENT_TIPOS)[number];

export const INCIDENT_TIPO_LABELS: Record<IncidentTipo, string> = {
  choque: "Choque elétrico",
  arco_eletrico: "Arco elétrico",
  principio_incendio: "Princípio de incêndio",
  quase_acidente: "Quase-acidente",
  outro: "Outro",
};

export const INCIDENT_GRAVIDADES = ["sem_lesao", "leve", "moderada", "grave", "fatal"] as const;

export type IncidentGravidade = (typeof INCIDENT_GRAVIDADES)[number];

export const INCIDENT_GRAVIDADE_LABELS: Record<IncidentGravidade, string> = {
  sem_lesao: "Sem lesão",
  leve: "Leve",
  moderada: "Moderada",
  grave: "Grave",
  fatal: "Fatal",
};

export const INCIDENT_STATUS = ["aberto", "em_investigacao", "concluido"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUS)[number];

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  aberto: "Aberto",
  em_investigacao: "Em investigação",
  concluido: "Concluído",
};

export type ElectricalIncident = {
  id: string;
  occurred_at: string;
  tipo: IncidentTipo;
  setor: string | null;
  local: string | null;
  descricao: string;
  envolvidos: string | null;
  gravidade: IncidentGravidade;
  causa_raiz: string | null;
  acoes_tomadas: string | null;
  status: IncidentStatus;
  file_path: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};
