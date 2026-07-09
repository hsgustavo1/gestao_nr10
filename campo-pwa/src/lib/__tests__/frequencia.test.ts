import { describe, expect, it } from "vitest";
import { contarUsoModos, maisUsados } from "@/lib/frequencia";
import type { RtiModoFalha } from "@/lib/types";

const modo = (id: string, label: string): RtiModoFalha => ({
  id,
  codigo: id,
  label,
  categoria: "Geral",
  descricao_padrao: "d",
  recomendacao_padrao: null,
  prioridade_sugerida: 3,
  tipo_execucao_sugerido: "os",
  normas: [],
  ativo: true,
  ordem: 0,
  created_at: "",
  updated_at: "",
});

const findings = [
  { modo_falha_id: "a" },
  { modo_falha_id: "a" },
  { modo_falha_id: "b" },
  { modo_falha_id: null },
];

describe("frequencia", () => {
  it("conta uso por modo, ignorando null", () => {
    const uso = contarUsoModos(findings);
    expect(uso.get("a")).toBe(2);
    expect(uso.get("b")).toBe(1);
    expect(uso.size).toBe(2);
  });
  it("maisUsados retorna os top-N na ordem de uso, só modos existentes", () => {
    const modos = [modo("a", "A"), modo("b", "B"), modo("c", "C")];
    const top = maisUsados(modos, contarUsoModos(findings), 2);
    expect(top.map((m) => m.id)).toEqual(["a", "b"]);
  });
  it("sem uso registrado, retorna vazio (não inventa destaque)", () => {
    expect(maisUsados([modo("a", "A")], new Map(), 4)).toEqual([]);
  });
});
