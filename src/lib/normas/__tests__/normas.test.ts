import { describe, expect, test } from "vitest";
import { CLAUSULAS_NR10_2019 } from "../nr10-clausulas-2019";
import { CLAUSULAS_NR10_2026 } from "../nr10-clausulas-2026";
import { NR28_GRAVIDADE } from "../nr28-gravidade";
import { NBR_REFS } from "../nbr-refs";
import {
  normaVersaoVigente,
  clausulasNR10,
  itemCasaBase,
  validarNormaRef,
  gravidadeNR28,
  gravidadeEfetiva,
} from "../index";

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

describe("NR28_GRAVIDADE", () => {
  test("classifica os itens verificados nesta sessão", () => {
    const porItem = (base: string) =>
      NR28_GRAVIDADE.find((l) => l.itens.includes(base));
    expect(porItem("10.2.1")?.gravidade).toBe(4);
    expect(porItem("10.2.4")?.gravidade).toBe(2);
    expect(porItem("10.4.1")?.gravidade).toBe(4);
    expect(porItem("10.8.5")?.gravidade).toBe(2);
  });

  test("gravidade sempre entre 1 e 4 e área S ou M", () => {
    for (const l of NR28_GRAVIDADE) {
      expect(l.gravidade).toBeGreaterThanOrEqual(1);
      expect(l.gravidade).toBeLessThanOrEqual(4);
      expect(["S", "M"]).toContain(l.area);
      expect(l.itens.length).toBeGreaterThan(0);
    }
  });
});

describe("NBR_REFS", () => {
  test("lista NBRs citáveis sem reproduzir texto da norma", () => {
    expect(NBR_REFS.length).toBeGreaterThan(0);
    for (const r of NBR_REFS) {
      expect(r.norma.startsWith("NBR")).toBe(true);
      expect(r.descricao.length).toBeGreaterThan(0);
    }
  });
});

describe("normaVersaoVigente", () => {
  test("antes de 01/06/2027 → nr10:2019", () => {
    expect(normaVersaoVigente(new Date("2027-05-31T23:59:59Z"))).toBe("nr10:2019");
  });
  test("em/depois de 01/06/2027 → nr10:2026", () => {
    expect(normaVersaoVigente(new Date("2027-06-01T00:00:00Z"))).toBe("nr10:2026");
    expect(normaVersaoVigente(new Date("2028-01-10T12:00:00Z"))).toBe("nr10:2026");
  });
});

describe("itemCasaBase", () => {
  test("igual ou subitem casa; vizinho numérico não", () => {
    expect(itemCasaBase("10.2.4", "10.2.4")).toBe(true);
    expect(itemCasaBase("10.2.4.g", "10.2.4")).toBe(true);
    expect(itemCasaBase("10.2.40", "10.2.4")).toBe(false);
    expect(itemCasaBase("10.2.5", "10.2.4")).toBe(false);
  });
});

describe("clausulasNR10", () => {
  test("devolve o catálogo da versão pedida", () => {
    expect(clausulasNR10("nr10:2019").some((c) => c.item === "10.2.4")).toBe(true);
    expect(clausulasNR10("nr10:2026").some((c) => c.item === "10.15")).toBe(true);
  });
});

describe("validarNormaRef", () => {
  test("item NR-10 válido/ inválido por versão", () => {
    expect(validarNormaRef({ tipo: "nr10", ref: "10.2.4.g" }, "nr10:2019")).toBe(true);
    expect(validarNormaRef({ tipo: "nr10", ref: "10.15" }, "nr10:2019")).toBe(false);
    expect(validarNormaRef({ tipo: "nr10", ref: "10.15" }, "nr10:2026")).toBe(true);
  });
  test("nbr/outra: texto não-vazio é válido", () => {
    expect(validarNormaRef({ tipo: "nbr", ref: "NBR 5410 6.1.8.1" }, "nr10:2019")).toBe(true);
    expect(validarNormaRef({ tipo: "outra", ref: "" }, "nr10:2019")).toBe(false);
  });
});

describe("gravidadeNR28", () => {
  test("máximo entre itens citados", () => {
    const r = gravidadeNR28(
      [
        { tipo: "nr10", ref: "10.2.4.g" }, // gravidade 2
        { tipo: "nr10", ref: "10.4.1" }, // gravidade 4
      ],
      "nr10:2019",
    );
    expect(r?.gravidade).toBe(4);
    expect(r?.codigos).toContain("210178-5");
  });
  test("item desconhecido é ignorado", () => {
    expect(gravidadeNR28([{ tipo: "nr10", ref: "10.99" }], "nr10:2019")).toBeNull();
  });
  test("NBR não contribui", () => {
    expect(gravidadeNR28([{ tipo: "nbr", ref: "NBR 5410" }], "nr10:2019")).toBeNull();
  });
  test("versão 2026 → indisponível (null)", () => {
    expect(gravidadeNR28([{ tipo: "nr10", ref: "10.15" }], "nr10:2026")).toBeNull();
  });
});

describe("gravidadeEfetiva", () => {
  test("override tem precedência sobre a derivada", () => {
    const nc = { normas: [{ tipo: "nr10" as const, ref: "10.2.4" }], gravidade_nr28_override: 3 };
    expect(gravidadeEfetiva(nc, "nr10:2019")).toBe(3);
  });
  test("sem override cai na derivada", () => {
    const nc = { normas: [{ tipo: "nr10" as const, ref: "10.4.1" }], gravidade_nr28_override: null };
    expect(gravidadeEfetiva(nc, "nr10:2019")).toBe(4);
  });
  test("sem override e sem ref NR-10 → null", () => {
    const nc = { normas: [{ tipo: "nbr" as const, ref: "NBR 5410" }], gravidade_nr28_override: null };
    expect(gravidadeEfetiva(nc, "nr10:2019")).toBeNull();
  });
});
