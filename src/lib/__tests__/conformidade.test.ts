import { describe, expect, it } from "vitest";
import {
  incidentCompliancePercent,
  pct,
  snapshotPayloadFrom,
  type ComplianceReport,
} from "../conformidade";
import { prontuarioCompleteness } from "../prontuario";

// O índice de conformidade e o payload de snapshot alimentam o /relatorio, o
// dossiê de fiscalização e a tendência mensal — estes testes blindam a
// aritmética de percentuais e o mapeamento gravado em compliance_snapshots.

describe("pct", () => {
  it("total zero → 100 (vacuosamente conforme)", () => {
    expect(pct(0, 0)).toBe(100);
  });
  it("arredonda para o inteiro mais próximo", () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
  });
  it("parte igual ao total → 100", () => {
    expect(pct(5, 5)).toBe(100);
  });
  it("parte zero com total positivo → 0", () => {
    expect(pct(0, 4)).toBe(0);
  });
});

describe("snapshotPayloadFrom", () => {
  const baseReport = (over: Partial<ComplianceReport> = {}): ComplianceReport => ({
    overall: 80,
    employees: 12,
    trainingRows: [
      { type: "nr10_basico", label: "NR-10 Básico", valid: 10, universe: 12, percent: 83 },
      { type: "sep", label: "SEP", valid: 4, universe: 5, percent: 80 },
    ],
    validAuth: 11,
    authPercent: 92,
    prontuario: prontuarioCompleteness([]),
    inspectionRows: [],
    inspPercent: null,
    openActions: 3,
    epis: 0,
    epiOk: 0,
    epiPercent: null,
    asoOk: 9,
    asoPercent: 75,
    incidents: 0,
    incidentsOpen: 0,
    incidentPercent: 100,
    ...over,
  });

  it("extrai o percentual do NR-10 básico", () => {
    expect(snapshotPayloadFrom(baseReport()).capacitacao_basico).toBe(83);
  });

  it("básico ausente → capacitacao_basico null", () => {
    const r = baseReport({
      trainingRows: [{ type: "sep", label: "SEP", valid: 4, universe: 5, percent: 80 }],
    });
    expect(snapshotPayloadFrom(r).capacitacao_basico).toBeNull();
  });

  it("mapeia os demais campos do snapshot", () => {
    const report = baseReport();
    const p = snapshotPayloadFrom(report);
    expect(p).toMatchObject({
      overall: 80,
      autorizacoes: 92,
      asos: 75,
      prontuario: report.prontuario.percent,
      inspecoes: null,
      epis: null,
      colaboradores: 12,
      acoes_abertas: 3,
      incidentes: 100,
    });
  });
});

describe("incidentCompliancePercent", () => {
  it("sem incidentes → 100 (eixo limpo)", () => {
    expect(incidentCompliancePercent([])).toBe(100);
  });

  it("todos resolvidos → 100, independente da gravidade", () => {
    expect(
      incidentCompliancePercent([
        { gravidade: "fatal", status: "concluido" },
        { gravidade: "leve", status: "concluido" },
      ]),
    ).toBe(100);
  });

  it("todos abertos → 0", () => {
    expect(
      incidentCompliancePercent([
        { gravidade: "leve", status: "aberto" },
        { gravidade: "moderada", status: "em_investigacao" },
      ]),
    ).toBe(0);
  });

  it("incidente grave aberto pesa mais que um leve aberto", () => {
    // 1 leve aberto (peso 1) entre 1 leve resolvido (peso 1) + esse aberto: 50%
    const comLeve = incidentCompliancePercent([
      { gravidade: "leve", status: "concluido" },
      { gravidade: "leve", status: "aberto" },
    ]);
    // mesma proporção de itens, mas o aberto agora é grave (peso 3) — penaliza mais
    const comGrave = incidentCompliancePercent([
      { gravidade: "leve", status: "concluido" },
      { gravidade: "grave", status: "aberto" },
    ]);
    expect(comGrave).toBeLessThan(comLeve);
  });
});
