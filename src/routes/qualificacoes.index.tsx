import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  reciclagemStatus,
  formatDatePtBR,
  TRAINING_TYPES,
  TRAINING_LABELS,
  SETOR_FULL_NAMES,
  requiredTrainings,
} from "@/lib/qualificacoes";
import type { NR10Training } from "@/lib/qualificacoes";
import { useASOs } from "@/lib/asos-queries";
import { latestASOByEmployee } from "@/lib/asos";
import { computeAptidao, type Bloqueante } from "@/lib/aptidao";

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
  A3: "#059669",
  A4: "#0C3326",
  "Sem auth.": "#d1d5db",
} as const;


function QualificacoesHub() {
  const { data: employees } = useEmployees("ativo");
  const { data: trainings } = useNR10Trainings();
  const { data: authorizations } = useWorkAuthorizations();
  const { data: itTrainings } = useITTrainings();
  const { data: asos } = useASOs();

  const [setorFilter, setSetorFilter] = useState<string>("todos");

  // Card-level filters
  const [nr10CardType, setNr10CardType] = useState<
    "all" | "nr10_basico" | "nr10_areas_classificadas" | "sep"
  >("all");
  const [authCardLevel, setAuthCardLevel] = useState<"all" | "A0" | "A1" | "A2" | "A3" | "A4">(
    "all",
  );
  const [itCardStatus, setItCardStatus] = useState<"all" | "ok" | "pendente" | "vencido">("all");

  const navigate = useNavigate();

  // Hover state para relevo no gráfico de treinamentos
  const [hoveredCell, setHoveredCell] = useState<{ colIndex: number; barKey: string } | null>(null);

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
      // formação é perene; o que expira é a reciclagem bienal
      const st = reciclagemStatus(
        reciclagem?.training_date ?? null,
        formacao?.training_date ?? null,
      );
      return st === "ok" || st === "expiring";
    },
    [trainingMap],
  );

  // Overall compliance KPI
  const overallCompliance = useMemo(() => {
    if (filteredEmployees.length === 0) return 0;
    const fullyCompliant = filteredEmployees.filter((emp) =>
      requiredTrainings(emp.setor).every((type) => isEmployeeCompliantForType(emp.id, type)),
    ).length;
    return Math.round((fullyCompliant / filteredEmployees.length) * 100);
  }, [filteredEmployees, isEmployeeCompliantForType]);

  // Bar chart data — Conformidade por tipo de treinamento
  const trainingComplianceData = useMemo(() => {
    const cols = [
      {
        key: "nr10_basico:formacao",
        label: `${TRAINING_LABELS.nr10_basico}\nFormação`,
        type: "nr10_basico",
        cat: "formacao",
      },
      {
        key: "nr10_basico:reciclagem",
        label: `${TRAINING_LABELS.nr10_basico}\nReciclagem`,
        type: "nr10_basico",
        cat: "reciclagem",
      },
      {
        key: "nr10_areas_classificadas:formacao",
        label: `${TRAINING_LABELS.nr10_areas_classificadas}\nFormação`,
        type: "nr10_areas_classificadas",
        cat: "formacao",
      },
      {
        key: "nr10_areas_classificadas:reciclagem",
        label: `${TRAINING_LABELS.nr10_areas_classificadas}\nReciclagem`,
        type: "nr10_areas_classificadas",
        cat: "reciclagem",
      },
      {
        key: "sep:formacao",
        label: `${TRAINING_LABELS.sep}\nFormação`,
        type: "sep",
        cat: "formacao",
      },
      {
        key: "sep:reciclagem",
        label: `${TRAINING_LABELS.sep}\nReciclagem`,
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
        // GER não tem requisito de Áreas Classificadas — excluir da coluna
        if (!requiredTrainings(emp.setor).includes(col.type as typeof TRAINING_TYPES[number])) continue;
        let s: "ok" | "expiring" | "expired" | "none";
        if (col.cat === "formacao") {
          // formação é perene — só OK ou Sem registro
          const t = trainingMap.get(`${emp.id}:${col.type}:formacao`);
          s = t?.training_date ? "ok" : "none";
        } else {
          // reciclagem bienal — usa formação como base quando não há reciclagem registrada
          const rec = trainingMap.get(`${emp.id}:${col.type}:reciclagem`);
          const form = trainingMap.get(`${emp.id}:${col.type}:formacao`);
          s = reciclagemStatus(rec?.training_date ?? null, form?.training_date ?? null);
        }
        if (s === "ok") ok++;
        else if (s === "expiring") expiring++;
        else if (s === "expired") expired++;
        else none++;
      }
      return { name: col.label, type: col.type, cat: col.cat, ok, expiring, expired, none };
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
    const authMap = new Map((authorizations ?? []).map((a: any) => [a.employee_id, a]));
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
    const setores = ["ELE", "GER", "INS", "ADM"];
    return setores
      .map((setor) => {
        const empInSetor = activeEmployees.filter((e) => e.setor === setor);
        if (empInSetor.length === 0) return null;
        const required = requiredTrainings(setor);
        const compliant = empInSetor.filter((emp) =>
          required.every((type) => isEmployeeCompliantForType(emp.id, type)),
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
      if (t.category === "formacao") continue; // formação é perene, nunca vence
      const s = trainingExpiryStatus(t.training_date);
      if (s === "expiring" || s === "expired") {
        const emp = filteredEmployees.find((e) => e.id === t.employee_id);
        if (emp) {
          alerts.push({
            empName: emp.name,
            type:
              TRAINING_LABELS[t.training_type as keyof typeof TRAINING_LABELS] ?? t.training_type,
            cat: "Reciclagem",
            date: t.training_date,
            status: s,
          });
        }
      }
    }
    return alerts.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [trainings, filteredEmployees, filteredIds]);

  // Derived authorization counts for KPI card
  const authsInFilter = useMemo(
    () => (authorizations ?? []).filter((a: any) => filteredIds.has(a.employee_id)),
    [authorizations, filteredIds],
  );
  const validAuthsCount = authsInFilter.filter((a: any) => !a.suspended).length;
  const noAuthCount = filteredEmployees.length - authsInFilter.length;

  // Conformidade de treinamentos card — filtered by nr10CardType
  const nr10CardCompliance = useMemo(() => {
    if (filteredEmployees.length === 0) return 0;
    const compliant = filteredEmployees.filter((emp) => {
      const typesToCheck =
        nr10CardType === "all" ? requiredTrainings(emp.setor) : [nr10CardType as typeof TRAINING_TYPES[number]];
      return typesToCheck.every((type) => isEmployeeCompliantForType(emp.id, type));
    }).length;
    return Math.round((compliant / filteredEmployees.length) * 100);
  }, [filteredEmployees, nr10CardType, isEmployeeCompliantForType]);

  // Autorizações card — filtered by authCardLevel
  const authCardCount = useMemo(() => {
    if (authCardLevel === "all")
      return { valid: validAuthsCount, total: authsInFilter.length, noAuth: noAuthCount };
    const levelFiltered = authsInFilter.filter((a: any) => a.level === authCardLevel);
    return {
      valid: levelFiltered.filter((a: any) => !a.suspended).length,
      total: levelFiltered.length,
      noAuth: 0,
    };
  }, [authsInFilter, authCardLevel, validAuthsCount, noAuthCount]);

  // ITs card display count
  const itCardDisplayCount =
    itCardStatus === "all"
      ? itStatusCounts.ok
      : itCardStatus === "ok"
        ? itStatusCounts.ok
        : itCardStatus === "pendente"
          ? itStatusCounts.pendente
          : itStatusCounts.vencido;

  // ── Bloqueantes: autorizados com pendência que invalida a aptidão ─────────
  const bloqueantesList = useMemo(() => {
    const authMap = new Map((authorizations ?? []).map((a: any) => [a.employee_id, a]));
    const latestASOs = latestASOByEmployee(asos ?? []);
    const trainingsByEmp = new Map<string, NR10Training[]>();
    for (const t of trainings ?? []) {
      const arr = trainingsByEmp.get(t.employee_id);
      if (arr) arr.push(t);
      else trainingsByEmp.set(t.employee_id, [t]);
    }
    const out: { emp: (typeof filteredEmployees)[number]; bloqueantes: Bloqueante[] }[] = [];
    for (const emp of filteredEmployees) {
      const auth = authMap.get(emp.id) as any;
      if (!auth) continue; // só quem tem autorização ativa: é onde mora o risco legal
      const { apto, bloqueantes } = computeAptidao({
        employee: emp,
        trainings: trainingsByEmp.get(emp.id) ?? [],
        authorization: auth,
        aso: latestASOs.get(emp.id) ?? null,
      });
      if (!apto) out.push({ emp, bloqueantes });
    }
    return out.sort((a, b) => b.bloqueantes.length - a.bloqueantes.length);
  }, [filteredEmployees, authorizations, trainings, asos]);


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
              {([
                ["ELE", "ELE — Elétrica"],
                ["INS", "INS — Instrumentação"],
                ["GER", "GER — Geração de energia"],
                ["ADM", "ADM — Administrativo"],
              ] as [string, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
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
              <div className="rounded-full p-2.5 bg-[#0C3326]">
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
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Conformidade de treinamentos
                </p>
                <p
                  className={`text-3xl font-bold mt-1 ${
                    nr10CardCompliance >= 80
                      ? "text-emerald-600"
                      : nr10CardCompliance >= 50
                        ? "text-amber-500"
                        : "text-destructive"
                  }`}
                >
                  {nr10CardCompliance}%
                </p>
              </div>
              <div
                className={`rounded-full p-2.5 flex-shrink-0 ${
                  nr10CardCompliance >= 80
                    ? "bg-emerald-500"
                    : nr10CardCompliance >= 50
                      ? "bg-amber-500"
                      : "bg-destructive"
                }`}
              >
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            </div>
            <Select
              value={nr10CardType}
              onValueChange={(v) => setNr10CardType(v as typeof nr10CardType)}
            >
              <SelectTrigger className="h-6 text-[10px] mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {TRAINING_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TRAINING_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Autorizações válidas */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Autorizações válidas
                </p>
                <p className="text-3xl font-bold mt-1">
                  {authCardCount.valid}
                  <span className="text-sm text-muted-foreground font-normal">
                    /{authCardCount.total}
                  </span>
                </p>
              </div>
              <div className="rounded-full p-2.5 flex-shrink-0 bg-[#059669]">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
            </div>
            <Select
              value={authCardLevel}
              onValueChange={(v) => setAuthCardLevel(v as typeof authCardLevel)}
            >
              <SelectTrigger className="h-6 text-[10px] mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                {["A0", "A1", "A2", "A3", "A4"].map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {authCardLevel === "all"
                ? `${authCardCount.noAuth} sem autorização`
                : `nível ${authCardLevel}`}
            </p>
          </CardContent>
        </Card>

        {/* ITs OK */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  ITs —{" "}
                  {itCardStatus === "all"
                    ? "Status OK"
                    : itCardStatus === "ok"
                      ? "OK"
                      : itCardStatus === "pendente"
                        ? "Pendentes"
                        : "Vencidas"}
                </p>
                <p
                  className={`text-3xl font-bold mt-1 ${itCardStatus === "vencido" ? "text-destructive" : itCardStatus === "pendente" ? "text-amber-500" : "text-emerald-600"}`}
                >
                  {itCardDisplayCount}
                </p>
              </div>
              <div
                className={`rounded-full p-2.5 flex-shrink-0 ${itCardStatus === "vencido" ? "bg-destructive" : itCardStatus === "pendente" ? "bg-amber-500" : "bg-emerald-500"}`}
              >
                <BookOpen className="h-5 w-5 text-white" />
              </div>
            </div>
            <Select
              value={itCardStatus}
              onValueChange={(v) => setItCardStatus(v as typeof itCardStatus)}
            >
              <SelectTrigger className="h-6 text-[10px] mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="vencido">Vencidas</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {itStatusCounts.pendente} pendentes · {itStatusCounts.vencido} vencidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bloqueantes — autorizados com pendência (motor de aptidão) */}
      <Card
        className={`mb-6 ${bloqueantesList.length > 0 ? "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20" : "border-emerald-200"}`}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <AlertTriangle
              className={`h-4 w-4 ${bloqueantesList.length > 0 ? "text-red-600" : "text-emerald-600"}`}
            />
            Bloqueantes — autorizados com pendência
            <Badge
              variant={bloqueantesList.length > 0 ? "destructive" : "outline"}
              className="ml-1 text-[10px]"
            >
              {bloqueantesList.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bloqueantesList.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-600 py-2">
              <CheckCircle2 className="h-4 w-4" />
              Todos os colaboradores com autorização ativa estão aptos (capacitação, ASO e
              autorização em dia).
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Estas pessoas constam como autorizadas, mas têm pendência que invalida a aptidão
                para trabalho em eletricidade (NR-10 10.8).
              </p>
              {bloqueantesList.map(({ emp, bloqueantes }) => (
                <div
                  key={emp.id}
                  className="flex items-start justify-between gap-3 text-xs py-1.5 border-b last:border-0 flex-wrap"
                >
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-muted-foreground">
                      Mat. {emp.matricula}
                      {emp.setor ? ` · ${emp.setor}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {bloqueantes.map((b) => (
                      <Badge
                        key={b.code}
                        variant="destructive"
                        className="text-[10px] font-normal"
                        title={b.detail}
                      >
                        {b.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 2: Stacked bar chart */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Conformidade NR-10 por tipo de treinamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Legenda clicável */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 justify-center">
            {(["ok", "expiring", "expired", "none"] as const).map((s) => {
              const labels: Record<string, string> = { ok: "OK", expiring: "Vencendo em 90 dias", expired: "Vencido", none: "Sem registro" };
              const isHov = hoveredCell?.barKey === s && hoveredCell.colIndex === -1;
              return (
                <button
                  key={s}
                  type="button"
                  className="flex items-center gap-1.5 text-[10px] rounded px-1.5 py-0.5 transition-all hover:bg-muted/50 cursor-pointer"
                  style={{ fontWeight: hoveredCell?.colIndex === -1 && hoveredCell?.barKey === s ? 700 : undefined }}
                  onMouseEnter={() => setHoveredCell({ colIndex: -1, barKey: s })}
                  onMouseLeave={() => setHoveredCell(null)}
                  onClick={() => navigate({ to: "/qualificacoes/nr10", search: { tipo: "all", status: s, setor: setorFilter === "todos" ? "all" : setorFilter } })}
                  title={`Ver colaboradores com status "${labels[s]}" em capacitações NR-10`}
                >
                  <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{ background: COLORS[s], boxShadow: isHov ? `0 0 0 2px ${COLORS[s]}55` : undefined }} />
                  {labels[s]}
                </button>
              );
            })}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={trainingComplianceData}
              margin={{ top: 4, right: 16, left: 0, bottom: 32 }}
              onMouseLeave={() => setHoveredCell(null)}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const entry = trainingComplianceData.find((d) => d.name === payload.value);
                  const lines: string[] = payload.value.split("\n");
                  return (
                    <g
                      transform={`translate(${x},${y})`}
                      style={{ cursor: "pointer" }}
                      onClick={() => entry && navigate({ to: "/qualificacoes/nr10", search: { tipo: entry.type, status: "all", setor: setorFilter === "todos" ? "all" : setorFilter } })}
                    >
                      {lines.map((line: string, i: number) => (
                        <text key={i} x={0} y={0} dy={i * 11 + 10} textAnchor="middle" fill="#6b7280" fontSize={10}>
                          {line}
                        </text>
                      ))}
                    </g>
                  );
                }}
              />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                formatter={(value, name) => [value, name === "ok" ? "OK" : name === "expiring" ? "Vencendo" : name === "expired" ? "Vencido" : "Sem registro"]}
              />
              {(["ok", "expiring", "expired", "none"] as const).map((barKey, barIdx) => (
                <Bar
                  key={barKey}
                  dataKey={barKey}
                  stackId="a"
                  fill={COLORS[barKey]}
                  name={barKey}
                  radius={barKey === "none" ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(_: any, colIndex: number) => setHoveredCell({ colIndex, barKey })}
                  onClick={(data: any, colIndex: number) =>
                    navigate({ to: "/qualificacoes/nr10", search: { tipo: data.type, status: barKey, setor: setorFilter === "todos" ? "all" : setorFilter } })
                  }
                >
                  {trainingComplianceData.map((_, colIndex) => {
                    const isHovered = hoveredCell?.colIndex === colIndex && hoveredCell?.barKey === barKey;
                    return (
                      <Cell
                        key={colIndex}
                        fill={COLORS[barKey]}
                        style={isHovered
                          ? { filter: "brightness(1.18) drop-shadow(0 -3px 6px rgba(0,0,0,0.22))", outline: "none" }
                          : undefined}
                      />
                    );
                  })}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Clique em um segmento para filtrar por status · Clique no nome do curso para ver todos · Clique na legenda para filtrar por status em todos os cursos
          </p>
        </CardContent>
      </Card>

      {/* Row 3: Donut + Setor bar */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-5 mb-6">
        {/* Donut — Autorização por nível */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Nível de autorização</CardTitle>
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
                  cursor="pointer"
                  onClick={(data: any) =>
                    navigate({ to: "/qualificacoes/autorizacoes", search: { level: data.name, setor: "todos", valida: "all", semAuth: "all" } })
                  }
                >
                  {authLevelData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[entry.name as keyof typeof COLORS] ?? "#6b7280"}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, `Nível ${name}`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
              {authLevelData.map((d) => (
                <div key={d.name} className="flex items-center gap-1 text-xs">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background: COLORS[d.name as keyof typeof COLORS] ?? "#6b7280",
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
            <CardTitle className="text-sm font-semibold">Conformidade de treinamentos por equipe</CardTitle>
          </CardHeader>
          <CardContent>
            {setorComplianceData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                Sem dados para exibir.
              </p>
            ) : (
              <div className="space-y-3 pt-2">
                {setorComplianceData.map((d) => (
                  <div
                    key={d.setor}
                    className="flex items-center gap-3 text-xs cursor-pointer rounded px-1 hover:bg-muted/40 transition-colors"
                    title={`Ver capacitações da equipe ${d.setor}`}
                    onClick={() => navigate({ to: "/qualificacoes/nr10", search: { tipo: "all", status: "all", setor: d.setor } })}
                  >
                    <span className="w-8 font-medium text-muted-foreground">{d.setor}</span>
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
                    <span className="w-12 text-right font-semibold">{d.pct}%</span>
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
                { label: "Concluídas (OK)", count: itStatusCounts.ok, color: "bg-emerald-500", status: "ok" },
                { label: "Pendentes", count: itStatusCounts.pendente, color: "bg-amber-500", status: "pendente" },
                { label: "Vencidas", count: itStatusCounts.vencido, color: "bg-destructive", status: "vencido" },
              ].map((item) => {
                const total = itStatusCounts.ok + itStatusCounts.pendente + itStatusCounts.vencido;
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 text-xs cursor-pointer rounded px-1 py-0.5 hover:bg-muted/40 transition-colors"
                    title={`Ver ITs com status "${item.label}"`}
                    onClick={() => navigate({ to: "/qualificacoes/instrucoes", search: { status: item.status, setor: "all", it: "all", view: "matrix" } })}
                  >
                    <span className="w-32 text-muted-foreground">{item.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right font-semibold">{item.count}</span>
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
                      <p className="text-muted-foreground">{formatDatePtBR(alert.date)}</p>
                      <Badge
                        variant={alert.status === "expired" ? "destructive" : "secondary"}
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
