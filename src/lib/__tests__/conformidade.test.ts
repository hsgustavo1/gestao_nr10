import { describe, expect, it } from "vitest";
import { pct, snapshotPayloadFrom, type ComplianceReport } from "../conformidade";
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
    });
  });
});
