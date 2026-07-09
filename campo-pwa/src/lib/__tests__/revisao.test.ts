import { describe, expect, it } from "vitest";
import { computePendencias, type RevisaoInput } from "@/lib/revisao";

const base: RevisaoInput = {
  nodes: [
    { id: "s1", parent_id: null, nivel: "setor", nome: "Subestação" },
    { id: "s2", parent_id: null, nivel: "setor", nome: "Caldeiraria" },
    { id: "a1", parent_id: "s1", nivel: "ativo", nome: "QGBT" },
  ],
  points: [{ id: "p1", node_id: "a1", titulo: "Painel 01" }],
  findings: [{ id: "f1", point_id: "p1", modo_falha_id: "m1", descricao: "x" }],
  photos: [{ id: "ph1", point_id: "p1", finding_id: "f1", blob: true, _synced: false }],
  queue: { pending: 0, failed: 0 },
};

describe("computePendencias", () => {
  it("aponta setor sem nenhum ponto", () => {
    const p = computePendencias(base);
    expect(p).toContainEqual({ tipo: "setor_sem_ponto", nodeId: "s2", nome: "Caldeiraria" });
  });
  it("aponta ponto sem foto", () => {
    const p = computePendencias({ ...base, photos: [] });
    expect(p).toContainEqual({ tipo: "ponto_sem_foto", pointId: "p1", titulo: "Painel 01" });
  });
  it("aponta foto sem NC vinculada quando o ponto tem 2+ NCs", () => {
    const input: RevisaoInput = {
      ...base,
      findings: [
        { id: "f1", point_id: "p1", modo_falha_id: "m1", descricao: "x" },
        { id: "f2", point_id: "p1", modo_falha_id: null, descricao: "y" },
      ],
      photos: [{ id: "ph1", point_id: "p1", finding_id: null, blob: true, _synced: false }],
    };
    const p = computePendencias(input);
    expect(p).toContainEqual({
      tipo: "foto_sem_vinculo",
      pointId: "p1",
      titulo: "Painel 01",
      count: 1,
    });
  });
  it("NÃO cobra vínculo quando o ponto tem 1 NC só (implícito)", () => {
    const p = computePendencias({
      ...base,
      photos: [{ id: "ph1", point_id: "p1", finding_id: null, blob: true, _synced: false }],
    });
    expect(p.some((x) => x.tipo === "foto_sem_vinculo")).toBe(false);
  });
  it("resume estado da fila e blobs locais", () => {
    const p = computePendencias({ ...base, queue: { pending: 3, failed: 1 } });
    expect(p).toContainEqual({ tipo: "sync_pendente", count: 3 });
    expect(p).toContainEqual({ tipo: "sync_falha", count: 1 });
    expect(p).toContainEqual({ tipo: "so_no_aparelho", fotos: 1 });
  });
  it("inspeção redonda → sem pendências", () => {
    const ok = computePendencias({
      ...base,
      nodes: base.nodes.filter((n) => n.id !== "s2"),
      photos: [{ id: "ph1", point_id: "p1", finding_id: "f1", blob: false, _synced: true }],
    });
    expect(ok).toEqual([]);
  });
});
