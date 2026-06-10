import { addMonths, differenceInDays, format } from "date-fns";

// ── Tipos e constantes de EPIs/EPCs especiais ───────────────────────────────

export const EPI_TYPES = [
  "luva_isolante",
  "manga_isolante",
  "detector_tensao",
  "bastao_isolante",
  "tapete_isolante",
  "cobertura_isolante",
  "outros",
] as const;

export type EPIType = typeof EPI_TYPES[number];

export const EPI_TYPE_LABELS: Record<EPIType, string> = {
  luva_isolante: "Luva isolante",
  manga_isolante: "Manga isolante",
  detector_tensao: "Detector de tensão",
  bastao_isolante: "Bastão isolante",
  tapete_isolante: "Tapete isolante",
  cobertura_isolante: "Cobertura isolante",
  outros: "Outros",
};

export type EPI = {
  id: string;
  epi_type: EPIType;
  description: string | null;
  epi_class: string | null;
  serial_number: string | null;
  ca: string | null;
  employee_id: string | null;
  sector: string | null;
  acquisition_date: string | null;
  test_interval_months: number;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EPITest = {
  id: string;
  epi_id: string;
  test_date: string;
  result: "aprovado" | "reprovado";
  laboratory: string | null;
  certificate_path: string | null;
  notes: string | null;
  created_at: string;
};

// ── Status de ensaio ─────────────────────────────────────────────────────────

export type EPITestStatus = "ok" | "expiring" | "expired" | "failed" | "none";

export const EPI_STATUS_LABELS: Record<EPITestStatus, string> = {
  ok: "Em dia",
  expiring: "Vencendo",
  expired: "Ensaio vencido",
  failed: "Reprovado",
  none: "Sem ensaio",
};

/** Data do próximo ensaio: último ensaio aprovado + intervalo. */
export function nextTestDate(epi: EPI, lastApprovedTest: EPITest | null): string | null {
  if (!lastApprovedTest) return null;
  const next = addMonths(new Date(lastApprovedTest.test_date + "T12:00:00"), epi.test_interval_months);
  return format(next, "yyyy-MM-dd");
}

/**
 * Status do EPI considerando o último ensaio: reprovado tem precedência;
 * sem ensaio é tratado como pendência; vencendo quando faltam ≤ 30 dias.
 */
export function epiTestStatus(epi: EPI, lastTest: EPITest | null): EPITestStatus {
  if (!lastTest) return "none";
  if (lastTest.result === "reprovado") return "failed";
  const next = nextTestDate(epi, lastTest);
  if (!next) return "none";
  const daysLeft = differenceInDays(new Date(next + "T12:00:00"), new Date());
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 30) return "expiring";
  return "ok";
}

/** Último ensaio de cada EPI (assume lista ordenada por data desc ou não). */
export function lastTestByEpi(tests: EPITest[]): Map<string, EPITest> {
  const map = new Map<string, EPITest>();
  for (const t of tests) {
    const current = map.get(t.epi_id);
    if (!current || t.test_date > current.test_date) map.set(t.epi_id, t);
  }
  return map;
}
