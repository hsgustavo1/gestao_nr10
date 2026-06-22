import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FileBarChart, FolderCheck, Printer, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useComplianceReport } from "@/lib/conformidade";
import { useComplianceSnapshots, useEnsureMonthlySnapshot } from "@/lib/snapshots";
import { useIncidents } from "@/lib/incidentes-queries";

export const Route = createFileRoute("/relatorio/")({
  component: RelatorioPage,
  head: () => ({
    meta: [
      { title: "Relatório de Conformidade — Gestão NR-10" },
      {
        name: "description",
        content:
          "Índice de conformidade NR-10: capacitações, autorizações, ASOs, prontuário, inspeções e EPIs.",
      },
    ],
  }),
});

const TREND_SERIES = [
  { key: "overall", label: "Índice global", color: "#0C3326", width: 2.5 },
  { key: "capacitacao_basico", label: "NR-10 Básico", color: "#3b82f6", width: 1.5 },
  { key: "autorizacoes", label: "Autorizações", color: "#059669", width: 1.5 },
  { key: "asos", label: "ASOs", color: "#8b5cf6", width: 1.5 },
  { key: "prontuario", label: "Prontuário", color: "#10b981", width: 1.5 },
  { key: "epis", label: "EPIs", color: "#f59e0b", width: 1.5 },
] as const;

function RelatorioPage() {
  const { isStaff } = useAuth();
  const { report, isLoading } = useComplianceReport();
  const { data: snapshots = [] } = useComplianceSnapshots();
  const { data: incidents = [] } = useIncidents();

  // Captura automática do snapshot mensal quando staff abre o relatório
  useEnsureMonthlySnapshot(report, isStaff);

  const trendData = useMemo(
    () =>
      snapshots.map((s) => ({
        mes: s.snapshot_date.slice(0, 7).split("-").reverse().join("/"),
        ...s.payload,
      })),
    [snapshots],
  );

  const incidentesAbertos = useMemo(
    () => incidents.filter((i) => i.status !== "concluido").length,
    [incidents],
  );

  const overallColor = (v: number) =>
    v >= 90 ? "text-emerald-600" : v >= 70 ? "text-amber-600" : "text-red-600";

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <FileBarChart className="h-5 w-5 shrink-0 text-primary" />
            Relatório de Conformidade NR-10
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Visão executiva pronta para auditoria e fiscalização.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline">
            <Link to="/relatorio/dossie">
              <FolderCheck className="h-4 w-4" /> Dossiê de fiscalização
            </Link>
          </Button>
          <Button
            onClick={() => window.print()}
            className="bg-brand-gradient text-white shadow-brand"
          >
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Cabeçalho de impressão */}
      <div className="hidden print:block text-center border-b pb-3 mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Gestão NR-10</p>
        <h1 className="text-xl font-bold">RELATÓRIO DE CONFORMIDADE NR-10</h1>
        <p className="text-xs text-muted-foreground">
          Emitido em {new Date().toLocaleDateString("pt-BR")} às{" "}
          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {isLoading || !report ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* Índice global */}
          <Card className="mt-5 print:mt-0">
            <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Índice global de conformidade
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Média dos módulos: capacitações, autorizações, ASOs, prontuário, inspeções e EPIs.
                </div>
              </div>
              <div className={`text-5xl font-bold tabular-nums ${overallColor(report.overall)}`}>
                {report.overall}%
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Pessoas */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Pessoas — {report.employees} colaboradores ativos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.trainingRows.map((r) => (
                  <div key={r.type}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{r.label}</span>
                      <span className="font-semibold tabular-nums">
                        {r.valid}/{r.universe} · {r.percent}%
                      </span>
                    </div>
                    <Progress value={r.percent} className="h-1.5" />
                  </div>
                ))}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Autorizações válidas</span>
                    <span className="font-semibold tabular-nums">
                      {report.validAuth}/{report.employees} · {report.authPercent}%
                    </span>
                  </div>
                  <Progress value={report.authPercent} className="h-1.5" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>ASOs em dia (NR-10 10.8.7)</span>
                    <span className="font-semibold tabular-nums">
                      {report.asoOk}/{report.employees} · {report.asoPercent}%
                    </span>
                  </div>
                  <Progress value={report.asoPercent} className="h-1.5" />
                </div>
              </CardContent>
            </Card>

            {/* Prontuário */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Prontuário das Instalações Elétricas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Completude (itens 10.2.3/10.2.4)</span>
                    <span className="font-semibold tabular-nums">{report.prontuario.percent}%</span>
                  </div>
                  <Progress value={report.prontuario.percent} className="h-1.5" />
                </div>
                {report.prontuario.missing.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Pendentes: {report.prontuario.missing.length}{" "}
                    {report.prontuario.missing.length === 1 ? "categoria" : "categorias"} sem
                    documento válido.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inspeções */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Inspeções e Laudos
                  {report.inspPercent !== null && (
                    <span className="ml-2 tabular-nums">{report.inspPercent}%</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.inspectionRows.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nenhuma inspeção registrada.</div>
                )}
                {report.inspectionRows.map((r) => (
                  <div key={r.type}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>
                        {r.label}
                        {r.naoConformes > 0 && (
                          <span className="ml-2 text-[11px] text-red-600 font-semibold">
                            {r.naoConformes} NC
                          </span>
                        )}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {r.valid}/{r.total} válidos · {r.percent}%
                      </span>
                    </div>
                    <Progress value={r.percent} className="h-1.5" />
                  </div>
                ))}
                {report.openActions > 0 && (
                  <div className="text-xs text-amber-600 font-semibold">
                    {report.openActions}{" "}
                    {report.openActions === 1
                      ? "ação corretiva aberta"
                      : "ações corretivas abertas"}{" "}
                    no plano de ação.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* EPIs + Incidentes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  EPIs e EPCs
                  {report.epiPercent !== null && (
                    <span className="ml-2 tabular-nums">{report.epiPercent}%</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.epis === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum EPI cadastrado.</div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Ensaios em dia</span>
                      <span className="font-semibold tabular-nums">
                        {report.epiOk}/{report.epis} · {report.epiPercent}%
                      </span>
                    </div>
                    <Progress value={report.epiPercent ?? 0} className="h-1.5" />
                  </div>
                )}
                <div
                  className={`text-xs font-semibold ${incidentesAbertos > 0 ? "text-red-600" : "text-muted-foreground"}`}
                >
                  {incidentesAbertos > 0
                    ? `${incidentesAbertos} ${incidentesAbertos === 1 ? "incidente elétrico em aberto" : "incidentes elétricos em aberto"}.`
                    : "Nenhum incidente elétrico em aberto."}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tendência histórica */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Evolução da conformidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendData.length < 2 ? (
                <p className="text-xs text-muted-foreground py-4">
                  O histórico é capturado automaticamente uma vez por mês quando o relatório é
                  aberto.
                  {trendData.length === 1
                    ? " Primeiro snapshot registrado — o gráfico aparece a partir do segundo mês."
                    : ""}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        `${v}%`,
                        TREND_SERIES.find((s) => s.key === name)?.label ?? name,
                      ]}
                    />
                    <Legend
                      formatter={(v) => TREND_SERIES.find((s) => s.key === v)?.label ?? v}
                      wrapperStyle={{ fontSize: 10 }}
                    />
                    {TREND_SERIES.map((s) => (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        stroke={s.color}
                        strokeWidth={s.width}
                        dot={{ r: 2.5 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="hidden print:block mt-6 text-[10px] text-muted-foreground text-center">
            Relatório gerado automaticamente pelo sistema Gestão NR-10. Os percentuais consideram
            documentos e treinamentos não vencidos na data de emissão.
          </div>
        </>
      )}
    </PageShell>
  );
}
