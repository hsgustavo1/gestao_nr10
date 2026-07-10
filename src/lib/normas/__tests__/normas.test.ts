import { describe, expect, test } from "vitest";
import { CLAUSULAS_NR10_2019 } from "../nr10-clausulas-2019";

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
