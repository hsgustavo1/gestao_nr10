import { describe, expect, test } from "vitest";
import { fotosParaAchado } from "../campo";

type F = { id: string; finding_id: string | null };
const f = (id: string, finding_id: string | null): F => ({ id, finding_id });

describe("fotosParaAchado", () => {
  test("se há fotos vinculadas ao achado, usa só elas", () => {
    const fotos = [f("a", "find-1"), f("b", null), f("c", "find-2")];
    expect(fotosParaAchado(fotos, "find-1").map((x) => x.id)).toEqual(["a"]);
  });

  test("sem foto vinculada ao achado, cai para as fotos soltas do ponto (finding_id null)", () => {
    const fotos = [f("a", "find-2"), f("b", null)];
    expect(fotosParaAchado(fotos, "find-1").map((x) => x.id)).toEqual(["b"]);
  });

  test("nunca anexa foto vinculada a OUTRO achado", () => {
    const fotos = [f("a", "find-2")];
    expect(fotosParaAchado(fotos, "find-1")).toEqual([]);
  });
});
