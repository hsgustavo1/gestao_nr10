import { describe, expect, it } from "vitest";
import { creaAnuidadeEmDia, creaAnuidadeValidadeAtual, creaAnuidadeValidoAte, requiredTrainings } from "../qualificacoes";
import type { EmployeeCreaAnuidade } from "../qualificacoes";

function anuidade(over: Partial<EmployeeCreaAnuidade> = {}): EmployeeCreaAnuidade {
  return {
    id: "a1",
    employee_id: "e1",
    org_id: "org1",
    ano: 2025,
    data_pagamento: "2025-02-01",
    comprovante_arquivo_path: null,
    created_at: "2025-02-01T00:00:00Z",
    ...over,
  };
}

describe("creaAnuidadeValidoAte", () => {
  it("vale até 31/01 do ano seguinte", () => {
    expect(creaAnuidadeValidoAte(2025)).toBe("2026-01-31");
  });
});

describe("creaAnuidadeEmDia", () => {
  it("está em dia dentro do próprio ano pago", () => {
    const today = new Date("2025-06-15T12:00:00");
    expect(creaAnuidadeEmDia([anuidade({ ano: 2025 })], today)).toBe(true);
  });

  it("ainda está em dia em janeiro do ano seguinte, antes do dia 31", () => {
    const today = new Date("2026-01-15T12:00:00");
    expect(creaAnuidadeEmDia([anuidade({ ano: 2025 })], today)).toBe(true);
  });

  it("vence a partir de 1º de fevereiro do ano seguinte", () => {
    const today = new Date("2026-02-01T12:00:00");
    expect(creaAnuidadeEmDia([anuidade({ ano: 2025 })], today)).toBe(false);
  });

  it("não está em dia sem nenhum registro", () => {
    expect(creaAnuidadeEmDia([], new Date("2025-06-15T12:00:00"))).toBe(false);
  });

  it("não conta ano sem data de pagamento preenchida", () => {
    expect(creaAnuidadeEmDia([anuidade({ ano: 2025, data_pagamento: null })], new Date("2025-06-15T12:00:00"))).toBe(
      false,
    );
  });

  it("considera a anuidade paga mais recente entre vários registros", () => {
    const today = new Date("2025-06-15T12:00:00");
    const anuidades = [anuidade({ ano: 2023, data_pagamento: "2023-02-01" }), anuidade({ ano: 2025 })];
    expect(creaAnuidadeEmDia(anuidades, today)).toBe(true);
  });
});

describe("creaAnuidadeValidadeAtual", () => {
  it("retorna null sem pagamentos", () => {
    expect(creaAnuidadeValidadeAtual([])).toBeNull();
  });

  it("retorna a validade do ano pago mais recente", () => {
    expect(creaAnuidadeValidadeAtual([anuidade({ ano: 2025 })])).toBe("2026-01-31");
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
