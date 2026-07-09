import { describe, expect, test } from "vitest";
import {
  arvoreFromNodes,
  contarNos,
  linhasFromArvore,
  removerNo,
  renomearNo,
  validarArvore,
  type ArvoreNo,
} from "../estrutura-modelos";

const nodes = [
  { id: "s1", parent_id: null, nivel: "setor" as const, nome: "Extração", ordem: 1 },
  { id: "s2", parent_id: null, nivel: "setor" as const, nome: "Caldeira", ordem: 2 },
  { id: "a1", parent_id: "s1", nivel: "ativo" as const, nome: "CCM-02", ordem: 1 },
  { id: "c1", parent_id: "a1", nivel: "componente" as const, nome: "Gaveta G4", ordem: 1 },
];

describe("arvoreFromNodes", () => {
  test("monta a árvore aninhada na ordem dos nós", () => {
    const arvore = arvoreFromNodes(nodes);
    expect(arvore).toEqual([
      {
        nome: "Extração",
        filhos: [{ nome: "CCM-02", filhos: [{ nome: "Gaveta G4", filhos: [] }] }],
      },
      { nome: "Caldeira", filhos: [] },
    ]);
  });

  test("órfão (parent inexistente) é ignorado sem quebrar", () => {
    const arvore = arvoreFromNodes([
      ...nodes,
      { id: "x", parent_id: "nao-existe", nivel: "ativo" as const, nome: "Fantasma", ordem: 9 },
    ]);
    expect(contarNos(arvore)).toBe(4);
  });
});

describe("linhasFromArvore (roundtrip com bulkCreateNodes)", () => {
  test("achata a árvore em linhas Setor/Ativo/Componente", () => {
    const arvore = arvoreFromNodes(nodes);
    expect(linhasFromArvore(arvore)).toEqual([
      { setor: "Extração", ativo: "CCM-02", componente: "Gaveta G4" },
      { setor: "Caldeira", ativo: null, componente: null },
    ]);
  });

  test("ativo sem componente vira linha própria", () => {
    const arvore: ArvoreNo[] = [{ nome: "SE 01", filhos: [{ nome: "QGBT", filhos: [] }] }];
    expect(linhasFromArvore(arvore)).toEqual([{ setor: "SE 01", ativo: "QGBT", componente: null }]);
  });
});

describe("validarArvore", () => {
  test("aceita árvore válida", () => {
    expect(validarArvore(arvoreFromNodes(nodes))).toEqual([]);
  });
  test("acusa nome vazio e profundidade > 3", () => {
    const ruim: ArvoreNo[] = [
      { nome: "  ", filhos: [] },
      {
        nome: "S",
        filhos: [{ nome: "A", filhos: [{ nome: "C", filhos: [{ nome: "D", filhos: [] }] }] }],
      },
    ];
    const erros = validarArvore(ruim);
    expect(erros.length).toBe(2);
  });
});

describe("edição imutável (editor de generalização)", () => {
  test("removerNo tira o nó e a subárvore", () => {
    const arvore = arvoreFromNodes(nodes);
    const sem = removerNo(arvore, [0, 0]); // CCM-02 (e Gaveta G4 junto)
    expect(contarNos(sem)).toBe(2);
  });
  test("renomearNo troca só o alvo", () => {
    const arvore = arvoreFromNodes(nodes);
    const ren = renomearNo(arvore, [0, 0, 0], "Gaveta genérica");
    expect(ren[0].filhos[0].filhos[0].nome).toBe("Gaveta genérica");
    expect(arvore[0].filhos[0].filhos[0].nome).toBe("Gaveta G4"); // original intacto
  });
});
