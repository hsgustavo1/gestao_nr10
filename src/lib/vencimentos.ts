import { useMemo } from "react";
import { addMonths, addYears, differenceInDays, format } from "date-fns";
import { useEmployees, useITTrainings, useNR10Trainings, useWorkInstructions } from "./qualificacoes-queries";
import { useNR10Documents } from "./prontuario-queries";
import { useInspections } from "./inspecoes-queries";
import { useEPIs, useEPITests, type EPIWithEmployee } from "./epis-queries";
import { useASOs } from "./asos-queries";
import { latestASOByEmployee, ASO_TIPO_LABELS, type ASO } from "./asos";
import {
  TRAINING_LABELS,
  type Employee, type ITTraining, type NR10Training, type TrainingType, type WorkInstruction,
} from "./qualificacoes";
import { PIE_CATEGORY_LABELS, type NR10Document } from "./prontuario";
import { INSPECTION_TYPE_SHORT, type Inspection } from "./inspecoes";
import { EPI_TYPE_LABELS, lastTestByEpi, nextTestDate, type EPITest } from "./epis";

// ── Item normalizado de vencimento ──────────────────────────────────────────

export const VENC_KINDS = ["treinamento", "it", "documento", "inspecao", "epi", "aso"] as const;
export type VencKind = typeof VENC_KINDS[number];

export const VENC_KIND_LABELS: Record<VencKind, string> = {
  treinamento: "Capacitação NR-10",
  it: "Instrução de Trabalho",
  documento: "Prontuário",
  inspecao: "Inspeção",
  epi: "Ensaio de EPI",
  aso: "ASO",
};

export type VencStatus = "expired" | "expiring";

export type VencimentoItem = {
  id: string;
  kind: VencKind;
  title: string;
  subject: string;
  detail: string | null;
  dueDate: string;
  daysLeft: number;
  status: VencStatus;
  link: string;
};

function statusFor(daysLeft: number): VencStatus {
  return daysLeft < 0 ? "expired" : "expiring";
}

/**
 * Dados brutos necessários para computar os vencimentos. Mantido separado do
 * hook para permitir testes puros de `buildVencimentos` sem o React Query.
 */
export type VencimentosData = {
  employees: Employee[];
  trainings: NR10Training[];
  itTrainings: ITTraining[];
  instructions: WorkInstruction[];
  documents: NR10Document[];
  inspections: Inspection[];
  epis: EPIWithEmployee[];
  epiTests: EPITest[];
  asos: ASO[];
};

/**
 * Agrega todos os vencimentos do sistema (vencidos + vencendo dentro do
 * horizonte em dias). Função pura: recebe os dados já carregados e a data de
 * referência, o que torna a regra testável sem hooks. Horizonte padrão 90 dias.
 */
export function buildVencimentos(
  data: VencimentosData,
  horizonDays = 90,
  today: Date = new Date(),
): VencimentoItem[] {
  const { employees, trainings, itTrainings, instructions, documents, inspections, epis, epiTests, asos } = data;
  const out: VencimentoItem[] = [];
  const push = (item: Omit<VencimentoItem, "daysLeft" | "status"> & { dueDate: string }) => {
    const daysLeft = differenceInDays(new Date(item.dueDate + "T12:00:00"), today);
    if (daysLeft > horizonDays) return;
    out.push({ ...item, daysLeft, status: statusFor(daysLeft) });
  };

  const employeeById = new Map(employees.map((e) => [e.id, e]));

  // 1) Capacitações NR-10: validade de 2 anos sobre a data mais recente
  //    (formação ou reciclagem) por colaborador e tipo de treinamento.
  const latestByEmpType = new Map<string, string>();
  for (const t of trainings) {
    if (!t.training_date) continue;
    const key = `${t.employee_id}|${t.training_type}`;
    const current = latestByEmpType.get(key);
    if (!current || t.training_date > current) latestByEmpType.set(key, t.training_date);
  }
  for (const [key, trainingDate] of latestByEmpType) {
    const [employeeId, trainingType] = key.split("|");
    const emp = employeeById.get(employeeId);
    if (!emp) continue; // só colaboradores ativos
    const due = format(addYears(new Date(trainingDate + "T12:00:00"), 2), "yyyy-MM-dd");
    push({
      id: `nr10-${key}`,
      kind: "treinamento",
      title: TRAINING_LABELS[trainingType as TrainingType] ?? trainingType,
      subject: emp.name,
      detail: emp.setor ? `Mat. ${emp.matricula} · ${emp.setor}` : `Mat. ${emp.matricula}`,
      dueDate: due,
      link: "/qualificacoes/nr10",
    });
  }

  // 2) Instruções de Trabalho: conclusão + validade da IT (meses)
  const instructionById = new Map(instructions.map((i) => [i.id, i]));
  for (const it of itTrainings) {
    if (!it.conclusao_date) continue;
    const emp = employeeById.get(it.employee_id);
    if (!emp) continue;
    const instr = instructionById.get(it.instruction_id);
    const months = instr?.validity_months ?? 24;
    const due = format(addMonths(new Date(it.conclusao_date + "T12:00:00"), months), "yyyy-MM-dd");
    push({
      id: `it-${it.id}`,
      kind: "it",
      title: instr ? `IT ${instr.code}${instr.title ? ` — ${instr.title}` : ""}` : "Instrução de Trabalho",
      subject: emp.name,
      detail: emp.setor ? `Mat. ${emp.matricula} · ${emp.setor}` : `Mat. ${emp.matricula}`,
      dueDate: due,
      link: "/qualificacoes/instrucoes",
    });
  }

  // 3) Documentos do prontuário
  for (const d of documents) {
    if (!d.validity_date) continue;
    push({
      id: `doc-${d.id}`,
      kind: "documento",
      title: d.title,
      subject: PIE_CATEGORY_LABELS[d.category],
      detail: d.responsavel,
      dueDate: d.validity_date,
      link: "/nr10",
    });
  }

  // 4) Inspeções (RTI, Termografia, SPDA, Cercon)
  for (const i of inspections) {
    if (!i.validity_date) continue;
    push({
      id: `insp-${i.id}`,
      kind: "inspecao",
      title: `${INSPECTION_TYPE_SHORT[i.inspection_type]} — ${i.equipment}`,
      subject: i.sector ? `Setor ${i.sector}` : "—",
      detail: i.responsavel,
      dueDate: i.validity_date,
      link: `/${i.inspection_type === "termografia" ? "termografias" : i.inspection_type}`,
    });
  }

  // 5) Próximos ensaios de EPI
  const lastTests = lastTestByEpi(epiTests);
  for (const e of epis) {
    const last = lastTests.get(e.id) ?? null;
    if (!last || last.result !== "aprovado") continue;
    const next = nextTestDate(e, last);
    if (!next) continue;
    const owner = e.employees?.name ?? (e.sector ? `Setor ${e.sector}` : "Uso coletivo");
    push({
      id: `epi-${e.id}`,
      kind: "epi",
      title: `${EPI_TYPE_LABELS[e.epi_type]}${e.serial_number ? ` (série ${e.serial_number})` : ""}`,
      subject: owner,
      detail: e.epi_class ? `Classe ${e.epi_class}` : null,
      dueDate: next,
      link: "/epis",
    });
  }

  // 6) ASOs (mais recente por colaborador ativo)
  const latestASOs = latestASOByEmployee(asos);
  for (const [employeeId, aso] of latestASOs) {
    const emp = employeeById.get(employeeId);
    if (!emp) continue; // só colaboradores ativos
    push({
      id: `aso-${aso.id}`,
      kind: "aso",
      title: `ASO ${ASO_TIPO_LABELS[aso.tipo]}`,
      subject: emp.name,
      detail: emp.setor ? `Mat. ${emp.matricula} · ${emp.setor}` : `Mat. ${emp.matricula}`,
      dueDate: aso.validity_date,
      link: "/qualificacoes/asos",
    });
  }

  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Agrega todos os vencimentos via hooks de query e memoiza o resultado.
 * Delega a regra de negócio para `buildVencimentos`. Horizonte padrão 90 dias.
 */
export function useVencimentos(horizonDays = 90) {
  const { data: employees = [], isLoading: l1 } = useEmployees("ativo");
  const { data: trainings = [], isLoading: l2 } = useNR10Trainings();
  const { data: itTrainings = [], isLoading: l3 } = useITTrainings();
  const { data: instructions = [], isLoading: l4 } = useWorkInstructions();
  const { data: documents = [], isLoading: l5 } = useNR10Documents();
  const { data: inspections = [], isLoading: l6 } = useInspections();
  const { data: epis = [], isLoading: l7 } = useEPIs();
  const { data: epiTests = [], isLoading: l8 } = useEPITests();
  const { data: asos = [], isLoading: l9 } = useASOs();

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9;

  const items = useMemo<VencimentoItem[]>(
    () =>
      buildVencimentos(
        {
          employees,
          trainings,
          itTrainings: itTrainings as ITTraining[],
          instructions,
          documents,
          inspections,
          epis,
          epiTests,
          asos,
        },
        horizonDays,
      ),
    [employees, trainings, itTrainings, instructions, documents, inspections, epis, epiTests, asos, horizonDays],
  );

  return { items, isLoading };
}

/** Contagem de pendências (vencidos + vencendo em 30 dias) para o badge do header. */
export function useVencimentosBadge() {
  const { items, isLoading } = useVencimentos(30);
  return { count: isLoading ? 0 : items.length, isLoading };
}
