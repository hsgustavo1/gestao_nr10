import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  FileSpreadsheet,
  LayoutList,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { formatDatePtBR } from "@/lib/qualificacoes";
import {
  computeAndamentoPorCusto,
  formatBRL,
  ncPrazoBucket,
  ncPrazoVencido,
  RTI_NC_STATUS_LABELS,
  RTI_PRAZO_BUCKET_COLORS,
  RTI_PRAZO_BUCKET_LABELS,
  RTI_PRIORIDADE_COLORS,
  type RtiNcStatus,
  type RtiPrazoBucket,
  type RtiPrioridade,
} from "@/lib/rti";
import { useRtiAreas, useRtiNcs, useRtiReports } from "@/lib/rti-queries";

export const Route = createFileRoute("/rti/")({
  component: RtiDashboardPage,
  head: () => ({ meta: [{ title: "RTI — Plano de Ação NR-10 — Gestão NR-10" }] }),
});

const STATUS_COLORS: Record<RtiNcStatus, string> = {
  pendente: "#ef4444",
  em_andamento: "#f59e0b",
  concluida: "#10b981",
};

const TIPO_COLORS = { os: "#0A2D48", investimento: "#F79220" } as const;

function RtiDashboardPage() {
  const { isStaff, hasOrgRole } = useAuth();
  // Gate de UI: papel operacional na org ativa (ou staff legado). RLS é a verdade.
  const canEdit = isStaff || hasOrgRole("member");
  const navigate = useNavigate();
  const { data: reports = [], isLoading: loadingReports } = useRtiReports();

  const [reportId, setReportId] = useState<string | null>(null);
  const activeReport = reports.find((r) => r.id === reportId) ?? reports[0] ?? null;

  const { data: ncs = [], isLoading: loadingNcs } = useRtiNcs(activeReport?.id);
  const { data: areas = [] } = useRtiAreas(activeReport?.id);

  const stats = useMemo(() => {
    const total = ncs.length;
    const porStatus: Record<RtiNcStatus, number> = { pendente: 0, em_andamento: 0, concluida: 0 };
    const porPrioridade: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const porTipo = { os: 0, investimento: 0 };
    let vencidas = 0;
    let custoPlanejado = 0;
    let custoRealizado = 0;
    let somaProgresso = 0;
    for (const nc of ncs) {
      porStatus[nc.status] += 1;
      porPrioridade[nc.prioridade] = (porPrioridade[nc.prioridade] ?? 0) + 1;
      porTipo[nc.tipo_execucao] += 1;
      if (ncPrazoVencido(nc)) vencidas += 1;
      custoPlanejado += Number(nc.custo_planejado) || 0;
      custoRealizado += Number(nc.custo_realizado) || 0;
      somaProgresso += nc.progresso;
    }
    const pctConcluidas = total > 0 ? Math.round((porStatus.concluida / total) * 100) : 0;
    const avancoMedio = total > 0 ? Math.round(somaProgresso / total) : 0;
    return {
      total,
      porStatus,
      porPrioridade,
      porTipo,
      vencidas,
      custoPlanejado,
      custoRealizado,
      pctConcluidas,
      avancoMedio,
    };
  }, [ncs]);

  const prazoChart = useMemo(() => {
    const counts: Record<RtiPrazoBucket, number> = {
      vencido: 0,
      sem_prazo: 0,
      semana: 0,
      "30dias": 0,
      "90dias": 0,
      mais90: 0,
    };
    for (const nc of ncs) {
      if (nc.status === "concluida") continue;
      counts[ncPrazoBucket(nc)] += 1;
    }
    const order: RtiPrazoBucket[] = [
      "vencido",
      "semana",
      "30dias",
      "90dias",
      "mais90",
      "sem_prazo",
    ];
    return order.map((b) => ({ bucket: b, label: RTI_PRAZO_BUCKET_LABELS[b], count: counts[b] }));
  }, [ncs]);

  const areasChart = useMemo(() => {
    const areaNome = new Map(areas.map((a) => [a.id, a.nome]));
    const abertas = new Map<string, number>();
    for (const nc of ncs) {
      if (nc.status === "concluida") continue;
      const nome = areaNome.get(nc.area_id) ?? "—";
      abertas.set(nome, (abertas.get(nome) ?? 0) + 1);
    }
    return [...abertas.entries()]
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count);
  }, [ncs, areas]);

  const responsavelChart = useMemo(() => {
    const SEM = "Sem responsável";
    const abertas = new Map<string, number>();
    for (const nc of ncs) {
      if (nc.status === "concluida") continue;
      const nome = nc.responsavel?.trim() || SEM;
      abertas.set(nome, (abertas.get(nome) ?? 0) + 1);
    }
    return [...abertas.entries()]
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [ncs]);

  const andamentoCusto = useMemo(() => computeAndamentoPorCusto(ncs), [ncs]);
  const andamentoCustoData = useMemo(
    () => [
      {
        grupo: "Com custo",
        Total: andamentoCusto.comCusto.total,
        Concluídas: andamentoCusto.comCusto.concluidas,
      },
      {
        grupo: "Custo zero",
        Total: andamentoCusto.custoZero.total,
        Concluídas: andamentoCusto.custoZero.concluidas,
      },
    ],
    [andamentoCusto],
  );

  const gotoPlano = (search: Record<string, string>) => {
    if (!activeReport) return;
    navigate({ to: "/rti/plano", search: { report: activeReport.id, ...search } });
  };

  const gotoCustos = () => {
    if (!activeReport) return;
    navigate({ to: "/rti/custos", search: { report: activeReport.id } });
  };

  const isLoading = loadingReports || (activeReport && loadingNcs);

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <ShieldAlert className="h-5 w-5 shrink-0 text-primary" />
            RTI — Plano de Ação NR-10
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {activeReport ? (
              <>
                {activeReport.titulo}
                {activeReport.periodo_inicio && (
                  <>
                    {" "}
                    · Auditoria de {formatDatePtBR(activeReport.periodo_inicio)}
                    {activeReport.periodo_fim
                      ? ` a ${formatDatePtBR(activeReport.periodo_fim)}`
                      : ""}
                  </>
                )}
              </>
            ) : (
              "Gestão das não conformidades do Relatório Técnico das Inspeções."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {reports.length > 1 && (
            <Select value={activeReport?.id ?? ""} onValueChange={setReportId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Relatório" />
              </SelectTrigger>
              <SelectContent>
                {reports.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {activeReport && (
            <Button asChild className="bg-brand-gradient text-white shadow-brand">
              <Link to="/rti/plano" search={{ report: activeReport.id }}>
                <ClipboardList className="h-4 w-4" /> Plano de Ação
              </Link>
            </Button>
          )}
          {canEdit && (
            <Button asChild variant="outline">
              <Link to="/rti/gestao">
                <LayoutList className="h-4 w-4" /> Gestão RTI
              </Link>
            </Button>
          )}
          {canEdit && (
            <Button asChild variant="outline">
              <Link to="/rti/importar">
                <FileSpreadsheet className="h-4 w-4" /> Importar / Relatórios
              </Link>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : !activeReport ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Nenhum relatório de inspeção cadastrado ainda.
              {canEdit ? " Importe a planilha do plano de ação para começar." : ""}
            </p>
            {canEdit && (
              <Button asChild className="bg-brand-gradient text-white shadow-brand">
                <Link to="/rti/importar">
                  <FileSpreadsheet className="h-4 w-4" /> Importar planilha
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Não conformidades" value={stats.total} onClick={() => gotoPlano({})} />
            <KpiCard
              label="Concluídas"
              value={stats.porStatus.concluida}
              sub={`${stats.pctConcluidas}%`}
              tone="emerald"
              onClick={() => gotoPlano({ status: "concluida" })}
            />
            <KpiCard
              label="Em andamento"
              value={stats.porStatus.em_andamento}
              tone={stats.porStatus.em_andamento > 0 ? "amber" : "default"}
              onClick={() => gotoPlano({ status: "em_andamento" })}
            />
            <KpiCard
              label="Pendentes"
              value={stats.porStatus.pendente}
              tone={stats.porStatus.pendente > 0 ? "red" : "default"}
              onClick={() => gotoPlano({ status: "pendente" })}
            />
            <KpiCard
              label="Prazo vencido"
              value={stats.vencidas}
              tone={stats.vencidas > 0 ? "red" : "default"}
              icon={
                stats.vencidas > 0 ? <AlertTriangle className="h-4 w-4 text-red-500" /> : undefined
              }
              onClick={() => gotoPlano({ prazo: "vencido" })}
            />
          </div>

          {/* Avanço + custos */}
          <div className="mt-3 grid sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-baseline justify-between">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Avanço geral do plano
                  </div>
                  <div className="text-lg font-bold tabular-nums">{stats.avancoMedio}%</div>
                </div>
                <Progress value={stats.avancoMedio} className="mt-2 h-2.5" />
                <div className="mt-1.5 text-[11px] text-muted-foreground">
                  Média do % de conclusão das {stats.total} NCs · {stats.pctConcluidas}% totalmente
                  concluídas
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30"
              onClick={gotoCustos}
            >
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5" /> Custo planejado
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums">
                  {formatBRL(stats.custoPlanejado)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {stats.porTipo.investimento} NCs via investimento · {stats.porTipo.os} via OS
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30"
              onClick={gotoCustos}
            >
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5" /> Custo realizado
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums">
                  {formatBRL(stats.custoRealizado)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {stats.custoPlanejado > 0
                    ? `${Math.round((stats.custoRealizado / stats.custoPlanejado) * 100)}% do planejado`
                    : "Defina os custos planejados nas NCs"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="mt-3 grid lg:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">Situação das NCs</CardTitle>
              </CardHeader>
              <CardContent className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(Object.keys(stats.porStatus) as RtiNcStatus[]).map((s) => ({
                        name: RTI_NC_STATUS_LABELS[s],
                        value: stats.porStatus[s],
                        status: s,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      onClick={(d: { status?: RtiNcStatus }) =>
                        d.status && gotoPlano({ status: d.status })
                      }
                      className="cursor-pointer"
                    >
                      {(Object.keys(stats.porStatus) as RtiNcStatus[]).map((s) => (
                        <Cell key={s} fill={STATUS_COLORS[s]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} NCs`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-3 -mt-2 flex-wrap">
                  {(Object.keys(stats.porStatus) as RtiNcStatus[]).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: STATUS_COLORS[s] }}
                      />
                      {RTI_NC_STATUS_LABELS[s]} ({stats.porStatus[s]})
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">
                  Por prioridade{" "}
                  <span className="font-normal text-muted-foreground">(P4 = mais grave)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={([1, 2, 3, 4] as RtiPrioridade[]).map((p) => ({
                      name: `P${p}`,
                      count: stats.porPrioridade[p] ?? 0,
                      prioridade: p,
                    }))}
                    margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [`${v} NCs`, ""]} />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      className="cursor-pointer"
                      onClick={(d: { prioridade?: RtiPrioridade }) =>
                        d.prioridade && gotoPlano({ prioridade: String(d.prioridade) })
                      }
                    >
                      {([1, 2, 3, 4] as RtiPrioridade[]).map((p) => (
                        <Cell key={p} fill={RTI_PRIORIDADE_COLORS[p]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">Tipo de execução</CardTitle>
              </CardHeader>
              <CardContent className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "OS (manutenção)", value: stats.porTipo.os, tipo: "os" },
                        {
                          name: "Investimento",
                          value: stats.porTipo.investimento,
                          tipo: "investimento",
                        },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      onClick={(d: { tipo?: string }) => d.tipo && gotoPlano({ tipo: d.tipo })}
                      className="cursor-pointer"
                    >
                      <Cell fill={TIPO_COLORS.os} />
                      <Cell fill={TIPO_COLORS.investimento} />
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} NCs`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-3 -mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: TIPO_COLORS.os }} />
                    OS ({stats.porTipo.os})
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: TIPO_COLORS.investimento }}
                    />
                    Investimento ({stats.porTipo.investimento})
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Andamento por custo */}
          {(andamentoCusto.comCusto.total > 0 || andamentoCusto.custoZero.total > 0) && (
            <Card className="mt-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">
                  Andamento por custo{" "}
                  <span className="font-normal text-muted-foreground">
                    (conclusão das ações com investimento vs sem investimento)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={andamentoCustoData}
                      margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="grupo" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip formatter={(v: number) => [`${v} NCs`, ""]} />
                      <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Total" fill="#0A2D48" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Concluídas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    Com custo:{" "}
                    <strong className="text-foreground">
                      {andamentoCusto.comCusto.concluidas}/{andamentoCusto.comCusto.total}
                    </strong>{" "}
                    concluídas ({pctConcl(andamentoCusto.comCusto)}%)
                  </span>
                  <span>
                    Custo zero:{" "}
                    <strong className="text-foreground">
                      {andamentoCusto.custoZero.concluidas}/{andamentoCusto.custoZero.total}
                    </strong>{" "}
                    concluídas ({pctConcl(andamentoCusto.custoZero)}%)
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ações por prazo de vencimento */}
          <Card className="mt-3">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">
                Ações por prazo de vencimento{" "}
                <span className="font-normal text-muted-foreground">
                  (NCs em aberto · clique para filtrar)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={prazoChart}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={185} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v} NCs em aberto`, ""]} />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    className="cursor-pointer"
                    onClick={(d: { bucket?: RtiPrazoBucket }) =>
                      d.bucket && gotoPlano({ prazo: d.bucket })
                    }
                  >
                    {prazoChart.map((d) => (
                      <Cell key={d.bucket} fill={RTI_PRAZO_BUCKET_COLORS[d.bucket]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Áreas com mais NCs abertas */}
          {areasChart.length > 0 && (
            <Card className="mt-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">
                  Áreas com mais NCs abertas{" "}
                  <span className="font-normal text-muted-foreground">(clique para filtrar)</span>
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: Math.max(220, areasChart.length * 32 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={areasChart}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="nome"
                      width={230}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => (v.length > 34 ? v.slice(0, 33) + "…" : v)}
                    />
                    <Tooltip formatter={(v: number) => [`${v} NCs abertas`, ""]} />
                    <Bar
                      dataKey="count"
                      fill="#E35D12"
                      radius={[0, 4, 4, 0]}
                      className="cursor-pointer"
                      onClick={(d: { nome?: string }) => d.nome && gotoPlano({ area: d.nome })}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* NCs abertas por responsável */}
          {responsavelChart.length > 0 && (
            <Card className="mt-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">
                  NCs abertas por responsável{" "}
                  <span className="font-normal text-muted-foreground">(clique para filtrar)</span>
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: Math.max(220, responsavelChart.length * 32 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={responsavelChart}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="nome"
                      width={230}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => (v.length > 34 ? v.slice(0, 33) + "…" : v)}
                    />
                    <Tooltip formatter={(v: number) => [`${v} NCs abertas`, ""]} />
                    <Bar
                      dataKey="count"
                      fill="#0A2D48"
                      radius={[0, 4, 4, 0]}
                      className="cursor-pointer"
                      onClick={(d: { nome?: string }) => {
                        if (!d.nome) return;
                        // "Sem responsável" não tem texto buscável; os demais filtram por busca textual
                        if (d.nome !== "Sem responsável") gotoPlano({ q: d.nome });
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}

function pctConcl(g: { total: number; concluidas: number }): number {
  return g.total > 0 ? Math.round((g.concluidas / g.total) * 100) : 0;
}

function KpiCard({
  label,
  value,
  sub,
  tone = "default",
  icon,
  onClick,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "default" | "amber" | "red" | "emerald";
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  const valueCls =
    tone === "red"
      ? "text-red-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "emerald"
          ? "text-emerald-600"
          : "";
  return (
    <Card
      className={
        onClick ? "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30" : ""
      }
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={`text-2xl font-bold tabular-nums ${valueCls}`}>
            {value}
            {sub && (
              <span className="ml-1.5 text-sm font-semibold text-muted-foreground">{sub}</span>
            )}
          </div>
          {icon}
        </div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
