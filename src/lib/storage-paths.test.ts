import { describe, it, expect } from "vitest";
import {
  slugify,
  reportSlug,
  evidenciaFolder,
  evidenciaFileName,
  evidenciaPath,
  maiorIndiceEvidencia,
} from "./storage-paths";

describe("slugify", () => {
  it("remove acentos, baixa a caixa e troca não-alfanumérico por hífen", () => {
    expect(slugify("Inspeção Periódica — Área 3")).toBe("inspecao-periodica-area-3");
  });
  it("colapsa hífens e apara as pontas", () => {
    expect(slugify("  RTI  //  2026 ")).toBe("rti-2026");
  });
  it("string vazia vira vazio", () => {
    expect(slugify("")).toBe("");
  });
});

describe("reportSlug", () => {
  const id = "6d9ec4c6-902d-4fad-9297-e99646a47d4f";
  it("combina slug do título (máx 40) com os 8 primeiros do id", () => {
    expect(reportSlug({ id, titulo: "RTI - Inspeções periódicas" })).toBe(
      "rti-inspecoes-periodicas-6d9ec4c6",
    );
  });
  it("sem título usa fallback rti-<id8>", () => {
    expect(reportSlug({ id, titulo: null })).toBe("rti-6d9ec4c6");
  });
  it("título só com símbolos cai no fallback", () => {
    expect(reportSlug({ id, titulo: "!!!" })).toBe("rti-6d9ec4c6");
  });
});

describe("evidenciaFolder / evidenciaFileName / evidenciaPath", () => {
  const org = "c221b14e-72c9-4c63-99a6-2fbaf8b26763";
  const report = { id: "6d9ec4c6-902d-4fad-9297-e99646a47d4f", titulo: "RTI 1" };
  it("monta o prefixo por relatório", () => {
    expect(evidenciaFolder(org, report)).toBe(`${org}/rti-1-6d9ec4c6`);
  });
  it("com nome da empresa, prefixa o slug antes do id", () => {
    expect(evidenciaFolder(org, report, "Equipe Interna S/A")).toBe(
      `equipe-interna-s-a-${org}/rti-1-6d9ec4c6`,
    );
  });
  it("nomeia por NC e índice com zero-padding (4 e 2 dígitos)", () => {
    expect(evidenciaFileName(2, 3, "jpg")).toBe("nc-0002-03.jpg");
    expect(evidenciaFileName(10, 1, "jpg")).toBe("nc-0010-01.jpg");
  });
  it("caminho completo", () => {
    expect(evidenciaPath(org, report, 2, 3, "jpg")).toBe(
      `${org}/rti-1-6d9ec4c6/nc-0002-03.jpg`,
    );
  });
});

describe("maiorIndiceEvidencia", () => {
  it("retorna o maior índice da NC pedida, ignorando outras NCs e extensões", () => {
    const names = ["nc-0001-01.jpg", "nc-0001-02.jpeg", "nc-0002-01.jpg", "nc-0010-01.jpg"];
    expect(maiorIndiceEvidencia(names, 1)).toBe(2);
    expect(maiorIndiceEvidencia(names, 2)).toBe(1);
    expect(maiorIndiceEvidencia(names, 10)).toBe(1);
  });
  it("tolera o formato antigo sem padding misturado no mesmo prefixo", () => {
    expect(maiorIndiceEvidencia(["nc-1-1.jpg", "nc-0001-02.jpg"], 1)).toBe(2);
  });
  it("NC sem arquivos retorna 0", () => {
    expect(maiorIndiceEvidencia(["nc-1-1.jpg"], 9)).toBe(0);
  });
  it("nomes fora do padrão são ignorados", () => {
    expect(maiorIndiceEvidencia(["lixo.jpg", "nc-1-x.jpg", "nc-1-4.jpg"], 1)).toBe(4);
  });
});
