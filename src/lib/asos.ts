import { differenceInDays } from "date-fns";

// ── ASO — Atestado de Saúde Ocupacional (NR-10 10.8.7) ──────────────────────

export const ASO_TIPOS = [
  "admissional",
  "periodico",
  "retorno_trabalho",
  "mudanca_funcao",
  "demissional",
] as const;

export type ASOTipo = typeof ASO_TIPOS[number];

export const ASO_TIPO_LABELS: Record<ASOTipo, string> = {
  admissional: "Admissional",
  periodico: "Periódico",
  retorno_trabalho: "Retorno ao trabalho",
  mudanca_funcao: "Mudança de função",
  demissional: "Demissional",
};

export const ASO_RESULTADOS = ["apto", "apto_com_restricoes", "inapto"] as const;
export type ASOResultado = typeof ASO_RESULTADOS[number];

export const ASO_RESULTADO_LABELS: Record<ASOResultado, string> = {
  apto: "Apto",
  apto_com_restricoes: "Apto com restrições",
  inapto: "Inapto",
};

export type ASO = {
  id: string;
  employee_id: string;
  exam_date: string;
  validity_date: string;
  tipo: ASOTipo;
  resultado: ASOResultado;
  apto_eletricidade: boolean;
  restricoes: string | null;
  medico: string | null;
  file_path: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

// ── Status ───────────────────────────────────────────────────────────────────

export type ASOStatus = "ok" | "expiring" | "expired" | "inapto" | "none";

export const ASO_STATUS_LABELS: Record<ASOStatus, string> = {
  ok: "Em dia",
  expiring: "Vencendo",
  expired: "Vencido",
  inapto: "Inapto",
  none: "Sem ASO",
};

/**
 * Status do ASO mais recente: inapto/sem aptidão p/ eletricidade tem
 * precedência; vencendo quando faltam ≤ 60 dias.
 */
export function asoStatus(
  aso: Pick<ASO, "validity_date" | "resultado" | "apto_eletricidade"> | null,
  today: Date = new Date(),
): ASOStatus {
  if (!aso) return "none";
  if (aso.resultado === "inapto" || !aso.apto_eletricidade) return "inapto";
  const daysLeft = differenceInDays(new Date(aso.validity_date + "T12:00:00"), today);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 60) return "expiring";
  return "ok";
}

/** ASO mais recente (por data de exame) de cada colaborador. */
export function latestASOByEmployee(asos: ASO[]): Map<string, ASO> {
  const map = new Map<string, ASO>();
  for (const a of asos) {
    const current = map.get(a.employee_id);
    if (!current || a.exam_date > current.exam_date) map.set(a.employee_id, a);
  }
  return map;
}
