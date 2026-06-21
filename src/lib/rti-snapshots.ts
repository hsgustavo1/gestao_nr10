// ── RTI — Evolução mensal: tipos + agregação pura ───────────────────────────
// Um snapshot = o estado de UM relatório RTI num mês (1º dia). Capturado no
// banco por fn_capture_rti_snapshots (pg_cron, 1º do mês). Esta camada agrega os
// snapshots por mês para os gráficos: "Todos" soma os relatórios visíveis;
// um relatório específico filtra. O payload espelha a função do banco.

import type { RtiNcStatus } from "./rti";

export type RtiSnapshotPayload = {
  ncs_total: number;
  por_status: Record<RtiNcStatus, number>;
  por_prioridade: Record<"1" | "2" | "3" | "4", number>;
  vencidas: number;
  custo: {
    planejado_total: number;
    realizado: number;
    em_aberto: number;
    saldo_liquido: number;
  };
};

export type RtiSnapshotRow = {
  id: string;
  org_id: string;
  report_id: string;
  snapshot_date: string; // 1º do mês (ISO date "YYYY-MM-01")
  payload: RtiSnapshotPayload;
};

/** Ponto mensal achatado, pronto para os gráficos (recharts). */
export type RtiTrendPoint = {
  mes: string; // snapshot_date ISO — chave do eixo X
  mesLabel: string; // "jun/26"
  ncs_total: number;
  pendente: number;
  em_andamento: number;
  concluida: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  vencidas: number;
  planejado_total: number;
  realizado: number;
  em_aberto: number;
  saldo_liquido: number;
  /** % de NCs concluídas no mês (0..100, arredondado). */
  pct_concluida: number;
};

const MESES_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "2026-06-01" → "jun/26". Robusto a strings sem parsing de fuso. */
export function monthLabel(isoDate: string): string {
  const [y, m] = isoDate.split("-");
  const mi = Number(m) - 1;
  const mes = MESES_PT[mi] ?? m;
  return `${mes}/${(y ?? "").slice(2)}`;
}

type Acc = Omit<RtiTrendPoint, "mesLabel" | "pct_concluida">;

function emptyAcc(mes: string): Acc {
  return {
    mes,
    ncs_total: 0,
    pendente: 0,
    em_andamento: 0,
    concluida: 0,
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0,
    vencidas: 0,
    planejado_total: 0,
    realizado: 0,
    em_aberto: 0,
    saldo_liquido: 0,
  };
}

function addPayload(acc: Acc, p: RtiSnapshotPayload): void {
  acc.ncs_total += p.ncs_total ?? 0;
  acc.pendente += p.por_status?.pendente ?? 0;
  acc.em_andamento += p.por_status?.em_andamento ?? 0;
  acc.concluida += p.por_status?.concluida ?? 0;
  acc.p1 += p.por_prioridade?.["1"] ?? 0;
  acc.p2 += p.por_prioridade?.["2"] ?? 0;
  acc.p3 += p.por_prioridade?.["3"] ?? 0;
  acc.p4 += p.por_prioridade?.["4"] ?? 0;
  acc.vencidas += p.vencidas ?? 0;
  acc.planejado_total += p.custo?.planejado_total ?? 0;
  acc.realizado += p.custo?.realizado ?? 0;
  acc.em_aberto += p.custo?.em_aberto ?? 0;
  acc.saldo_liquido += p.custo?.saldo_liquido ?? 0;
}

/**
 * Agrega snapshots por mês. `filtro = "all"` soma todos os relatórios do mês;
 * caso contrário, considera só o relatório com `report_id === filtro`.
 * Retorna pontos ordenados por mês (ascendente), prontos para os gráficos.
 */
export function aggregateSnapshotsByMonth(
  rows: readonly RtiSnapshotRow[],
  filtro: "all" | string,
): RtiTrendPoint[] {
  const byMonth = new Map<string, Acc>();
  for (const r of rows) {
    if (filtro !== "all" && r.report_id !== filtro) continue;
    const acc = byMonth.get(r.snapshot_date) ?? emptyAcc(r.snapshot_date);
    addPayload(acc, r.payload);
    byMonth.set(r.snapshot_date, acc);
  }
  return [...byMonth.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((acc) => ({
      ...acc,
      mesLabel: monthLabel(acc.mes),
      pct_concluida: acc.ncs_total > 0 ? Math.round((acc.concluida / acc.ncs_total) * 100) : 0,
    }));
}

/** Lista de relatórios distintos presentes nos snapshots (para o filtro). */
export function reportIdsInSnapshots(rows: readonly RtiSnapshotRow[]): string[] {
  return [...new Set(rows.map((r) => r.report_id))];
}
