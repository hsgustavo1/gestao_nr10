import {
  trainingExpiryStatus,
  type Employee,
  type NR10Training,
  type WorkAuthorization,
} from "./qualificacoes";
import { asoStatus, type ASO } from "./asos";

// ── Motor de aptidão (NR-10 10.8) ────────────────────────────────────────────
// A condição de "autorizado" não é um checkbox: ela é derivada de
//   autorização vigente E capacitação NR-10 válida E ASO válido (apto p/
//   eletricidade) E nenhuma reciclagem extraordinária pendente.
// Qualquer condição que falhe gera um "bloqueante" com motivo legível.

export const BLOQUEANTE_CODES = [
  "sem_autorizacao",
  "autorizacao_invalida",
  "nr10_basico_ausente",
  "nr10_basico_vencido",
  "aso_ausente",
  "aso_vencido",
  "aso_inapto",
  "reciclagem_requerida",
  "colaborador_inativo",
] as const;

export type BloqueanteCode = (typeof BLOQUEANTE_CODES)[number];

export const BLOQUEANTE_LABELS: Record<BloqueanteCode, string> = {
  sem_autorizacao: "Sem autorização vigente",
  autorizacao_invalida: "Autorização marcada como inválida",
  nr10_basico_ausente: "Sem capacitação NR-10 Básico",
  nr10_basico_vencido: "NR-10 Básico vencido (reciclagem bienal)",
  aso_ausente: "Sem ASO registrado",
  aso_vencido: "ASO vencido",
  aso_inapto: "ASO inapto para trabalho em eletricidade",
  reciclagem_requerida: "Reciclagem extraordinária pendente",
  colaborador_inativo: "Colaborador afastado ou desligado",
};

export type Bloqueante = {
  code: BloqueanteCode;
  label: string;
  detail?: string;
};

export type Aptidao = {
  apto: boolean;
  bloqueantes: Bloqueante[];
};

export type AptidaoInput = {
  employee: Pick<Employee, "status"> &
    Partial<Pick<Employee, "reciclagem_requerida" | "reciclagem_motivo">>;
  /** Treinamentos NR-10 do colaborador (qualquer tipo/categoria). */
  trainings: Pick<NR10Training, "training_type" | "category" | "training_date">[];
  /** Autorização vigente (is_current = true) ou null. */
  authorization: Pick<WorkAuthorization, "valid"> | null;
  /** ASO mais recente do colaborador ou null. */
  aso: Pick<ASO, "validity_date" | "resultado" | "apto_eletricidade" | "exam_date"> | null;
  today?: Date;
};

/** Data do treinamento NR-10 Básico mais recente (formação ou reciclagem). */
export function latestBasicoDate(trainings: AptidaoInput["trainings"]): string | null {
  let latest: string | null = null;
  for (const t of trainings) {
    if (t.training_type !== "nr10_basico" || !t.training_date) continue;
    if (!latest || t.training_date > latest) latest = t.training_date;
  }
  return latest;
}

export function computeAptidao(input: AptidaoInput): Aptidao {
  const today = input.today ?? new Date();
  const bloqueantes: Bloqueante[] = [];
  const push = (code: BloqueanteCode, detail?: string) =>
    bloqueantes.push({ code, label: BLOQUEANTE_LABELS[code], detail });

  // 0) Colaborador precisa estar ativo
  if (input.employee.status !== "ativo") {
    push("colaborador_inativo");
  }

  // 1) Autorização formal vigente (NR-10 10.8.4)
  if (!input.authorization) {
    push("sem_autorizacao");
  } else if (!input.authorization.valid) {
    push("autorizacao_invalida");
  }

  // 2) Capacitação NR-10 Básico válida (reciclagem bienal — 10.8.8)
  const basicoDate = latestBasicoDate(input.trainings);
  if (!basicoDate) {
    push("nr10_basico_ausente");
  } else if (trainingExpiryStatus(basicoDate) === "expired") {
    push("nr10_basico_vencido");
  }

  // 3) ASO válido com aptidão para eletricidade (10.8.7)
  const st = asoStatus(input.aso, today);
  if (st === "none") push("aso_ausente");
  else if (st === "expired") push("aso_vencido");
  else if (st === "inapto") push("aso_inapto");

  // 4) Reciclagem extraordinária pendente (retorno de afastamento, mudança de função)
  if (input.employee.reciclagem_requerida) {
    push("reciclagem_requerida", input.employee.reciclagem_motivo ?? undefined);
  }

  return { apto: bloqueantes.length === 0, bloqueantes };
}
