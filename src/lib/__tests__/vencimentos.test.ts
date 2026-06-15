import { describe, expect, it } from "vitest";
import { buildVencimentos, type VencimentosData } from "../vencimentos";
import type { Employee, ITTraining, NR10Training, WorkInstruction } from "../qualificacoes";
import type { NR10Document } from "../prontuario";
import type { Inspection } from "../inspecoes";
import type { EPITest } from "../epis";
import type { EPIWithEmployee } from "../epis-queries";
import type { ASO } from "../asos";

// A Central de Vencimentos, o badge do header e o e-mail semanal dependem de
// `buildVencimentos`. Aqui blindamos a aritmética de cada uma das 6 fontes
// (capacitação +2a, IT +validade, prontuário, inspeção, ensaio de EPI, ASO),
// o filtro de horizonte, o status e a ordenação. Data de referência fixa para
// manter o teste determinístico — todas as datas dos fixtures são relativas.
const TODAY = new Date("2025-06-15T12:00:00");

// ── Factories ────────────────────────────────────────────────────────────────

function emptyData(over: Partial<VencimentosData> = {}): VencimentosData {
  return {
    employees: [],
    trainings: [],
    itTrainings: [],
    instructions: [],
    documents: [],
    inspections: [],
    epis: [],
    epiTests: [],
    asos: [],
    ...over,
  };
}

function employee(over: Partial<Employee> = {}): Employee {
  return {
    id: "emp1",
    name: "João Silva",
    matricula: "001",
    setor: "Manutenção",
    classificacao: null,
    funcao: null,
    escolaridade: null,
    diploma: null,
    diploma_conclusao: null,
    crea_cft: null,
    active: true,
    status: "ativo",
    created_at: "2020-01-01",
    updated_at: "2020-01-01",
    ...over,
  };
}

function training(over: Partial<NR10Training> = {}): NR10Training {
  return {
    id: crypto.randomUUID(),
    employee_id: "emp1",
    training_type: "nr10_basico",
    category: "formacao",
    training_date: "2023-07-01",
    art: null,
    responsavel_tecnico: null,
    valid: true,
    created_at: "2023-07-01",
    updated_at: "2023-07-01",
    ...over,
  };
}

function instruction(over: Partial<WorkInstruction> = {}): WorkInstruction {
  return {
    id: "instr1",
    code: "IT-01",
    title: "Bloqueio e etiquetagem",
    validity_months: 12,
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
    ...over,
  };
}

function itTraining(over: Partial<ITTraining> = {}): ITTraining {
  return {
    id: crypto.randomUUID(),
    employee_id: "emp1",
    instruction_id: "instr1",
    status: "ok",
    conclusao_date: "2023-07-01",
    created_at: "2023-07-01",
    updated_at: "2023-07-01",
    ...over,
  };
}

function doc(over: Partial<NR10Document> = {}): NR10Document {
  return {
    id: crypto.randomUUID(),
    category: "esquema_unifilar",
    title: "Unifilar Galpão A",
    description: null,
    document_date: "2023-01-01",
    validity_date: "2025-07-01",
    file_path: null,
    responsavel: "Eng. Responsável",
    art: null,
    created_by: null,
    created_by_name: null,
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
    ...over,
  };
}

function inspection(over: Partial<Inspection> = {}): Inspection {
  return {
    id: crypto.randomUUID(),
    inspection_type: "rti",
    equipment: "QGBT-01",
    sector: "A",
    inspection_date: "2024-07-01",
    validity_date: "2025-07-01",
    result: "conforme",
    report_path: null,
    responsavel: "Téc. Responsável",
    art: null,
    notes: null,
    created_by: null,
    created_by_name: null,
    created_at: "2024-07-01",
    updated_at: "2024-07-01",
    ...over,
  };
}

function epi(over: Partial<EPIWithEmployee> = {}): EPIWithEmployee {
  return {
    id: "epi1",
    epi_type: "luva_isolante",
    description: null,
    epi_class: "2",
    serial_number: "SN-1",
    ca: null,
    employee_id: null,
    sector: "A",
    acquisition_date: null,
    test_interval_months: 12,
    active: true,
    notes: null,
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
    employees: null,
    ...over,
  };
}

function epiTest(over: Partial<EPITest> = {}): EPITest {
  return {
    id: crypto.randomUUID(),
    epi_id: "epi1",
    test_date: "2024-07-01",
    result: "aprovado",
    laboratory: null,
    certificate_path: null,
    notes: null,
    created_at: "2024-07-01",
    ...over,
  };
}

function aso(over: Partial<ASO> = {}): ASO {
  return {
    id: crypto.randomUUID(),
    employee_id: "emp1",
    exam_date: "2024-07-01",
    validity_date: "2025-07-01",
    tipo: "periodico",
    resultado: "apto",
    apto_eletricidade: true,
    restricoes: null,
    medico: null,
    file_path: null,
    notes: null,
    created_by_name: null,
    created_at: "2024-07-01",
    updated_at: "2024-07-01",
    ...over,
  };
}

// ── Capacitações NR-10 ───────────────────────────────────────────────────────

describe("buildVencimentos — capacitações NR-10", () => {
  it("vencimento = data de treinamento + 2 anos", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      trainings: [
        training({
          employee_id: "emp1",
          training_type: "nr10_basico",
          training_date: "2023-07-01",
        }),
      ],
    });
    const items = buildVencimentos(data, 90, TODAY);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "nr10-emp1|nr10_basico",
      kind: "treinamento",
      dueDate: "2025-07-01",
      daysLeft: 16,
      status: "expiring",
      link: "/qualificacoes/nr10",
    });
  });

  it("usa a data mais recente entre formação e reciclagem", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      trainings: [
        training({
          employee_id: "emp1",
          training_type: "sep",
          category: "formacao",
          training_date: "2021-01-01",
        }),
        training({
          employee_id: "emp1",
          training_type: "sep",
          category: "reciclagem",
          training_date: "2023-06-20",
        }),
      ],
    });
    const items = buildVencimentos(data, 90, TODAY);
    expect(items).toHaveLength(1);
    expect(items[0].dueDate).toBe("2025-06-20");
  });

  it("marca como expirado quando passou da validade", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      trainings: [training({ employee_id: "emp1", training_date: "2022-01-01" })],
    });
    const [item] = buildVencimentos(data, 90, TODAY);
    expect(item.status).toBe("expired");
    expect(item.daysLeft).toBeLessThan(0);
  });

  it("ignora colaborador fora da lista (apenas ativos entram)", () => {
    const data = emptyData({
      employees: [],
      trainings: [training({ employee_id: "emp-desligado" })],
    });
    expect(buildVencimentos(data, 90, TODAY)).toHaveLength(0);
  });

  it("ignora treinamento sem data", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      trainings: [training({ employee_id: "emp1", training_date: null })],
    });
    expect(buildVencimentos(data, 90, TODAY)).toHaveLength(0);
  });
});

// ── Filtro de horizonte ──────────────────────────────────────────────────────

describe("buildVencimentos — filtro de horizonte", () => {
  it("exclui itens além do horizonte", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      trainings: [training({ employee_id: "emp1", training_date: "2024-01-01" })], // vence 2026-01-01
    });
    expect(buildVencimentos(data, 90, TODAY)).toHaveLength(0);
  });

  it("inclui vencidos independentemente do horizonte", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      trainings: [training({ employee_id: "emp1", training_date: "2020-01-01" })], // vence 2022-01-01
    });
    expect(buildVencimentos(data, 90, TODAY)).toHaveLength(1);
  });

  it("respeita horizonte customizado", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      trainings: [training({ employee_id: "emp1", training_date: "2023-07-01" })], // vence 2025-07-01 (16 dias)
    });
    expect(buildVencimentos(data, 10, TODAY)).toHaveLength(0);
    expect(buildVencimentos(data, 30, TODAY)).toHaveLength(1);
  });

  it("retorna vazio quando não há dados", () => {
    expect(buildVencimentos(emptyData(), 90, TODAY)).toEqual([]);
  });
});

// ── Instruções de Trabalho ───────────────────────────────────────────────────

describe("buildVencimentos — Instruções de Trabalho", () => {
  it("validade padrão de 24 meses quando a IT não é encontrada", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      itTrainings: [
        itTraining({
          id: "x",
          employee_id: "emp1",
          instruction_id: "inexistente",
          conclusao_date: "2023-07-01",
        }),
      ],
      instructions: [],
    });
    const [item] = buildVencimentos(data, 90, TODAY);
    expect(item.kind).toBe("it");
    expect(item.dueDate).toBe("2025-07-01"); // +24 meses
    expect(item.title).toBe("Instrução de Trabalho");
  });

  it("usa validity_months da IT vinculada", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      instructions: [
        instruction({ id: "instr1", code: "IT-05", title: "LOTO", validity_months: 12 }),
      ],
      itTrainings: [
        itTraining({
          id: "x",
          employee_id: "emp1",
          instruction_id: "instr1",
          conclusao_date: "2024-07-01",
        }),
      ],
    });
    const [item] = buildVencimentos(data, 90, TODAY);
    expect(item.dueDate).toBe("2025-07-01"); // +12 meses
    expect(item.title).toBe("IT IT-05 — LOTO");
  });

  it("ignora IT sem data de conclusão", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      itTrainings: [itTraining({ employee_id: "emp1", conclusao_date: null })],
    });
    expect(buildVencimentos(data, 90, TODAY)).toHaveLength(0);
  });
});

// ── Prontuário, inspeções e ASO ──────────────────────────────────────────────

describe("buildVencimentos — prontuário, inspeções e ASO", () => {
  it("documento usa validity_date diretamente", () => {
    const data = emptyData({
      documents: [doc({ id: "d1", category: "esquema_unifilar", validity_date: "2025-07-01" })],
    });
    const [item] = buildVencimentos(data, 90, TODAY);
    expect(item).toMatchObject({ kind: "documento", dueDate: "2025-07-01", link: "/nr10" });
  });

  it("ignora documento sem validade", () => {
    const data = emptyData({ documents: [doc({ validity_date: null })] });
    expect(buildVencimentos(data, 90, TODAY)).toHaveLength(0);
  });

  it("inspeção termográfica aponta para /termografias", () => {
    const data = emptyData({
      inspections: [inspection({ inspection_type: "termografia", validity_date: "2025-07-01" })],
    });
    const [item] = buildVencimentos(data, 90, TODAY);
    expect(item.link).toBe("/termografias");
  });

  it("inspeção RTI aponta para /rti", () => {
    const data = emptyData({
      inspections: [inspection({ inspection_type: "rti", validity_date: "2025-07-01" })],
    });
    const [item] = buildVencimentos(data, 90, TODAY);
    expect(item.link).toBe("/rti");
  });

  it("ignora inspeção sem validade", () => {
    const data = emptyData({ inspections: [inspection({ validity_date: null })] });
    expect(buildVencimentos(data, 90, TODAY)).toHaveLength(0);
  });

  it("ASO mais recente por colaborador, validade como vencimento", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" })],
      asos: [
        aso({
          id: "aso-old",
          employee_id: "emp1",
          exam_date: "2023-01-01",
          validity_date: "2024-01-01",
        }),
        aso({
          id: "aso-new",
          employee_id: "emp1",
          exam_date: "2024-07-01",
          validity_date: "2025-07-01",
        }),
      ],
    });
    const items = buildVencimentos(data, 90, TODAY);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "aso-aso-new", kind: "aso", dueDate: "2025-07-01" });
  });
});

// ── Ensaios de EPI ───────────────────────────────────────────────────────────

describe("buildVencimentos — ensaios de EPI", () => {
  it("próximo ensaio = último aprovado + intervalo", () => {
    const data = emptyData({
      epis: [epi({ id: "epi1", test_interval_months: 12 })],
      epiTests: [epiTest({ epi_id: "epi1", test_date: "2024-07-01", result: "aprovado" })],
    });
    const [item] = buildVencimentos(data, 90, TODAY);
    expect(item).toMatchObject({ kind: "epi", dueDate: "2025-07-01", link: "/epis" });
  });

  it("ignora EPI cujo último ensaio foi reprovado", () => {
    const data = emptyData({
      epis: [epi({ id: "epi1" })],
      epiTests: [epiTest({ epi_id: "epi1", result: "reprovado" })],
    });
    expect(buildVencimentos(data, 90, TODAY)).toHaveLength(0);
  });

  it("ignora EPI sem ensaios", () => {
    const data = emptyData({ epis: [epi({ id: "epi1" })], epiTests: [] });
    expect(buildVencimentos(data, 90, TODAY)).toHaveLength(0);
  });
});

// ── Ordenação e status ───────────────────────────────────────────────────────

describe("buildVencimentos — ordenação e status", () => {
  it("ordena por daysLeft ascendente (mais urgente primeiro)", () => {
    const data = emptyData({
      employees: [employee({ id: "emp1" }), employee({ id: "emp2", matricula: "002" })],
      trainings: [
        training({
          employee_id: "emp1",
          training_type: "nr10_basico",
          training_date: "2023-08-01",
        }), // vence 2025-08-01
        training({
          employee_id: "emp2",
          training_type: "nr10_basico",
          training_date: "2022-01-01",
        }), // vencido
      ],
    });
    const items = buildVencimentos(data, 90, TODAY);
    expect(items).toHaveLength(2);
    expect(items[0].daysLeft).toBeLessThan(items[1].daysLeft);
    expect(items[0].status).toBe("expired");
    expect(items[1].status).toBe("expiring");
  });
});
