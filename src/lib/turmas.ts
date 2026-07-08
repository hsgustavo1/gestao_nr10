import type { TrainingType } from "./qualificacoes";

export type TurmaCandidate = {
  id: string;
  training_type: TrainingType;
  category: "formacao" | "reciclagem";
  data: string | null;
  art: string | null;
};

export type BatchKey = {
  trainingType: TrainingType;
  category: "formacao" | "reciclagem";
  dataRealizacao: string | null;
  art?: string | null;
};

/** Janela (em dias) para casar a data de realização de um lote a uma turma. */
const MATCH_WINDOW_DAYS = 3;

function daysBetween(a: string, b: string): number {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

/**
 * Sugere a turma existente à qual um lote de certificados provavelmente pertence.
 *
 * O casamento é feito por **categoria** (derivada da carga horária, confiável) +
 * **data de realização** (±3 dias) + **ART**. O `training_type` NÃO entra no
 * critério de propósito: a IA erra o tipo com frequência (ex.: lê "áreas
 * classificadas" onde é "SEP") e, como a turma é autoritativa sobre o tipo,
 * exigir tipo igual faria a turma correta ser descartada. ART igual vence direto;
 * senão, retorna a turma da mesma categoria mais próxima em data.
 */
export function suggestTurmaForBatch(
  key: BatchKey,
  candidates: TurmaCandidate[],
): TurmaCandidate | null {
  const mesmaCategoria = candidates.filter((c) => c.category === key.category);
  if (key.art?.trim()) {
    const porArt = mesmaCategoria.find((c) => c.art?.trim() === key.art!.trim());
    if (porArt) return porArt;
  }
  if (!key.dataRealizacao) return null;
  let best: { c: TurmaCandidate; d: number } | null = null;
  for (const c of mesmaCategoria) {
    if (!c.data) continue;
    const d = daysBetween(c.data, key.dataRealizacao);
    if (d <= MATCH_WINDOW_DAYS && (!best || d < best.d)) best = { c, d };
  }
  return best?.c ?? null;
}

export type Discrepancy = {
  field: "data_realizacao" | "carga_horaria";
  severity: "alta" | "media";
  turmaValue: string | number | null;
  certValue: string | number | null;
};

/**
 * Compara os dados lidos do certificado contra a turma à qual ele será vinculado.
 * Data de realização divergente = alerta ALTO (um certificado não deveria ter
 * data de conclusão diferente da turma). Carga horária divergente = alerta MÉDIO.
 * A data de EMISSÃO nunca é comparada aqui. Ausência de dado não gera alerta.
 */
export function detectTurmaDiscrepancies(
  turma: { data: string | null; carga_horaria: number | null },
  cert: { dataRealizacao: string | null; workloadHours: number | null },
): Discrepancy[] {
  const out: Discrepancy[] = [];
  if (turma.data && cert.dataRealizacao && turma.data !== cert.dataRealizacao) {
    out.push({
      field: "data_realizacao",
      severity: "alta",
      turmaValue: turma.data,
      certValue: cert.dataRealizacao,
    });
  }
  if (
    turma.carga_horaria != null &&
    cert.workloadHours != null &&
    turma.carga_horaria !== cert.workloadHours
  ) {
    out.push({
      field: "carga_horaria",
      severity: "media",
      turmaValue: turma.carga_horaria,
      certValue: cert.workloadHours,
    });
  }
  return out;
}

/**
 * Completude de uma turma: uma turma está completa quando todos os participantes
 * têm certificado anexado. ART é opcional (prática que nem toda empresa adota),
 * então **não** entra na conta de completude — só é reportada como presente/ausente.
 */
export function turmaCompleteness(
  turma: { art: string | null },
  participantTrainingIds: string[],
  trainingIdsComCert: Set<string>,
): { hasArt: boolean; certs: number; total: number; complete: boolean } {
  const total = participantTrainingIds.length;
  const certs = participantTrainingIds.filter((id) => trainingIdsComCert.has(id)).length;
  return { hasArt: !!turma.art?.trim(), certs, total, complete: total > 0 && certs === total };
}
