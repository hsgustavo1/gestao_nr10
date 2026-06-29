import { format, differenceInDays, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Constantes ──────────────────────────────────────────────────────────────

export const TRAINING_TYPES = ["nr10_basico", "nr10_areas_classificadas", "sep"] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

export const TRAINING_LABELS: Record<TrainingType, string> = {
  nr10_basico: "NR-10 Básico",
  nr10_areas_classificadas: "Áreas Classificadas",
  sep: "NR-10 Complementar - SEP",
};

export const SETOR_FULL_NAMES: Record<string, string> = {
  ELE: "ELE — Elétrica",
  INS: "INS — Instrumentação",
  GER: "GER — Geração de energia",
  ADM: "ADM — Administrativo",
};

/**
 * Retorna os tipos de treinamento NR-10 exigidos para uma equipe.
 * GER (Geração de energia) não exige Áreas Classificadas — somente NR-10 Básico + SEP.
 */
export function requiredTrainings(setor: string | null): TrainingType[] {
  if (setor === "GER") return ["nr10_basico", "sep"];
  return [...TRAINING_TYPES];
}

export const AUTHORIZATION_LEVELS = ["A0", "A1", "A2", "A3", "A4"] as const;
export type AuthorizationLevel = (typeof AUTHORIZATION_LEVELS)[number];

export const IT_STATUS_VALUES = ["ok", "pendente", "vencido"] as const;
export type ITStatus = (typeof IT_STATUS_VALUES)[number];

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
  org_id?: string;
  created_by_org_id?: string | null;
  created_at: string;
  updated_at: string;
};

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  afastado: "Afastado",
  desligado: "Desligado",
};

export function employeeStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
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
  art_arquivo_url?: string | null;
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
export function trainingExpiryStatus(
  trainingDate: string | null,
): "ok" | "expiring" | "expired" | "none" {
  if (!trainingDate) return "none";
  const expiry = addYears(new Date(trainingDate + "T12:00:00"), 2);
  const daysLeft = differenceInDays(expiry, new Date());
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 90) return "expiring";
  return "ok";
}

/**
 * Status de uma formação: perene após realizada — nunca vence.
 * Retorna "ok" se há data registrada, "none" caso contrário.
 */
export function formacaoStatus(date: string | null): "ok" | "none" {
  return date ? "ok" : "none";
}

/**
 * Status da reciclagem bienal. Se há reciclagem registrada, usa sua data.
 * Se não há reciclagem mas há formação, a contagem de 2 anos parte da formação
 * (o trabalhador deve reciclar antes de completar 2 anos da formação/última reciclagem).
 */
export function reciclagemStatus(
  reciclagemDate: string | null,
  formacaoDate: string | null = null,
): "ok" | "expiring" | "expired" | "none" {
  if (reciclagemDate) return trainingExpiryStatus(reciclagemDate);
  if (!formacaoDate) return "none";
  return trainingExpiryStatus(formacaoDate);
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
