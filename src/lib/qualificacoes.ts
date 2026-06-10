import { format, differenceInDays, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Constantes ──────────────────────────────────────────────────────────────

export const TRAINING_TYPES = ["nr10_basico", "nr10_areas_classificadas", "sep"] as const;
export type TrainingType = typeof TRAINING_TYPES[number];

export const TRAINING_LABELS: Record<TrainingType, string> = {
  nr10_basico: "NR-10 Básico",
  nr10_areas_classificadas: "NR-10 Áreas Classificadas",
  sep: "SEP",
};

export const AUTHORIZATION_LEVELS = ["A0", "A1", "A2", "A3", "A4"] as const;
export type AuthorizationLevel = typeof AUTHORIZATION_LEVELS[number];

export const IT_STATUS_VALUES = ["ok", "pendente", "vencido"] as const;
export type ITStatus = typeof IT_STATUS_VALUES[number];

export const IT_STATUS_LABELS: Record<ITStatus, string> = {
  ok: "OK",
  pendente: "Pendente",
  vencido: "Vencido",
};

export function itStatusVariant(status: ITStatus): "default" | "secondary" | "destructive" {
  if (status === "ok") return "default";
  if (status === "pendente") return "secondary";
  return "destructive";
}

// ── Tipos de domínio ─────────────────────────────────────────────────────────

export type Employee = {
  id: string;
  name: string;
  matricula: string;
  setor: string | null;
  classificacao: string | null;
  funcao: string | null;
  escolaridade: string | null;
  diploma: string | null;
  diploma_conclusao: string | null;
  crea_cft: string | null;
  active: boolean;
  status: "ativo" | "afastado" | "desligado";
  // Gatilhos de reciclagem extraordinária (NR-10 10.8.8.x) — opcionais para
  // não quebrar fluxos de importação que montam Employee parcial.
  afastado_desde?: string | null;
  retorno_em?: string | null;
  reciclagem_requerida?: boolean;
  reciclagem_motivo?: string | null;
  created_at: string;
  updated_at: string;
};

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  afastado: "Afastado",
  desligado: "Desligado",
};

export function employeeStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ativo") return "default";
  if (status === "afastado") return "secondary";
  return "destructive"; // desligado
}

export type NR10Training = {
  id: string;
  employee_id: string;
  training_type: TrainingType;
  category: "formacao" | "reciclagem";
  training_date: string | null;
  art: string | null;
  responsavel_tecnico: string | null;
  // Registro completo p/ fiscalização — opcionais para compatibilidade com
  // fluxos existentes de upsert/importação.
  carga_horaria?: number | null;
  entidade?: string | null;
  instrutor?: string | null;
  conteudo_programatico?: string | null;
  valid: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkAuthorization = {
  id: string;
  employee_id: string;
  level: AuthorizationLevel;
  funcao: string | null;
  abrangencia: string | null;
  authorization_date: string | null;
  valid: boolean;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkInstruction = {
  id: string;
  code: string;
  title: string | null;
  validity_months: number;
  created_at: string;
  updated_at: string;
};

export type ITTraining = {
  id: string;
  employee_id: string;
  instruction_id: string;
  status: ITStatus;
  conclusao_date: string | null;
  created_at: string;
  updated_at: string;
};

// ── Helpers de data ──────────────────────────────────────────────────────────

/** Converte serial de data do Excel para string ISO (YYYY-MM-DD). */
export function excelSerialToISO(serial: number): string {
  const date = new Date((serial - 25569) * 86400000);
  return format(date, "yyyy-MM-dd");
}

/** Formata uma string ISO de data para exibição em pt-BR. */
export function formatDatePtBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

/** Retorna o status de expiração de um treinamento com validade de 2 anos. */
export function trainingExpiryStatus(trainingDate: string | null): "ok" | "expiring" | "expired" | "none" {
  if (!trainingDate) return "none";
  const expiry = addYears(new Date(trainingDate + "T12:00:00"), 2);
  const daysLeft = differenceInDays(expiry, new Date());
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 90) return "expiring";
  return "ok";
}

export type TrainingCertificate = {
  id: string;
  employee_id: string;
  nr10_training_id: string | null;
  training_type: TrainingType | null;
  category: "formacao" | "reciclagem" | null;
  file_url: string;
  file_name: string | null;
  issue_date: string | null;
  source_file: string | null;
  pages_in_source: string | null;
  uploaded_at: string;
  created_at: string;
};
