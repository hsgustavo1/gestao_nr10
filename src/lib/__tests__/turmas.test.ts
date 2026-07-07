import { describe, it, expect } from "vitest";
import {
  suggestTurmaForBatch,
  detectTurmaDiscrepancies,
  turmaCompleteness,
  type TurmaCandidate,
} from "../turmas";

const turma = (o: Partial<TurmaCandidate>): TurmaCandidate => ({
  id: "t1",
  training_type: "nr10_basico",
  category: "reciclagem",
  data: "2026-03-12",
  art: null,
  ...o,
});

describe("suggestTurmaForBatch", () => {
  it("casa por tipo+categoria+data dentro da janela de ±3 dias", () => {
    const res = suggestTurmaForBatch(
      { trainingType: "nr10_basico", category: "reciclagem", dataRealizacao: "2026-03-13" },
      [turma({ id: "t1", data: "2026-03-12" }), turma({ id: "t2", data: "2026-05-01" })],
    );
    expect(res?.id).toBe("t1");
  });

  it("prioriza match exato por número de ART quando presente", () => {
    const res = suggestTurmaForBatch(
      {
        trainingType: "nr10_basico",
        category: "reciclagem",
        dataRealizacao: "2026-05-30",
        art: "ART-123",
      },
      [
        turma({ id: "t1", data: "2026-03-12", art: "ART-123" }),
        turma({ id: "t2", data: "2026-05-29" }),
      ],
    );
    expect(res?.id).toBe("t1");
  });

  it("não sugere nada fora da janela e sem ART", () => {
    const res = suggestTurmaForBatch(
      { trainingType: "nr10_basico", category: "reciclagem", dataRealizacao: "2026-01-01" },
      [turma({ id: "t1", data: "2026-03-12" })],
    );
    expect(res).toBeNull();
  });

  it("não casa categoria diferente", () => {
    const res = suggestTurmaForBatch(
      { trainingType: "nr10_basico", category: "formacao", dataRealizacao: "2026-03-12" },
      [turma({ id: "t1", category: "reciclagem", data: "2026-03-12" })],
    );
    expect(res).toBeNull();
  });
});

describe("detectTurmaDiscrepancies", () => {
  const base = { data: "2026-03-12", carga_horaria: 16 as number | null };

  it("alerta forte quando data de realização diverge da turma", () => {
    const d = detectTurmaDiscrepancies(base, { dataRealizacao: "2026-04-20", workloadHours: 16 });
    expect(d.some((x) => x.field === "data_realizacao" && x.severity === "alta")).toBe(true);
  });

  it("não alerta quando data de realização bate", () => {
    const d = detectTurmaDiscrepancies(base, { dataRealizacao: "2026-03-12", workloadHours: 16 });
    expect(d.find((x) => x.field === "data_realizacao")).toBeUndefined();
  });

  it("alerta médio quando carga horária diverge", () => {
    const d = detectTurmaDiscrepancies(base, { dataRealizacao: "2026-03-12", workloadHours: 40 });
    expect(d.some((x) => x.field === "carga_horaria" && x.severity === "media")).toBe(true);
  });

  it("ignora datas ausentes (sem dado, sem alerta)", () => {
    const d = detectTurmaDiscrepancies(
      { data: null, carga_horaria: null },
      { dataRealizacao: null, workloadHours: null },
    );
    expect(d).toEqual([]);
  });
});

describe("turmaCompleteness", () => {
  it("completa quando todos os participantes têm certificado", () => {
    const c = turmaCompleteness({ art: "ART-1" }, ["a", "b"], new Set(["a", "b"]));
    expect(c).toEqual({ hasArt: true, certs: 2, total: 2, complete: true });
  });

  it("incompleta quando falta certificado", () => {
    const c = turmaCompleteness({ art: "ART-1" }, ["a", "b"], new Set(["a"]));
    expect(c.complete).toBe(false);
    expect(c.certs).toBe(1);
  });

  it("sem ART ainda pode estar completa (ART não conta)", () => {
    const c = turmaCompleteness({ art: null }, ["a"], new Set(["a"]));
    expect(c).toEqual({ hasArt: false, certs: 1, total: 1, complete: true });
  });
});
