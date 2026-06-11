import { describe, expect, it } from "vitest";
import {
  caminhoAbaixoDoSetor, filhosDoNo, nodePath, normalizarEstrutura, proximoNivel, setorDoNo,
  type FieldNode,
} from "../campo";

// Helper para montar nós de teste com o mínimo de campos
function no(id: string, parent: string | null, nivel: FieldNode["nivel"], nome: string, ordem = 0): FieldNode {
  return { id, inspection_id: "i", parent_id: parent, nivel, nome, ordem, created_at: "", updated_at: "" };
}

// Árvore: Setor "Moagem" → Ativo "CCM-02" → Componente "Gaveta G4"
const setor = no("s1", null, "setor", "Moagem", 1);
const ativo = no("a1", "s1", "ativo", "CCM-02", 1);
const comp = no("c1", "a1", "componente", "Gaveta G4", 1);
const setor2 = no("s2", null, "setor", "Caldeira", 2);
const byId = new Map([setor, ativo, comp, setor2].map((n) => [n.id, n]));

describe("proximoNivel", () => {
  it("raiz → setor", () => expect(proximoNivel(null)).toBe("setor"));
  it("setor → ativo", () => expect(proximoNivel("setor")).toBe("ativo"));
  it("ativo → componente", () => expect(proximoNivel("ativo")).toBe("componente"));
  it("componente é folha", () => expect(proximoNivel("componente")).toBeNull());
});

describe("nodePath / setorDoNo / caminhoAbaixoDoSetor", () => {
  it("caminho do componente vai do setor até ele", () => {
    expect(nodePath("c1", byId).map((n) => n.nome)).toEqual(["Moagem", "CCM-02", "Gaveta G4"]);
  });
  it("setor (raiz) é o primeiro do caminho", () => {
    expect(setorDoNo("c1", byId)?.nome).toBe("Moagem");
    expect(setorDoNo("a1", byId)?.nome).toBe("Moagem");
    expect(setorDoNo("s1", byId)?.nome).toBe("Moagem");
  });
  it("prefixo abaixo do setor (ativo › componente)", () => {
    expect(caminhoAbaixoDoSetor("c1", byId)).toBe("CCM-02 › Gaveta G4");
    expect(caminhoAbaixoDoSetor("a1", byId)).toBe("CCM-02");
    expect(caminhoAbaixoDoSetor("s1", byId)).toBe(""); // ponto direto no setor não prefixa
  });
});

describe("filhosDoNo", () => {
  it("raiz (null) lista os setores", () => {
    expect(filhosDoNo(null, [setor, ativo, comp, setor2]).map((n) => n.nome)).toEqual(["Moagem", "Caldeira"]);
  });
  it("setor lista seus ativos", () => {
    expect(filhosDoNo("s1", [setor, ativo, comp, setor2]).map((n) => n.nome)).toEqual(["CCM-02"]);
  });
});

describe("normalizarEstrutura", () => {
  it("deduplica e exige setor; componente exige ativo", () => {
    const r = normalizarEstrutura([
      { setor: "Moagem", ativo: "CCM-02", componente: "G4" },
      { setor: "Moagem", ativo: "CCM-02", componente: "G4" }, // duplicada
      { setor: "  ", ativo: "x", componente: null }, // sem setor → fora
      { setor: "Caldeira", ativo: null, componente: "ignorado" }, // componente sem ativo → vira null
    ]);
    expect(r).toEqual([
      { setor: "Moagem", ativo: "CCM-02", componente: "G4" },
      { setor: "Caldeira", ativo: null, componente: null },
    ]);
  });
});
