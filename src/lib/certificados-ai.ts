import type { Employee, TrainingType } from "./qualificacoes";

/** Graus (horário) a girar a imagem para o texto ficar na horizontal e legível. */
export type OrientationCorrection = 0 | 90 | 180 | 270;

/** Leitura de uma página de certificado feita pela IA (Groq/Llama 4 Vision). */
export type PageAnalysis = {
  /** Correção de orientação sugerida pela IA (0 = já está reto). */
  orientation_correction: OrientationCorrection;
  page_type: "frente" | "verso";
  employee_name_read: string | null;
  training_course_read: string | null;
  training_type_guess: TrainingType | null;
  category_guess: "formacao" | "reciclagem" | null;
  /** Carga horária lida no certificado (h). Decide formação × reciclagem melhor que o texto. */
  workload_hours_read: number | null;
  /** Data de realização/conclusão do treinamento (dd/mm/aaaa ou ISO). Distinta da emissão. */
  training_date_read: string | null;
  dates_read: string[];
  confidence: "alta" | "media" | "baixa";
};

/** Normaliza um valor arbitrário vindo da IA para uma das 4 rotações válidas. */
export function normalizeOrientation(v: unknown): OrientationCorrection {
  const n = typeof v === "number" ? v : Number(v);
  const r = ((Math.round(n / 90) * 90) % 360 + 360) % 360;
  return (r === 90 || r === 180 || r === 270 ? r : 0) as OrientationCorrection;
}

/**
 * O logo/cabeçalho da empresa aparece em toda página (frente e verso), então o
 * modelo às vezes rotula page_type errado mesmo lendo employee_name_read certo.
 * Corrige de forma determinística: sem nome de pessoa não tem como ser frente.
 */
export function normalizePageAnalysis(raw: PageAnalysis): PageAnalysis {
  const hasName = !!raw.employee_name_read?.trim();
  const hours = typeof raw.workload_hours_read === "number" ? raw.workload_hours_read : Number(raw.workload_hours_read);
  return {
    ...raw,
    orientation_correction: normalizeOrientation(raw.orientation_correction),
    page_type: hasName ? "frente" : "verso",
    workload_hours_read: Number.isFinite(hours) && hours > 0 ? hours : null,
  };
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function nameWords(name: string): string[] {
  return stripAccents(name.toUpperCase())
    .replace(/[^A-Z ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Casa o nome lido pela IA (texto livre, pode ter OCR levemente errado) contra
 * o roster local — nunca é enviado à IA, o match acontece só no nosso backend.
 * Critério: fração de palavras do nome do colaborador que aparecem no texto lido.
 */
export function matchEmployeeByName(nameRead: string | null, employees: Employee[]): Employee | null {
  if (!nameRead?.trim()) return null;
  const readWords = nameWords(nameRead);
  if (!readWords.length) return null;

  let best: { emp: Employee; score: number } | null = null;
  for (const emp of employees) {
    const empWords = nameWords(emp.name);
    if (!empWords.length) continue;
    const matches = empWords.filter((w) => readWords.includes(w)).length;
    const score = matches / empWords.length;
    if (score >= 0.6 && (!best || score > best.score)) best = { emp, score };
  }
  return best?.emp ?? null;
}

/**
 * Normaliza uma data lida pela IA (ISO `aaaa-mm-dd` ou `dd/mm/aaaa`) para ISO.
 * Retorna null quando vazia ou irreconhecível.
 */
export function normalizeDateGuess(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Extrai a data mais recente em formato dd/mm/aaaa encontrada no texto, como ISO. */
export function extractLatestDateGuess(datesRead: string[]): string | null {
  const re = /(\d{2})\/(\d{2})\/(\d{4})/g;
  let latest: string | null = null;
  for (const text of datesRead) {
    for (const m of text.matchAll(re)) {
      const iso = `${m[3]}-${m[2]}-${m[1]}`;
      if (!latest || iso > latest) latest = iso;
    }
  }
  return latest;
}

/**
 * Decide formação × reciclagem priorizando a CARGA HORÁRIA (mais confiável que o
 * rótulo textual): formação de NR-10 básico/complementar tem ~40h; reciclagem
 * ~16h. Só quando não há carga horária legível é que cai no palpite do modelo —
 * e, se a confiança for baixa, deixa em branco para revisão manual.
 */
export function inferCategory(
  a: Pick<PageAnalysis, "workload_hours_read" | "category_guess" | "confidence">,
): "formacao" | "reciclagem" | "" {
  const h = a.workload_hours_read;
  if (typeof h === "number" && h > 0) {
    if (h >= 30) return "formacao";
    if (h <= 24) return "reciclagem";
  }
  if (a.confidence === "baixa") return "";
  return a.category_guess ?? "";
}

export type CertificatePageGroup = {
  pages: number[];
  employee: Employee | null;
  employeeNameRead: string | null;
  trainingType: TrainingType | "";
  category: "formacao" | "reciclagem" | "";
  issueDate: string;
  /** Data de realização/conclusão lida — confrontada com a data da turma. */
  dataRealizacao: string;
  /** Carga horária lida (h) — usada ao criar o treinamento a partir do certificado. */
  workloadHours: number | null;
  confidence: PageAnalysis["confidence"] | null;
};

/**
 * Agrupa páginas em certificados usando a classificação frente/verso da IA
 * (substitui a heurística antiga de "página curta = verso"). Uma página
 * "frente" inicia um novo grupo; "verso" subsequentes se juntam a ele.
 * Páginas sem análise (falha da IA) ou "verso" antes de qualquer "frente"
 * caem num grupo sem colaborador, para revisão manual.
 */
export function groupPagesByFrenteVerso(
  analyses: (PageAnalysis | null)[], // índice 0 = página 1
  employees: Employee[],
): CertificatePageGroup[] {
  const groups: CertificatePageGroup[] = [];
  let current: CertificatePageGroup | null = null;

  analyses.forEach((a, idx) => {
    const pageNum = idx + 1;
    const startsNewGroup = !current || !a || a.page_type === "frente";
    if (startsNewGroup) {
      if (current) groups.push(current);
      // Baixa confiança: não pré-preenche tipo/categoria — melhor em branco do que errado.
      const lowConfidence = a?.confidence === "baixa";
      current = {
        pages: [pageNum],
        employee: a ? matchEmployeeByName(a.employee_name_read, employees) : null,
        employeeNameRead: a?.employee_name_read ?? null,
        trainingType: a && !lowConfidence ? (a.training_type_guess ?? "") : "",
        category: a ? inferCategory(a) : "",
        issueDate: extractLatestDateGuess(a?.dates_read ?? []) ?? "",
        dataRealizacao:
          normalizeDateGuess(a?.training_date_read) ??
          extractLatestDateGuess(a?.dates_read ?? []) ??
          "",
        workloadHours: a?.workload_hours_read ?? null,
        confidence: a?.confidence ?? null,
      };
    } else {
      current!.pages.push(pageNum);
    }
  });
  if (current) groups.push(current);
  return groups;
}
