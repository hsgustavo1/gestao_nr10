import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Users,
  ArrowRight,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  useEmployees,
  useNR10Trainings,
  useWorkAuthorizations,
} from "@/lib/qualificacoes-queries";

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

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold">Qualificações NR-10</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Controle de treinamentos, instruções de trabalho e autorizações.
        </p>
      </div>

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
    </PageShell>
  );
}
