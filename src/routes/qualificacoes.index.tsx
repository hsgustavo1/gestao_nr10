import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import {
  Users,
  GraduationCap,
  ShieldCheck,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  useEmployees,
  useNR10Trainings,
  useWorkAuthorizations,
  useITTrainings,
} from "@/lib/qualificacoes-queries";
import {
  trainingExpiryStatus,
  formatDatePtBR,
  TRAINING_TYPES,
  TRAINING_LABELS,
} from "@/lib/qualificacoes";
import type { NR10Training } from "@/lib/qualificacoes";

export const Route = createFileRoute("/qualificacoes/")({
  component: QualificacoesHub,
  head: () => ({ meta: [{ title: "Qualificações NR-10 — Gestão" }] }),
});

const COLORS = {
  ok: "#10b981",
  expiring: "#f59e0b",
  expired: "#ef4444",
  none: "#e5e7eb",
  A0: "#6b7280",
  A1: "#3b82f6",
  A2: "#8b5cf6",
  A3: "#E35D12",
  A4: "#0A2D48",
  "Sem auth.": "#d1d5db",
} as const;

function QualificacoesHub() {
  const { data: employees } = useEmployees("ativo");
  const { data: trainings } = useNR10Trainings();
  const { data: authorizations } = useWorkAuthorizations();
  const { data: itTrainings } = useITTrainings();

  const [setorFilter, setSetorFilter] = useState<string>("todos");

  // Active employees (hook already filters to "ativo")
  const activeEmployees = useMemo(() => employees ?? [], [employees]);

  const filteredEmployees = useMemo(
    () =>
      setorFilter === "todos"
        ? activeEmployees
        : activeEmployees.filter((e) => e.setor === setorFilter),
    [activeEmployees, setorFilter],
  );

  const filteredIds = useMemo(
    () => new Set(filteredEmployees.map((e) => e.id)),
    [filteredEmployees],
  );

  // Build training map: "employeeId:type:category" -> NR10Training
  const trainingMap = useMemo(() => {
    const map = new Map<string, NR10Training>();
    for (const t of trainings ?? []) {
      map.set(`${t.employee_id}:${t.training_type}:${t.category}`, t);
    }
    return map;
  }, [trainings]);

  // Helper: is employee compliant for a given training type?
  const isEmployeeCompliantForType = useCallback(
    (empId: string, type: string): boolean => {
      const formacao = trainingMap.get(`${empId}:${type}:formacao`);
      const reciclagem = trainingMap.get(`${empId}:${type}:reciclagem`);
      const recStatus = reciclagem?.training_date
        ? trainingExpiryStatus(reciclagem.training_date)
        : "none";
      if (recStatus === "ok" || recStatus === "expiring") return true;
      const fStatus = formacao?.training_date
        ? trainingExpiryStatus(formacao.training_date)
        : "none";
      return fStatus === "ok" || fStatus === "expiring";
    },
    [trainingMap],
  );

  // Overall compliance KPI
  const overallCompliance = useMemo(() => {
    if (filteredEmployees.length === 0) return 0;
    const fullyCompliant = filteredEmployees.filter((emp) =>
      TRAINING_TYPES.every((type) => isEmployeeCompliantForType(emp.id, type)),
    ).length;
    return Math.round((fullyCompliant / filteredEmployees.length) * 100);
  }, [filteredEmployees, isEmployeeCompliantForType]);

  // Bar chart data — Conformidade por tipo de treinamento
  const trainingComplianceData = useMemo(() => {
    const cols = [
      {
        key: "nr10_basico:formacao",
        label: "NR-10 B.\nFormação",
        type: "nr10_basico",
        cat: "formacao",
      },
      {
        key: "nr10_basico:reciclagem",
        label: "NR-10 B.\nReciclagem",
        type: "nr10_basico",
        cat: "reciclagem",
      },
      {
        key: "nr10_areas_classificadas:formacao",
        label: "Áreas C.\nFormação",
        type: "nr10_areas_classificadas",
        cat: "formacao",
      },
      {
        key: "nr10_areas_classificadas:reciclagem",
        label: "Áreas C.\nReciclagem",
        type: "nr10_areas_classificadas",
        cat: "reciclagem",
      },
      {
        key: "sep:formacao",
        label: "SEP\nFormação",
        type: "sep",
        cat: "formacao",
      },
      {
        key: "sep:reciclagem",
        label: "SEP\nReciclagem",
        type: "sep",
        cat: "reciclagem",
      },
    ] as const;

    return cols.map((col) => {
      let ok = 0,
        expiring = 0,
        expired = 0,
        none = 0;
      for (const emp of filteredEmployees) {
        const t = trainingMap.get(`${emp.id}:${col.type}:${col.cat}`);
        const s = t?.training_date
          ? trainingExpiryStatus(t.training_date)
          : "none";
        if (s === "ok") ok++;
        else if (s === "expiring") expiring++;
        else if (s === "expired") expired++;
        else none++;
      }
      return { name: col.label, ok, expiring, expired, none };
    });
  }, [filteredEmployees, trainingMap]);

  // Donut chart data — Autorização por nível
  const authLevelData = useMemo(() => {
    const counts: Record<string, number> = {
      A0: 0,
      A1: 0,
      A2: 0,
      A3: 0,
      A4: 0,
      "Sem auth.": 0,
    };
    const authMap = new Map(
      (authorizations ?? []).map((a: any) => [a.employee_id, a]),
    );
    for (const emp of filteredEmployees) {
      const auth = authMap.get(emp.id) as any;
      if (auth?.level && counts[auth.level] !== undefined) {
        counts[auth.level]++;
      } else {
        counts["Sem auth."]++;
      }
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [filteredEmployees, authorizations]);

  // Horizontal bar chart — Conformidade por equipe
  const setorComplianceData = useMemo(() => {
    const setores = ["ELE", "GER", "INS", "MEC", "ADM", "OPE", "OUT"];
    return setores
      .map((setor) => {
        const empInSetor = activeEmployees.filter((e) => e.setor === setor);
        if (empInSetor.length === 0) return null;
        const compliant = empInSetor.filter((emp) =>
          TRAINING_TYPES.some((type) =>
            isEmployeeCompliantForType(emp.id, type),
          ),
        ).length;
        const pct = Math.round((compliant / empInSetor.length) * 100);
        return { setor, compliant, total: empInSetor.length, pct };
      })
      .filter(Boolean) as { setor: string; compliant: number; total: number; pct: number }[];
  }, [activeEmployees, isEmployeeCompliantForType]);

  // IT status counts
  const itStatusCounts = useMemo(() => {
    const counts = { ok: 0, pendente: 0, vencido: 0 };
    for (const t of itTrainings ?? []) {
      const it = t as any;
      if (filteredIds.has(it.employee_id)) {
        const status = it.status as keyof typeof counts;
        if (status in counts) counts[status]++;
      }
    }
    return counts;
  }, [itTrainings, filteredIds]);

  // Alert list — expiring/expired trainings
  const expiringAlerts = useMemo(() => {
    const alerts: {
      empName: string;
      type: string;
      cat: string;
      date: string;
      status: string;
    }[] = [];
    for (const t of trainings ?? []) {
      if (!filteredIds.has(t.employee_id) || !t.training_date) continue;
      const s = trainingExpiryStatus(t.training_date);
      if (s === "expiring" || s === "expired") {
        const emp = filteredEmployees.find((e) => e.id === t.employee_id);
        if (emp) {
          alerts.push({
            empName: emp.name,
            type:
              TRAINING_LABELS[t.training_type as keyof typeof TRAINING_LABELS] ??
              t.training_type,
            cat: t.category === "formacao" ? "Formação" : "Reciclagem",
            date: t.training_date,
            status: s,
          });
        }
      }
    }
    return alerts
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [trainings, filteredEmployees, filteredIds]);

  // Derived authorization counts for KPI card
  const authsInFilter = useMemo(
    () => (authorizations ?? []).filter((a: any) => filteredIds.has(a.employee_id)),
    [authorizations, filteredIds],
  );
  const validAuthsCount = authsInFilter.filter((a: any) => a.valid).length;
  const noAuthCount = filteredEmployees.length - authsInFilter.length;

  return (
    <PageShell>
      {/* Header with setor filter */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Pessoas — Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Visão geral de conformidade NR-10
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Equipe:</span>
          <Select value={setorFilter} onValueChange={setSetorFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {["ELE", "GER", "INS", "MEC", "ADM", "OPE", "OUT"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1: KPI cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Total colaboradores */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Colaboradores
                </p>
                <p className="text-3xl font-bold mt-1">{filteredEmployees.length}</p>
              </div>
              <div className="rounded-full p-2.5 bg-[#0A2D48]">
                <Users className="h-5 w-5 text-white" />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {activeEmployees.length} ativos no total
            </p>
          </CardContent>
        </Card>

        {/* Conformidade geral */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Conformidade NR-10
                </p>
                <p
                  className={`text-3xl font-bold mt-1 ${
                    overallCompliance >= 80
                      ? "text-emerald-600"
                      : overallCompliance >= 50
                        ? "text-amber-500"
                        : "text-destructive"
                  }`}
                >
                  {overallCompliance}%
                </p>
              </div>
              <div
                className={`rounded-full p-2.5 ${
                  overallCompliance >= 80
                    ? "bg-emerald-500"
                    : overallCompliance >= 50
                      ? "bg-amber-500"
                      : "bg-destructive"
                }`}
              >
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              todos os tipos de treinamento
            </p>
          </CardContent>
        </Card>

        {/* Autorizações válidas */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Autorizações válidas
                </p>
                <p className="text-3xl font-bold mt-1">
                  {validAuthsCount}
                  <span className="text-sm text-muted-foreground font-normal">
                    /{authsInFilter.length}
                  </span>
                </p>
              </div>
              <div className="rounded-full p-2.5 bg-[#E35D12]">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {noAuthCount} sem autorização
            </p>
          </CardContent>
        </Card>

        {/* ITs OK */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  ITs — Status OK
                </p>
                <p className="text-3xl font-bold mt-1 text-emerald-600">
                  {itStatusCounts.ok}
                </p>
              </div>
              <div className="rounded-full p-2.5 bg-emerald-500">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {itStatusCounts.pendente} pendentes · {itStatusCounts.vencido} vencidos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Stacked bar chart */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Conformidade NR-10 por tipo de treinamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={trainingComplianceData}
              margin={{ top: 4, right: 16, left: 0, bottom: 32 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === "ok"
                    ? "OK"
                    : name === "expiring"
                      ? "Vencendo"
                      : name === "expired"
                        ? "Vencido"
                        : "Sem registro",
                ]}
              />
              <Legend
                formatter={(value) =>
                  value === "ok"
                    ? "OK"
                    : value === "expiring"
                      ? "Vencendo em 90 dias"
                      : value === "expired"
                        ? "Vencido"
                        : "Sem registro"
                }
                wrapperStyle={{ fontSize: 10 }}
              />
              <Bar
                dataKey="ok"
                stackId="a"
                fill={COLORS.ok}
                name="ok"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="expiring"
                stackId="a"
                fill={COLORS.expiring}
                name="expiring"
              />
              <Bar
                dataKey="expired"
                stackId="a"
                fill={COLORS.expired}
                name="expired"
              />
              <Bar
                dataKey="none"
                stackId="a"
                fill={COLORS.none}
                name="none"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Row 3: Donut + Setor bar */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-5 mb-6">
        {/* Donut — Autorização por nível */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Nível de autorização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={authLevelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {authLevelData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        COLORS[entry.name as keyof typeof COLORS] ?? "#6b7280"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value, `Nível ${name}`]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
              {authLevelData.map((d) => (
                <div key={d.name} className="flex items-center gap-1 text-xs">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background:
                        COLORS[d.name as keyof typeof COLORS] ?? "#6b7280",
                    }}
                  />
                  <span>
                    {d.name}: <strong>{d.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Horizontal bar — Conformidade por equipe */}
        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Conformidade NR-10 por equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {setorComplianceData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                Sem dados para exibir.
              </p>
            ) : (
              <div className="space-y-3 pt-2">
                {setorComplianceData.map((d) => (
                  <div key={d.setor} className="flex items-center gap-3 text-xs">
                    <span className="w-8 font-medium text-muted-foreground">
                      {d.setor}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          d.pct >= 80
                            ? "bg-emerald-500"
                            : d.pct >= 50
                              ? "bg-amber-500"
                              : "bg-destructive"
                        }`}
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-semibold">
                      {d.pct}%
                    </span>
                    <span className="text-muted-foreground w-14">
                      ({d.compliant}/{d.total})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: IT status + Alerts */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* IT status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Status das Instruções de Trabalho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  label: "Concluídas (OK)",
                  count: itStatusCounts.ok,
                  color: "bg-emerald-500",
                },
                {
                  label: "Pendentes",
                  count: itStatusCounts.pendente,
                  color: "bg-amber-500",
                },
                {
                  label: "Vencidas",
                  count: itStatusCounts.vencido,
                  color: "bg-destructive",
                },
              ].map((item) => {
                const total =
                  itStatusCounts.ok +
                  itStatusCounts.pendente +
                  itStatusCounts.vencido;
                const pct =
                  total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span className="w-32 text-muted-foreground">
                      {item.label}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-semibold">
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas — Vencimentos próximos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringAlerts.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-600 py-4">
                <CheckCircle2 className="h-4 w-4" />
                Nenhum treinamento vencendo nos próximos 90 dias.
              </div>
            ) : (
              <div className="space-y-2">
                {expiringAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">{alert.empName}</p>
                      <p className="text-muted-foreground">
                        {alert.type} — {alert.cat}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">
                        {formatDatePtBR(alert.date)}
                      </p>
                      <Badge
                        variant={
                          alert.status === "expired" ? "destructive" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {alert.status === "expired" ? "Vencido" : "Vence em breve"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
