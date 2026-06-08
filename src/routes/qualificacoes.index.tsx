import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Users,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  useEmployees,
  useNR10Trainings,
  useWorkAuthorizations,
} from "@/lib/qualificacoes-queries";
import {
  trainingExpiryStatus,
  TRAINING_LABELS,
  formatDatePtBR,
} from "@/lib/qualificacoes";
import type { NR10Training } from "@/lib/qualificacoes";

export const Route = createFileRoute("/qualificacoes/")({
  component: QualificacoesHub,
  head: () => ({ meta: [{ title: "Qualificações NR-10 — Gestão" }] }),
});

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  href: string;
  color: string;
}) {
  return (
    <Link to={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {label}
              </p>
              <p className="text-3xl font-bold mt-1">{value}</p>
            </div>
            <div className={`rounded-full p-2.5 ${color}`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
            Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QualificacoesHub() {
  const { data: employees = [] } = useEmployees();
  const { data: trainings = [] } = useNR10Trainings();
  const { data: authorizations = [] } = useWorkAuthorizations();

  const validTrainings = (trainings as Array<{ valid: boolean }>).filter(
    (t) => t.valid,
  ).length;
  const validAuths = (authorizations as Array<{ valid: boolean }>).filter(
    (a) => a.valid,
  ).length;

  // Build employee id → name map
  const employeeMap = new Map(
    (employees as Array<{ id: string; name: string }>).map((e) => [e.id, e.name]),
  );

  // Build set of employee ids that have at least one authorization record
  const employeeIdsWithAuth = new Set(
    (authorizations as Array<{ employee_id: string; valid: boolean }>).map(
      (a) => a.employee_id,
    ),
  );

  // Count employees with no authorization record at all
  const countNoAuth = (employees as Array<{ id: string }>).filter(
    (e) => !employeeIdsWithAuth.has(e.id),
  ).length;

  // Count employees with an authorization record but valid=false
  const countInvalidAuth = (
    authorizations as Array<{ employee_id: string; valid: boolean }>
  ).filter((a) => !a.valid).length;

  // Identify trainings that are expiring or expired
  type TrainingRow = NR10Training & { _status: "expiring" | "expired" };
  const alertTrainings: TrainingRow[] = [];

  for (const t of trainings as NR10Training[]) {
    const status = trainingExpiryStatus(t.training_date ?? null);
    if (status === "expiring" || status === "expired") {
      alertTrainings.push({ ...t, _status: status });
    }
  }

  // Sort: expired first, then expiring; within same status sort by training_date ascending
  alertTrainings.sort((a, b) => {
    if (a._status !== b._status) {
      return a._status === "expired" ? -1 : 1;
    }
    const da = a.training_date ?? "";
    const db = b.training_date ?? "";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  const alertSlice = alertTrainings.slice(0, 8);

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold">Qualificações NR-10</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Controle de treinamentos, instruções de trabalho e autorizações.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Colaboradores"
          value={employees.length}
          href="/qualificacoes/colaboradores"
          color="bg-[#0A2D48]"
        />
        <StatCard
          icon={GraduationCap}
          label="Treinamentos NR-10 válidos"
          value={validTrainings}
          href="/qualificacoes/nr10"
          color="bg-emerald-600"
        />
        <StatCard
          icon={BookOpen}
          label="ITs — Instruções"
          value="—"
          href="/qualificacoes/instrucoes"
          color="bg-amber-500"
        />
        <StatCard
          icon={ShieldCheck}
          label="Autorizações válidas"
          value={validAuths}
          href="/qualificacoes/autorizacoes"
          color="bg-[#E35D12]"
        />
      </div>

      {/* Training expiry section */}
      <div className="mt-8">
        <h2 className="text-base font-semibold mb-3">
          Situação dos Treinamentos NR-10
        </h2>
        <Card>
          <CardContent className="p-0">
            {alertSlice.length === 0 ? (
              <div className="flex items-center gap-2 p-5 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Todos os treinamentos estão em dia.
              </div>
            ) : (
              <div className="divide-y">
                {alertSlice.map((t) => {
                  const empName = employeeMap.get(t.employee_id) ?? t.employee_id;
                  const typeLabel = TRAINING_LABELS[t.training_type] ?? t.training_type;
                  const dateLabel = formatDatePtBR(t.training_date);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-5 py-3 gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{empName}</p>
                        <p className="text-xs text-muted-foreground">
                          {typeLabel} — {t.category === "formacao" ? "Formação" : "Reciclagem"}
                          {t.training_date ? ` · ${dateLabel}` : ""}
                        </p>
                      </div>
                      {t._status === "expired" ? (
                        <Badge variant="destructive" className="shrink-0">Vencido</Badge>
                      ) : (
                        <Badge className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white">
                          Vence em breve
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        {alertSlice.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Mostrando {alertSlice.length} de {alertTrainings.length} treinamento
            {alertTrainings.length !== 1 ? "s" : ""} com atenção necessária.{" "}
            <Link to="/qualificacoes/nr10" className="text-primary underline">
              Ver todos
            </Link>
          </p>
        )}
      </div>

      {/* Authorizations summary */}
      <div className="mt-8">
        <h2 className="text-base font-semibold mb-3">Autorizações</h2>
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sem autorização</span>
              <span className={countNoAuth > 0 ? "font-semibold text-destructive" : "font-semibold"}>
                {countNoAuth} colaborador{countNoAuth !== 1 ? "es" : ""}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Com autorização inválida</span>
              <span className={countInvalidAuth > 0 ? "font-semibold text-destructive" : "font-semibold"}>
                {countInvalidAuth} colaborador{countInvalidAuth !== 1 ? "es" : ""}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
