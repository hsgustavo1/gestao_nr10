import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ClipboardList, ExternalLink, Wallet, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  formatBRL,
  RTI_PRIORIDADE_COLORS, RTI_PRIORIDADE_LABELS, RTI_TIPO_EXECUCAO_LABELS,
  type RtiNc, type RtiPrioridade, type RtiTipoExecucao,
} from "@/lib/rti";
import { useRtiAreas, useRtiNcs, useRtiReports } from "@/lib/rti-queries";

const custosSearchSchema = z.object({
  report: z.string().optional(),
  setor: z.string().optional().default("all"),
  prioridade: z.string().optional().default("all"),
  tipo: z.string().optional().default("all"),
});

export const Route = createFileRoute("/rti/custos")({
  validateSearch: custosSearchSchema,
  component: RtiCustosPage,
  head: () => ({ meta: [{ title: "Análise de Custos — RTI — Gestão NR-10" }] }),
});

const PLANEJADO_COLOR = "#0A2D48";
const REALIZADO_COLOR = "#F79220";
const TIPO_COLORS: Record<RtiTipoExecucao, string> = { os: "#0A2D48", investimento: "#F79220" };

type Agg = { planejado: number; realizado: number; qtd: number };
const zero = (): Agg => ({ planejado: 0, realizado: 0, qtd: 0 });
function add(a: Agg, nc: RtiNc) {
  a.planejado += Number(nc.custo_planejado) || 0;
  a.realizado += Number(nc.custo_realizado) || 0;
  a.qtd += 1;
}

function RtiCustosPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: reports = [], isLoading: loadingReports } = useRtiReports();

  const activeReport = reports.find((r) => r.id === search.report) ?? reports[0] ?? null;
  const { data: ncs = [], isLoading: loadingNcs } = useRtiNcs(activeReport?.id);
  const { data: areas = [] } = useRtiAreas(activeReport?.id);

  const areaNome = useMemo(() => new Map(areas.map((a) => [a.id, a.nome])), [areas]);

  function setSearch(patch: Partial<typeof search>) {
    navigate({
      to: "/rti/custos",
      search: { ...search, report: activeReport?.id, ...patch },
      replace: true,
    });
  }

  /** Liga/desliga um filtro ao clicar no gráfico (clicar de novo no mesmo limpa). */
  function toggle(dim: "setor" | "prioridade" | "tipo", value: string) {
    setSearch({ [dim]: search[dim] === value ? "all" : value } as Partial<typeof search>);
  }

  // Predicados de filtro por dimensão
  const matchSetor = (nc: RtiNc) =>
    search.setor === "all" || (areaNome.get(nc.area_id) ?? "—") === search.setor;
  const matchPrioridade = (nc: RtiNc) =>
    search.prioridade === "all" || String(nc.prioridade) === search.prioridade;
  const matchTipo = (nc: RtiNc) =>
    search.tipo === "all" || nc.tipo_execucao === search.tipo;

  // Cada gráfico reflete os OUTROS filtros (cross-filtering estilo BI), mantendo
  // sua própria dimensão visível por inteiro para permitir trocar a seleção.
  const charts = useMemo(() => {
    const setorMap = new Map<string, Agg>();
    const prioMap: Record<RtiPrioridade, Agg> = { 1: zero(), 2: zero(), 3: zero(), 4: zero() };
    const tipoMap: Record<RtiTipoExecucao, Agg> = { os: zero(), investimento: zero() };

    for (const nc of ncs) {
      // setor: filtrado por prioridade + tipo
      if (matchPrioridade(nc) && matchTipo(nc)) {
        const nome = areaNome.get(nc.area_id) ?? "—";
        const agg = setorMap.get(nome) ?? zero();
        add(agg, nc);
        setorMap.set(nome, agg);
      }
      // prioridade: filtrado por setor + tipo
      if (matchSetor(nc) && matchTipo(nc)) {
        add(prioMap[(nc.prioridade as RtiPrioridade) ?? 1] ?? (prioMap[1]), nc);
      }
      // tipo: filtrado por setor + prioridade
      if (matchSetor(nc) && matchPrioridade(nc)) {
        add(tipoMap[nc.tipo_execucao], nc);
      }
    }

    const byArea = [...setorMap.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .filter((r) => r.planejado > 0 || r.realizado > 0)
      .sort((a, b) => b.planejado - a.planejado);

    const byPrioridade = ([1, 2, 3, 4] as RtiPrioridade[]).map((p) => ({
      name: `P${p}`, prioridade: p, ...prioMap[p],
    }));

    const byTipo = (["os", "investimento"] as RtiTipoExecucao[]).map((t) => ({
      name: RTI_TIPO_EXECUCAO_LABELS[t], tipo: t, ...tipoMap[t],
    }));

    return { byArea, byPrioridade, byTipo };
  }, [ncs, areaNome, search.setor, search.prioridade, search.tipo]);

  // Cards (resumo) refletem TODOS os filtros ativos simultaneamente.
  const resumo = useMemo(() => {
    const agg = zero();
    let comCusto = 0, semCusto = 0, custoZero = 0;
    for (const nc of ncs) {
      if (matchSetor(nc) && matchPrioridade(nc) && matchTipo(nc)) {
        add(agg, nc);
        // "Informado" baseia-se no custo planejado: null = não informado; 0 = zero explícito.
        const cp = nc.custo_planejado;
        if (cp == null) {
          semCusto += 1;
        } else {
          comCusto += 1;
          if (Number(cp) === 0) custoZero += 1;
        }
      }
    }
    return { ...agg, comCusto, semCusto, custoZero };
  }, [ncs, areaNome, search.setor, search.prioridade, search.tipo]);

  const hasFilters = search.setor !== "all" || search.prioridade !== "all" || search.tipo !== "all";

  const filterChips: { dim: "setor" | "prioridade" | "tipo"; label: string }[] = [];
  if (search.setor !== "all") filterChips.push({ dim: "setor", label: `Setor: ${search.setor}` });
  if (search.prioridade !== "all")
    filterChips.push({ dim: "prioridade", label: RTI_PRIORIDADE_LABELS[Number(search.prioridade) as RtiPrioridade] });
  if (search.tipo !== "all")
    filterChips.push({ dim: "tipo", label: RTI_TIPO_EXECUCAO_LABELS[search.tipo as RtiTipoExecucao] });

  const areaChartHeight = Math.max(220, charts.byArea.length * 34 + 56);
  const isLoading = loadingReports || (activeReport && loadingNcs);

  const planoSearch = {
    report: activeReport?.id,
    ...(search.setor !== "all" ? { area: search.setor } : {}),
    ...(search.prioridade !== "all" ? { prioridade: search.prioridade } : {}),
    ...(search.tipo !== "all" ? { tipo: search.tipo } : {}),
  };

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <Wallet className="h-5 w-5 shrink-0 text-primary" />
            Análise de Custos — RTI
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {activeReport ? activeReport.titulo : "Custos do plano de ação das não conformidades."}
            {" "}Clique nos gráficos para filtrar; os cards reagem ao filtro escolhido.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {reports.length > 1 && (
            <Select
              value={activeReport?.id ?? ""}
              onValueChange={(v) => navigate({ to: "/rti/custos", search: { report: v }, replace: true })}
            >
              <SelectTrigger className="w-52"><SelectValue placeholder="Relatório" /></SelectTrigger>
              <SelectContent>
                {reports.map((r) => <SelectItem key={r.id} value={r.id}>{r.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {activeReport && (
            <Button asChild variant="outline">
              <Link to="/rti/plano" search={planoSearch}>
                <ClipboardList className="h-4 w-4" /> Ver no Plano
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Chips de filtro ativo */}
      {hasFilters && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtros:</span>
          {filterChips.map((c) => (
            <button
              key={c.dim}
              onClick={() => setSearch({ [c.dim]: "all" } as Partial<typeof search>)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/[0.06] px-2.5 py-0.5 text-xs hover:bg-primary/10"
            >
              {c.label} <X className="h-3 w-3" />
            </button>
          ))}
          <Button
            variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground"
            onClick={() => setSearch({ setor: "all", prioridade: "all", tipo: "all" })}
          >
            Limpar tudo
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : !activeReport ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nenhum relatório de inspeção cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cards de resumo (reagem ao filtro) */}
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ResumoCard label="Custo planejado" value={formatBRL(resumo.planejado)} sub={`${resumo.comCusto} NC(s) informada(s)`} />
            <ResumoCard label="Custo realizado" value={formatBRL(resumo.realizado)} />
            <ResumoCard
              label="Execução do orçamento"
              value={resumo.planejado > 0 ? `${Math.round((resumo.realizado / resumo.planejado) * 100)}%` : "—"}
              sub={resumo.planejado > 0
                ? `${formatBRL(Math.max(0, resumo.planejado - resumo.realizado))} restante`
                : "Sem custo planejado"}
            />
            <Card>
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">NCs no recorte</div>
                <div className="mt-1 text-xl font-bold tabular-nums">{resumo.qtd}</div>
                <div className="mt-2 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Com custo informado
                    </span>
                    <span className="font-semibold tabular-nums">{resumo.comCusto}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Sem custo informado
                    </span>
                    <span className="font-semibold tabular-nums">{resumo.semCusto}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2" title="Custo planejado igual a zero — sem barreira financeira para executar">
                    <span className="inline-flex items-center gap-1 text-sky-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Custo zero (executável)
                    </span>
                    <span className="font-semibold tabular-nums">{resumo.custoZero}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {resumo.comCusto === 0 && (
            <Card className="mt-3">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma NC com custo informado neste recorte. Edite cada NC (ou use a ação em massa no Plano) para
                preencher os valores — deixe vazio para "não informado" ou use 0 para indicar que não há custo de execução.
              </CardContent>
            </Card>
          )}

          {/* Custo por setor */}
          {charts.byArea.length > 0 && (
            <Card className="mt-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">
                  Custo por setor{" "}
                  <span className="font-normal text-muted-foreground">(clique para filtrar)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2" style={{ height: areaChartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.byArea} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={kfmt} />
                    <YAxis
                      type="category" dataKey="nome" width={210}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => (v.length > 30 ? v.slice(0, 29) + "…" : v)}
                    />
                    <Tooltip formatter={costTooltipFmt} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="planejado" name="Planejado" radius={[0, 3, 3, 0]} className="cursor-pointer"
                      onClick={(d: { nome?: string }) => d.nome && toggle("setor", d.nome)}
                    >
                      {charts.byArea.map((d) => (
                        <Cell
                          key={d.nome} fill={PLANEJADO_COLOR}
                          fillOpacity={search.setor === "all" || search.setor === d.nome ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="realizado" name="Realizado" radius={[0, 3, 3, 0]} className="cursor-pointer"
                      onClick={(d: { nome?: string }) => d.nome && toggle("setor", d.nome)}
                    >
                      {charts.byArea.map((d) => (
                        <Cell
                          key={d.nome} fill={REALIZADO_COLOR}
                          fillOpacity={search.setor === "all" || search.setor === d.nome ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {/* Custo por prioridade */}
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">
                  Custo por prioridade{" "}
                  <span className="font-normal text-muted-foreground">(clique para filtrar)</span>
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.byPrioridade} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={kfmt} />
                    <Tooltip formatter={costTooltipFmt} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="planejado" name="Planejado" radius={[4, 4, 0, 0]} className="cursor-pointer"
                      onClick={(d: { prioridade?: RtiPrioridade }) => d.prioridade && toggle("prioridade", String(d.prioridade))}
                    >
                      {charts.byPrioridade.map((d) => (
                        <Cell
                          key={d.prioridade} fill={RTI_PRIORIDADE_COLORS[d.prioridade]}
                          fillOpacity={search.prioridade === "all" || search.prioridade === String(d.prioridade) ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="realizado" name="Realizado" radius={[4, 4, 0, 0]} className="cursor-pointer"
                      onClick={(d: { prioridade?: RtiPrioridade }) => d.prioridade && toggle("prioridade", String(d.prioridade))}
                    >
                      {charts.byPrioridade.map((d) => (
                        <Cell
                          key={d.prioridade} fill={RTI_PRIORIDADE_COLORS[d.prioridade]} fillOpacity={
                            search.prioridade === "all" || search.prioridade === String(d.prioridade) ? 0.55 : 0.2
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Custo por OS / Investimento */}
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">
                  Custo por OS / Investimento{" "}
                  <span className="font-normal text-muted-foreground">(clique para filtrar)</span>
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.byTipo} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={kfmt} />
                    <Tooltip formatter={costTooltipFmt} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="planejado" name="Planejado" radius={[4, 4, 0, 0]} className="cursor-pointer"
                      onClick={(d: { tipo?: RtiTipoExecucao }) => d.tipo && toggle("tipo", d.tipo)}
                    >
                      {charts.byTipo.map((d) => (
                        <Cell
                          key={d.tipo} fill={TIPO_COLORS[d.tipo]}
                          fillOpacity={search.tipo === "all" || search.tipo === d.tipo ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="realizado" name="Realizado" radius={[4, 4, 0, 0]} className="cursor-pointer"
                      onClick={(d: { tipo?: RtiTipoExecucao }) => d.tipo && toggle("tipo", d.tipo)}
                    >
                      {charts.byTipo.map((d) => (
                        <Cell
                          key={d.tipo} fill={REALIZADO_COLOR}
                          fillOpacity={search.tipo === "all" || search.tipo === d.tipo ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Atalho para o plano filtrado */}
          {hasFilters && (
            <div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <Link to="/rti/plano" search={planoSearch}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir as {resumo.qtd} NCs deste recorte no Plano de Ação
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}

function kfmt(v: number) {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
  return `R$${v}`;
}

function costTooltipFmt(v: number, name: string) {
  return [formatBRL(v), name] as [string, string];
}

function ResumoCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
