import { describe, expect, it } from "vitest";
import { responsaveisInspecaoCampo, labelResponsaveisCampo } from "../rti";

describe("responsaveisInspecaoCampo", () => {
  it("une coletores automáticos e extras manuais, sem duplicar", () => {
    expect(
      responsaveisInspecaoCampo(["Ana", "Bruno"], ["Bruno", "Carla"]),
    ).toEqual(["Ana", "Bruno", "Carla"]);
  });

  it("mantém a ordem: automáticos antes dos manuais", () => {
    expect(responsaveisInspecaoCampo(["Ana"], ["Zeca"])).toEqual(["Ana", "Zeca"]);
  });

  it("ignora nulos, vazios e espaços, e apara os nomes", () => {
    expect(
      responsaveisInspecaoCampo(["  Ana  ", "", null as unknown as string], [" ", "Bruno"]),
    ).toEqual(["Ana", "Bruno"]);
  });

  it("aceita listas nulas nos dois lados", () => {
    expect(responsaveisInspecaoCampo(null, null)).toEqual([]);
  });

  it("dedup é case- e acento-sensível apenas por igualdade exata aparada", () => {
    expect(responsaveisInspecaoCampo(["Ana"], ["ana"])).toEqual(["Ana", "ana"]);
  });
});

describe("labelResponsaveisCampo", () => {
  it("singular para 0 ou 1 nome", () => {
    expect(labelResponsaveisCampo(0)).toBe("Responsável pela inspeção em campo");
    expect(labelResponsaveisCampo(1)).toBe("Responsável pela inspeção em campo");
  });

  it("plural para mais de um nome", () => {
    expect(labelResponsaveisCampo(2)).toBe("Responsáveis pela inspeção em campo");
  });
});
