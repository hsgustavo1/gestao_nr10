import { describe, it, expect } from "vitest";
import {
  aggregateSnapshotsByMonth,
  monthLabel,
  reportIdsInSnapshots,
  type RtiSnapshotPayload,
  type RtiSnapshotRow,
} from "../rti-snapshots";

function payload(o: {
  total?: number;
  pend?: number;
  and?: number;
  conc?: number;
  p1?: number;
  p2?: number;
  p3?: number;
  p4?: number;
  venc?: number;
  plan?: number;
  real?: number;
  aberto?: number;
  saldo?: number;
}): RtiSnapshotPayload {
  return {
    ncs_total: o.total ?? 0,
    por_status: { pendente: o.pend ?? 0, em_andamento: o.and ?? 0, concluida: o.conc ?? 0 },
    por_prioridade: { "1": o.p1 ?? 0, "2": o.p2 ?? 0, "3": o.p3 ?? 0, "4": o.p4 ?? 0 },
    vencidas: o.venc ?? 0,
    custo: {
      planejado_total: o.plan ?? 0,
      realizado: o.real ?? 0,
      em_aberto: o.aberto ?? 0,
      saldo_liquido: o.saldo ?? 0,
    },
  };
}

function row(report_id: string, snapshot_date: string, p: RtiSnapshotPayload): RtiSnapshotRow {
  return {
    id: `${report_id}:${snapshot_date}`,
    org_id: "org1",
    report_id,
    snapshot_date,
    payload: p,
  };
}

describe("monthLabel", () => {
  it("formata ISO em mês/ano curto pt-BR", () => {
    expect(monthLabel("2026-06-01")).toBe("jun/26");
    expect(monthLabel("2026-01-01")).toBe("jan/26");
    expect(monthLabel("2025-12-01")).toBe("dez/25");
  });
});

describe("aggregateSnapshotsByMonth", () => {
  it("retorna vazio quando não há snapshots", () => {
    expect(aggregateSnapshotsByMonth([], "all")).toEqual([]);
  });

  it("ordena por mês ascendente e calcula % concluída", () => {
    const rows = [
      row("r1", "2026-05-01", payload({ total: 4, conc: 1 })),
      row("r1", "2026-06-01", payload({ total: 4, conc: 3 })),
    ];
    const out = aggregateSnapshotsByMonth(rows, "all");
    expect(out.map((p) => p.mes)).toEqual(["2026-05-01", "2026-06-01"]);
    expect(out[0].pct_concluida).toBe(25);
    expect(out[1].pct_concluida).toBe(75);
    expect(out[1].mesLabel).toBe("jun/26");
  });

  it("soma os relatórios do mesmo mês quando filtro = all", () => {
    const rows = [
      row("r1", "2026-06-01", payload({ total: 10, conc: 2, plan: 1000, real: 400, aberto: 300 })),
      row("r2", "2026-06-01", payload({ total: 5, conc: 3, plan: 500, real: 100, aberto: 200 })),
    ];
    const [jun] = aggregateSnapshotsByMonth(rows, "all");
    expect(jun.ncs_total).toBe(15);
    expect(jun.concluida).toBe(5);
    expect(jun.planejado_total).toBe(1500);
    expect(jun.realizado).toBe(500);
    expect(jun.em_aberto).toBe(500);
    // 5 de 15 concluídas → 33%
    expect(jun.pct_concluida).toBe(33);
  });

  it("filtra por um relatório específico", () => {
    const rows = [
      row("r1", "2026-06-01", payload({ total: 10, conc: 2 })),
      row("r2", "2026-06-01", payload({ total: 5, conc: 3 })),
    ];
    const [jun] = aggregateSnapshotsByMonth(rows, "r2");
    expect(jun.ncs_total).toBe(5);
    expect(jun.concluida).toBe(3);
  });

  it("propaga prioridades, vencidas e saldo somando entre relatórios", () => {
    const rows = [
      row("r1", "2026-06-01", payload({ p4: 3, venc: 1, saldo: -200 })),
      row("r2", "2026-06-01", payload({ p4: 2, venc: 4, saldo: 500 })),
    ];
    const [jun] = aggregateSnapshotsByMonth(rows, "all");
    expect(jun.p4).toBe(5);
    expect(jun.vencidas).toBe(5);
    expect(jun.saldo_liquido).toBe(300);
  });
});

describe("reportIdsInSnapshots", () => {
  it("lista relatórios distintos", () => {
    const rows = [
      row("r1", "2026-05-01", payload({})),
      row("r1", "2026-06-01", payload({})),
      row("r2", "2026-06-01", payload({})),
    ];
    expect(reportIdsInSnapshots(rows).sort()).toEqual(["r1", "r2"]);
  });
});
