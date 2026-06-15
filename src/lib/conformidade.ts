import { useMemo } from "react";
import { useEmployees, useNR10Trainings, useWorkAuthorizations } from "./qualificacoes-queries";
import { useNR10Documents } from "./prontuario-queries";
import { useInspections, useOpenActions } from "./inspecoes-queries";
import { useEPIs, useEPITests } from "./epis-queries";
import { useASOs } from "./asos-queries";
import {
  trainingExpiryStatus,
  TRAINING_LABELS,
  TRAINING_TYPES,
  type TrainingType,
} from "./qualificacoes";
import { prontuarioCompleteness, docExpiryStatus } from "./prontuario";
import { INSPECTION_TYPES, INSPECTION_TYPE_SHORT, type InspectionType } from "./inspecoes";
import { epiTestStatus, lastTestByEpi } from "./epis";
import { asoStatus, latestASOByEmployee } from "./asos";

// ── Relatório de conformidade reutilizável ──────────────────────────────────
// O mesmo cálculo alimenta: /relatorio, o dossiê de fiscalização e os
// snapshots mensais de tendência.

export function pct(part: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((part / total) * 100);
}

export type ComplianceReport = {
  overall: number;
  employees: number;
  trainingRows: {
    type: TrainingType;
    label: string;
    valid: number;
    universe: number;
    percent: number;
  }[];
  validAuth: number;
  authPercent: number;
  prontuario: ReturnType<typeof prontuarioCompleteness>;
  inspectionRows: {
    type: InspectionType;
    label: string;
    total: number;
    valid: number;
    naoConformes: number;
    percent: number;
  }[];
  inspPercent: number | null;
  openActions: number;
  epis: number;
  epiOk: number;
  epiPercent: number | null;
  asoOk: number;
  asoPercent: number;
};

export function useComplianceReport() {
  const { data: employees = [], isLoading: l1 } = useEmployees("ativo");
  const { data: trainings = [], isLoading: l2 } = useNR10Trainings();
  const { data: authorizations = [], isLoading: l3 } = useWorkAuthorizations();
  const { data: documents = [], isLoading: l4 } = useNR10Documents();
  const { data: inspections = [], isLoading: l5 } = useInspections();
  const { data: openActions = [], isLoading: l6 } = useOpenActions();
  const { data: epis = [], isLoading: l7 } = useEPIs();
  const { data: epiTests = [], isLoading: l8 } = useEPITests();
  const { data: asos = [], isLoading: l9 } = useASOs();

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9;

  const report = useMemo<ComplianceReport | null>(() => {
    if (isLoading) return null;
    const employeeIds = new Set(employees.map((e) => e.id));

    // Capacitações: por tipo, % de colaboradores em dia (ok/vencendo) entre os
    // que possuem registro; NR-10 básico considera todos os ativos.
    const trainingRows = TRAINING_TYPES.map((type) => {
      const latestByEmp = new Map<string, string>();
      for (const t of trainings) {
        if (t.training_type !== type || !t.training_date || !employeeIds.has(t.employee_id))
          continue;
        const cur = latestByEmp.get(t.employee_id);
        if (!cur || t.training_date > cur) latestByEmp.set(t.employee_id, t.training_date);
      }
      const universe = type === "nr10_basico" ? employees.length : latestByEmp.size;
      let valid = 0;
      for (const date of latestByEmp.values()) {
        const st = trainingExpiryStatus(date);
        if (st === "ok" || st === "expiring") valid++;
      }
      return { type, label: TRAINING_LABELS[type], valid, universe, percent: pct(valid, universe) };
    }).filter((r) => r.universe > 0);

    // Autorizações: % de ativos com autorização válida
    const validAuth = (authorizations as Array<{ employee_id: string; valid: boolean }>).filter(
      (a) => a.valid && employeeIds.has(a.employee_id),
    ).length;
    const authPercent = pct(validAuth, employees.length);

    // Prontuário
    const prontuario = prontuarioCompleteness(documents);

    // Inspeções: por tipo, % de laudos não vencidos
    const inspectionRows = INSPECTION_TYPES.map((type) => {
      const of = inspections.filter((i) => i.inspection_type === type);
      const valid = of.filter((i) => docExpiryStatus(i.validity_date) !== "expired").length;
      const naoConformes = of.filter((i) => i.result === "nao_conforme").length;
      return {
        type,
        label: INSPECTION_TYPE_SHORT[type],
        total: of.length,
        valid,
        naoConformes,
        percent: pct(valid, of.length),
      };
    }).filter((r) => r.total > 0);
    const inspPercent =
      inspectionRows.length > 0
        ? Math.round(inspectionRows.reduce((s, r) => s + r.percent, 0) / inspectionRows.length)
        : null;

    // EPIs: % em dia (ok/vencendo) entre ativos
    const lastTests = lastTestByEpi(epiTests);
    let epiOk = 0;
    for (const e of epis) {
      const st = epiTestStatus(e, lastTests.get(e.id) ?? null);
      if (st === "ok" || st === "expiring") epiOk++;
    }
    const epiPercent = epis.length > 0 ? pct(epiOk, epis.length) : null;

    // ASOs: % de ativos com ASO em dia (ok/vencendo) e apto
    const latestASOs = latestASOByEmployee(asos);
    let asoOk = 0;
    for (const emp of employees) {
      const st = asoStatus(latestASOs.get(emp.id) ?? null);
      if (st === "ok" || st === "expiring") asoOk++;
    }
    const asoPercent = pct(asoOk, employees.length);

    // Índice global: média dos módulos com dados
    const parts: number[] = [];
    const basico = trainingRows.find((r) => r.type === "nr10_basico");
    if (basico) parts.push(basico.percent);
    if (employees.length > 0) {
      parts.push(authPercent);
      parts.push(asoPercent);
    }
    parts.push(prontuario.percent);
    if (inspPercent !== null) parts.push(inspPercent);
    if (epiPercent !== null) parts.push(epiPercent);
    const overall =
      parts.length > 0 ? Math.round(parts.reduce((s, p) => s + p, 0) / parts.length) : 0;

    return {
      overall,
      employees: employees.length,
      trainingRows,
      validAuth,
      authPercent,
      prontuario,
      inspectionRows,
      inspPercent,
      openActions: openActions.length,
      epis: epis.length,
      epiOk,
      epiPercent,
      asoOk,
      asoPercent,
    };
  }, [
    isLoading,
    employees,
    trainings,
    authorizations,
    documents,
    inspections,
    openActions,
    epis,
    epiTests,
    asos,
  ]);

  return { report, isLoading };
}

/** Payload jsonb gravado em compliance_snapshots (uma entrada por mês). */
export function snapshotPayloadFrom(report: ComplianceReport) {
  const basico = report.trainingRows.find((r) => r.type === "nr10_basico");
  return {
    overall: report.overall,
    capacitacao_basico: basico?.percent ?? null,
    autorizacoes: report.authPercent,
    asos: report.asoPercent,
    prontuario: report.prontuario.percent,
    inspecoes: report.inspPercent,
    epis: report.epiPercent,
    colaboradores: report.employees,
    acoes_abertas: report.openActions,
  };
}

export type SnapshotPayload = ReturnType<typeof snapshotPayloadFrom>;
