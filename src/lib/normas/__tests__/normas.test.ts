import { describe, expect, test } from "vitest";
import { CLAUSULAS_NR10_2019 } from "../nr10-clausulas-2019";
import { CLAUSULAS_NR10_2026 } from "../nr10-clausulas-2026";

describe("CLAUSULAS_NR10_2019", () => {
  test("contém os itens que a NR-28 classifica", () => {
    const itens = new Set(CLAUSULAS_NR10_2019.map((c) => c.item));
    for (const req of ["10.2.1", "10.2.4", "10.4.1", "10.8.5", "10.8.6"]) {
      expect(itens.has(req)).toBe(true);
    }
  });

  test("todo item declara capítulo coerente com o próprio número", () => {
    for (const c of CLAUSULAS_NR10_2019) {
      expect(c.item.startsWith(c.capitulo)).toBe(true);
      expect(c.titulo.length).toBeGreaterThan(0);
    }
  });
});

describe("CLAUSULAS_NR10_2026", () => {
  test("reflete a renumeração da Portaria 737", () => {
    const itens = new Set(CLAUSULAS_NR10_2026.map((c) => c.item));
    // Prontuário migra de 10.2.4 para 10.15; habilitação de 10.8 para 10.10.
    expect(itens.has("10.15")).toBe(true);
    expect(itens.has("10.10")).toBe(true);
    // Capítulos novos.
    expect(itens.has("10.3")).toBe(true); // GRO
    expect(itens.has("10.16")).toBe(true); // GIR
  });

  test("todo item declara capítulo coerente e título não vazio", () => {
    for (const c of CLAUSULAS_NR10_2026) {
      expect(c.item.startsWith(c.capitulo)).toBe(true);
      expect(c.titulo.length).toBeGreaterThan(0);
    }
  });
});
