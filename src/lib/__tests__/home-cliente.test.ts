import { describe, expect, test } from "vitest";
import { cardsPendencias, type NcResumo } from "../home-cliente";
import type { VencimentoItem } from "../vencimentos";

const venc = (over: Partial<VencimentoItem>): VencimentoItem => ({
  id: "v1",
  kind: "aso",
  title: "ASO periodico",
  subject: "Fulano (123)",
  detail: null,
  dueDate: "2026-07-01",
  daysLeft: -8,
  status: "expired",
  link: "/vencimentos",
  ...over,
});

const nc = (over: Partial<NcResumo>): NcResumo => ({
  prioridade: 4,
  status: "pendente",
  prazo: null,
  ...over,
});

describe("cardsPendencias", () => {
  test("agrupa vencidos, vencendo 30d, NCs graves e ações atrasadas", () => {
    const cards = cardsPendencias({
      vencimentos: [
        venc({}),
        venc({ id: "v2", daysLeft: 12, status: "expiring" }),
        venc({ id: "v3", daysLeft: 70, status: "expiring" }), // fora dos 30d
      ],
      ncs: [
        nc({}), // grave pendente
        nc({ prioridade: 1, prazo: "2026-06-01" }), // atrasada
        nc({ prioridade: 4, status: "concluida" }), // concluída não conta
      ],
      hoje: new Date("2026-07-09T12:00:00"),
    });
    const porId = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(porId.vencidos.quantidade).toBe(1);
    expect(porId.vencendo30.quantidade).toBe(1);
    expect(porId.ncs_graves.quantidade).toBe(1);
    expect(porId.acoes_atrasadas.quantidade).toBe(1);
    expect(porId.vencidos.severidade).toBe("critico");
    expect(porId.vencendo30.severidade).toBe("atencao");
  });

  test("tudo zerado vira severidade ok (estado comemorável)", () => {
    const cards = cardsPendencias({ vencimentos: [], ncs: [], hoje: new Date() });
    expect(cards.every((c) => c.quantidade === 0 && c.severidade === "ok")).toBe(true);
  });
});
