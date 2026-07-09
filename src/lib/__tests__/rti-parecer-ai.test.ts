import { describe, expect, test } from "vitest";
import { buildParecerInput, normalizeParecerResponse } from "../rti-parecer-ai";

describe("buildParecerInput", () => {
  test("resume NCs por prioridade e limita itens a 60, mais graves primeiro", () => {
    const ncs = Array.from({ length: 70 }, (_, i) => ({
      numero: i + 1,
      descricao: `NC ${i + 1}`,
      recomendacao: null,
      prioridade: i < 5 ? 4 : 1,
    }));
    const input = buildParecerInput(
      { clienteNome: "Cliente X", titulo: "RTI", normas: "NR-10" },
      ncs,
    );
    expect(input.totalNcs).toBe(70);
    expect(input.porPrioridade[4]).toBe(5);
    expect(input.itens).toHaveLength(60);
    expect(input.itens[0].prioridade).toBe(4);
  });

  test("trunca descrições longas em 300 chars", () => {
    const input = buildParecerInput({ clienteNome: "C", titulo: "T", normas: "" }, [
      { numero: 1, descricao: "x".repeat(500), recomendacao: null, prioridade: 2 },
    ]);
    expect(input.itens[0].descricao.length).toBeLessThanOrEqual(300);
  });
});

describe("normalizeParecerResponse", () => {
  test("aceita o JSON esperado", () => {
    const out = normalizeParecerResponse({ parecer: " ok ", resumo_executivo: "res" });
    expect(out).toEqual({ parecer: "ok", resumoExecutivo: "res" });
  });

  test("campos ausentes viram string vazia", () => {
    expect(normalizeParecerResponse({})).toEqual({ parecer: "", resumoExecutivo: "" });
  });
});
