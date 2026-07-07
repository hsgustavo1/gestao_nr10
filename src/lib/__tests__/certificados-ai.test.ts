import { describe, expect, it } from "vitest";
import {
  extractLatestDateGuess,
  groupPagesByFrenteVerso,
  inferCategory,
  matchEmployeeByName,
  normalizeOrientation,
  normalizePageAnalysis,
  type PageAnalysis,
} from "../certificados-ai";
import type { Employee } from "../qualificacoes";

function emp(over: Partial<Employee> = {}): Employee {
  return {
    id: "e1",
    name: "GUSTAVO HENRIQUE SILVA",
    matricula: "32224",
    setor: "ELE",
    classificacao: null,
    funcao: null,
    escolaridade: null,
    diploma: null,
    diploma_conclusao: null,
    crea_cft: null,
    active: true,
    status: "ativo",
    created_at: "",
    updated_at: "",
    ...over,
  };
}

function analysis(over: Partial<PageAnalysis> = {}): PageAnalysis {
  return {
    orientation_correction: 0,
    page_type: "frente",
    employee_name_read: "GUSTAVO HENRIQUE SILVA",
    training_course_read: "NR-10 Básico",
    training_type_guess: "nr10_basico",
    category_guess: "formacao",
    workload_hours_read: 40,
    training_date_read: null,
    dates_read: [],
    confidence: "alta",
    ...over,
  };
}

describe("normalizeOrientation", () => {
  it("aceita os 4 valores válidos", () => {
    expect(normalizeOrientation(0)).toBe(0);
    expect(normalizeOrientation(90)).toBe(90);
    expect(normalizeOrientation(180)).toBe(180);
    expect(normalizeOrientation(270)).toBe(270);
  });

  it("normaliza strings e valores fora de faixa", () => {
    expect(normalizeOrientation("90")).toBe(90);
    expect(normalizeOrientation(360)).toBe(0);
    expect(normalizeOrientation(-90)).toBe(270);
    expect(normalizeOrientation(85)).toBe(90);
  });

  it("cai em 0 para lixo", () => {
    expect(normalizeOrientation(null)).toBe(0);
    expect(normalizeOrientation("abc")).toBe(0);
    expect(normalizeOrientation(undefined)).toBe(0);
  });
});

describe("inferCategory", () => {
  it("40h → formação (independe do palpite/confiança do modelo)", () => {
    expect(inferCategory({ workload_hours_read: 40, category_guess: "reciclagem", confidence: "baixa" })).toBe(
      "formacao",
    );
  });

  it("16h → reciclagem mesmo se o modelo disse formação", () => {
    expect(inferCategory({ workload_hours_read: 16, category_guess: "formacao", confidence: "alta" })).toBe(
      "reciclagem",
    );
  });

  it("sem carga horária cai no palpite quando a confiança não é baixa", () => {
    expect(inferCategory({ workload_hours_read: null, category_guess: "formacao", confidence: "media" })).toBe(
      "formacao",
    );
  });

  it("sem carga horária e confiança baixa → em branco", () => {
    expect(inferCategory({ workload_hours_read: null, category_guess: "formacao", confidence: "baixa" })).toBe(
      "",
    );
  });

  it("carga horária ambígua (26h) cai no palpite do modelo", () => {
    expect(inferCategory({ workload_hours_read: 26, category_guess: "reciclagem", confidence: "media" })).toBe(
      "reciclagem",
    );
  });
});

describe("groupPagesByFrenteVerso — baixa confiança deixa tipo em branco", () => {
  it("não pré-preenche training_type quando confiança é baixa", () => {
    const groups = groupPagesByFrenteVerso(
      [
        {
          orientation_correction: 0,
          page_type: "frente",
          employee_name_read: "ALGUEM",
          training_course_read: "NR-10",
          training_type_guess: "nr10_basico",
          category_guess: "formacao",
          workload_hours_read: null,
          training_date_read: null,
          dates_read: [],
          confidence: "baixa",
        },
      ],
      [],
    );
    expect(groups[0].trainingType).toBe("");
    expect(groups[0].category).toBe("");
  });
});

describe("normalizePageAnalysis", () => {
  it("mantém frente quando há nome", () => {
    expect(normalizePageAnalysis(analysis({ page_type: "frente" })).page_type).toBe("frente");
  });

  it("força verso quando não há nome, mesmo se o modelo disse frente", () => {
    const result = normalizePageAnalysis(analysis({ page_type: "frente", employee_name_read: null }));
    expect(result.page_type).toBe("verso");
  });

  it("mantém verso quando não há nome", () => {
    expect(normalizePageAnalysis(analysis({ page_type: "verso", employee_name_read: null })).page_type).toBe(
      "verso",
    );
  });
});

describe("matchEmployeeByName", () => {
  const employees = [
    emp({ id: "1", name: "GUSTAVO DE OLIVEIRA BERNARDES DE SOUZA" }),
    emp({ id: "2", name: "GUSTAVO HENRIQUE SILVA" }),
    emp({ id: "3", name: "JAELTON SOUZA DA CONCEIÇÃO" }),
  ];

  it("casa nome exato", () => {
    expect(matchEmployeeByName("JAELTON SOUZA DA CONCEIÇÃO", employees)?.id).toBe("3");
  });

  it("tolera pequena variação de OCR (acento/pontuação)", () => {
    expect(matchEmployeeByName("JAELTON SOUZA DA CONCFICAO", employees)?.id).toBe("3");
  });

  it("não confunde nomes parecidos (Gustavo x2)", () => {
    expect(matchEmployeeByName("GUSTAVO HENRIQUE SILVA", employees)?.id).toBe("2");
    expect(matchEmployeeByName("GUSTAVO DE OLIVEIRA BERNARDES DE SOUZA", employees)?.id).toBe("1");
  });

  it("retorna null sem nome lido", () => {
    expect(matchEmployeeByName(null, employees)).toBeNull();
  });

  it("retorna null quando não há correspondência razoável", () => {
    expect(matchEmployeeByName("FULANO DE TAL NINGUEM", employees)).toBeNull();
  });
});

describe("extractLatestDateGuess", () => {
  it("extrai a data mais recente entre várias", () => {
    expect(extractLatestDateGuess(["realizado em 06/04/2026 e 09/04/2026"])).toBe("2026-04-09");
  });

  it("retorna null sem datas", () => {
    expect(extractLatestDateGuess([])).toBeNull();
    expect(extractLatestDateGuess(["sem data aqui"])).toBeNull();
  });
});

describe("groupPagesByFrenteVerso", () => {
  const employees = [emp({ id: "1", name: "ALEXSANDRO ALVES DE LIMA" })];

  it("agrupa frente + versos subsequentes num único certificado", () => {
    const analyses: (PageAnalysis | null)[] = [
      analysis({ page_type: "frente", employee_name_read: "ALEXSANDRO ALVES DE LIMA" }),
      analysis({ page_type: "verso", employee_name_read: null }),
    ];
    const groups = groupPagesByFrenteVerso(analyses, employees);
    expect(groups).toHaveLength(1);
    expect(groups[0].pages).toEqual([1, 2]);
    expect(groups[0].employee?.id).toBe("1");
  });

  it("separa certificados consecutivos de pessoas diferentes", () => {
    const analyses: (PageAnalysis | null)[] = [
      analysis({ page_type: "frente", employee_name_read: "ALEXSANDRO ALVES DE LIMA" }),
      analysis({ page_type: "verso", employee_name_read: null }),
      analysis({ page_type: "frente", employee_name_read: "OUTRA PESSOA QUALQUER" }),
      analysis({ page_type: "verso", employee_name_read: null }),
    ];
    const groups = groupPagesByFrenteVerso(analyses, employees);
    expect(groups).toHaveLength(2);
    expect(groups[0].pages).toEqual([1, 2]);
    expect(groups[1].pages).toEqual([3, 4]);
    expect(groups[1].employee).toBeNull();
  });

  it("página com falha na IA (null) sempre inicia novo grupo sem colaborador", () => {
    const analyses: (PageAnalysis | null)[] = [
      analysis({ page_type: "frente", employee_name_read: "ALEXSANDRO ALVES DE LIMA" }),
      null,
    ];
    const groups = groupPagesByFrenteVerso(analyses, employees);
    expect(groups).toHaveLength(2);
    expect(groups[1].employee).toBeNull();
    expect(groups[1].pages).toEqual([2]);
  });

  it("propaga a data de realização (training_date_read), não a de emissão", () => {
    const analyses: (PageAnalysis | null)[] = [
      analysis({
        page_type: "frente",
        employee_name_read: "ALEXSANDRO ALVES DE LIMA",
        training_date_read: "12/03/2026",
        dates_read: ["Emitido em 20/03/2026"],
      }),
    ];
    const groups = groupPagesByFrenteVerso(analyses, employees);
    expect(groups[0].dataRealizacao).toBe("2026-03-12");
  });
});
