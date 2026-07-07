import { describe, expect, it } from "vitest";
import { creaAnuidadeEmDia, creaAnuidadeValidadeAtual, requiredTrainings } from "../qualificacoes";
import type { EmployeeCreaAnuidade } from "../qualificacoes";

function anuidade(over: Partial<EmployeeCreaAnuidade> = {}): EmployeeCreaAnuidade {
  return {
    id: "a1",
    employee_id: "e1",
    org_id: "org1",
    ano: 2025,
    validade_ate: "2026-01-31",
    comprovante_arquivo_path: null,
    created_at: "2025-02-01T00:00:00Z",
    ...over,
  };
}

describe("creaAnuidadeEmDia", () => {
  it("está em dia antes da validade informada", () => {
    const today = new Date("2025-06-15T12:00:00");
    expect(creaAnuidadeEmDia([anuidade({ validade_ate: "2026-01-31" })], today)).toBe(true);
  });

  it("vence no dia seguinte à validade informada", () => {
    const today = new Date("2026-02-01T12:00:00");
    expect(creaAnuidadeEmDia([anuidade({ validade_ate: "2026-01-31" })], today)).toBe(false);
  });

  it("não está em dia sem nenhum registro", () => {
    expect(creaAnuidadeEmDia([], new Date("2025-06-15T12:00:00"))).toBe(false);
  });

  it("não conta registro sem validade preenchida", () => {
    expect(creaAnuidadeEmDia([anuidade({ validade_ate: null })], new Date("2025-06-15T12:00:00"))).toBe(false);
  });

  it("considera a validade mais distante entre vários registros", () => {
    const today = new Date("2025-06-15T12:00:00");
    const anuidades = [
      anuidade({ ano: 2023, validade_ate: "2024-01-31" }),
      anuidade({ ano: 2025, validade_ate: "2026-03-15" }),
    ];
    expect(creaAnuidadeEmDia(anuidades, today)).toBe(true);
  });
});

describe("creaAnuidadeValidadeAtual", () => {
  it("retorna null sem nenhuma validade informada", () => {
    expect(creaAnuidadeValidadeAtual([anuidade({ validade_ate: null })])).toBeNull();
  });

  it("retorna a validade mais distante entre os registros", () => {
    const anuidades = [
      anuidade({ ano: 2023, validade_ate: "2024-01-31" }),
      anuidade({ ano: 2025, validade_ate: "2026-03-15" }),
    ];
    expect(creaAnuidadeValidadeAtual(anuidades)).toBe("2026-03-15");
  });
});

describe("requiredTrainings", () => {
  it("mantém regressão: GER/ADM/AGR não exigem áreas classificadas", () => {
    expect(requiredTrainings("GER")).toEqual(["nr10_basico", "sep"]);
    expect(requiredTrainings("ADM")).toEqual(["nr10_basico", "sep"]);
    expect(requiredTrainings("AGR")).toEqual(["nr10_basico", "sep"]);
    expect(requiredTrainings("ELE")).toEqual(["nr10_basico", "nr10_areas_classificadas", "sep"]);
  });
});
