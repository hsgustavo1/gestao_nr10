import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, AlertTriangle, CheckCircle2, ListChecks } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { getRtiCampoAccess } from "@/lib/tenancy-gates";
import { formatBRL } from "@/lib/rti";
import { useRtiReports, useRtiSnapshots } from "@/lib/rti-queries";
import { aggregateSnapshotsByMonth } from "@/lib/rti-snapshots";

export const Route = createFileRoute("/rti/evolucao")({
  component: RtiEvolucaoPage,
  head: () => ({ meta: [{ title: "Evolução mensal — RTI — Gestão NR-10" }] }),
});

const STATUS_COLORS = {
  pendente: "#ef4444",
  em_andamento: "#f59e0b",
  concluida: "#10b981",
} as const;

const PLANEJADO_COLOR = "#0C3326";
const REALIZADO_COLOR = "#34D399";
const EM_ABERTO_COLOR = "#64748b";

function kfmt(v: number) {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
  return `R$${v}`;
}

function RtiEvolucaoPage() {
  const auth = useAuth();
  const { canView } = getRtiCampoAccess(auth);
  const { data: reports = [], isLoading: loadingReports } = useRtiReports();
  const { data: snapshots = [], isLoading: loadingSnaps } = useRtiSnapshots();
  const [filtro, setFiltro] = useState<"all" | string>("all");

  const trend = useMemo(() => aggregateSnapshotsByMonth(snapshots, filtro), [snapshots, filtro]);
  const ultimo = trend.at(-1) ?? null;

  // Só relatórios que têm snapshot visível entram no filtro (evita opção morta).
  const reportsComHistorico = useMemo(() => {
    const ids = new Set(snapshots.map((s) => s.report_id));
    return reports.filter((r) => ids.has(r.id));
  }, [reports, snapshots]);

  const isLoading = loadingReports || loadingSnaps;

  if (!canView) {
    return (
      <PageShell>
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Você não tem acesso ao módulo RTI.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <TrendingUp className="h-5 w-5 shrink-0 text-primary" />
            Evolução mensal — RTI
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Como o plano de ação evoluiu mês a mês — ações por status e custo. Um retrato é
            capturado no fechamento de cada mês.
          </p>
        </div>
        {reportsComHistorico.length > 1 && (
          <Select value={filtro} onValueChange={(v) => setFiltro(v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Relatório" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os relatórios</SelectItem>
              {reportsComHistorico.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : trend.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Ainda não há histórico de RTI para exibir. O primeiro ponto é capturado automaticamente
            no fechamento do mês — ou assim que houver relatório com NCs.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs do último mês capturado */}
          {ultimo && (
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi
                label={`NCs (${ultimo.mesLabel})`}
                value={String(ultimo.ncs_total)}
                icon={<ListChecks className="h-5 w-5" />}
              />
              <Kpi
                label="Concluídas"
                value={`${ultimo.pct_concluida}%`}
                sub={`${ultimo.concluida} de ${ultimo.ncs_total}`}
                icon={<CheckCircle2 className="h-5 w-5" />}
              />
              <Kpi
                label="Vencidas"
                value={String(ultimo.vencidas)}
                sub="prazo estourado e em aberto"
                icon={<AlertTriangle className="h-5 w-5" />}
              />
              <Kpi
                label="Realizado"
                value={formatBRL(ultimo.realizado)}
                sub={`de ${formatBRL(ultimo.planejado_total)} planejado`}
              />
            </div>
          )}

          {trend.length < 2 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Há apenas um mês capturado até agora — a curva ganha forma a cada novo fechamento
              mensal.
            </p>
          )}

          {/* Ações por status ao longo dos meses */}
          <Card className="mt-3">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">Ações por status (mês a mês)</CardTitle>
            </CardHeader>
            <CardContent style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="pendente"
                    name="Pendente"
                    stackId="s"
                    stroke={STATUS_COLORS.pendente}
                    fill={STATUS_COLORS.pendente}
                    fillOpacity={0.7}
                  />
                  <Area
                    type="monotone"
                    dataKey="em_andamento"
                    name="Em andamento"
                    stackId="s"
                    stroke={STATUS_COLORS.em_andamento}
                    fill={STATUS_COLORS.em_andamento}
                    fillOpacity={0.7}
                  />
                  <Area
                    type="monotone"
                    dataKey="concluida"
                    name="Concluída"
                    stackId="s"
                    stroke={STATUS_COLORS.concluida}
                    fill={STATUS_COLORS.concluida}
                    fillOpacity={0.7}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {/* Progresso (% concluídas) */}
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">Progresso (% concluídas)</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 12 }} />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, "Concluídas"] as [string, string]}
                    />
                    <Line
                      type="monotone"
                      dataKey="pct_concluida"
                      name="% concluídas"
                      stroke={STATUS_COLORS.concluida}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Custo: planejado × realizado × em aberto */}
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">Custo ao longo dos meses</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={kfmt} />
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        [formatBRL(v), name] as [string, string]
                      }
                    />
                    <Legend iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="planejado_total"
                      name="Planejado"
                      stroke={PLANEJADO_COLOR}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="realizado"
                      name="Realizado"
                      stroke={REALIZADO_COLOR}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="em_aberto"
                      name="Em aberto"
                      stroke={EM_ABERTO_COLOR}
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageShell>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          {icon && (
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-foreground">
              {icon}
            </div>
          )}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
