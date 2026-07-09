import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ShieldCheck,
  ClipboardList,
  Users,
  Smartphone,
  Lock,
  Zap,
  AlertTriangle,
  BarChart3,
  Settings,
  ArrowRight,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { getRtiCampoAccess } from "@/lib/tenancy-gates";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Gestão NR-10" },
      {
        name: "description",
        content: "Plataforma de conformidade NR-10: qualificações, inspeções de campo e gestão de não conformidades.",
      },
    ],
  }),
});

function HomePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { canView: canViewRti } = getRtiCampoAccess(auth);

  const redirectTo = !auth.loading
    ? !auth.user && !auth.isViewer
      ? "/login"
      : auth.user && !auth.isPlatformAdmin
        ? auth.currentOrg?.tipo === "cliente"
          ? "/home"
          : canViewRti
            ? "/rti"
            : "/qualificacoes"
        : null
    : null;

  useEffect(() => {
    if (redirectTo) navigate({ to: redirectTo, replace: true });
  }, [redirectTo, navigate]);

  if (auth.loading || redirectTo) return null;

  return (
    <PageShell>
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl border border-border text-white shadow-card-soft"
        style={{ background: "linear-gradient(160deg, #0C3326 0%, #174830 100%)" }}
      >
        <div className="absolute inset-y-0 left-0 w-1.5 bg-brand-gradient" />
        <div className="grid gap-8 p-8 md:p-12 md:grid-cols-[1.5fr_1fr] items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">NR-10</span>
            </span>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold leading-tight">
              Conformidade legal e Segurança{" "}
              <span style={{ color: "var(--conforme-emerald)" }}>de sistemas elétricos</span>
            </h1>
            <p className="mt-4 max-w-xl text-white/75 text-base leading-relaxed">
              Gestão integrada de qualificações NR-10, inspeções de campo, não conformidades e
              dispositivos de bloqueio — tudo em um só lugar.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-br from-[#34D399] to-[#059669] text-white shadow-brand hover:opacity-95"
              >
                <Link to="/rti">
                  Abrir RTI <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white"
              >
                <Link to="/qualificacoes">Qualificações</Link>
              </Button>
            </div>
          </div>
          <div className="relative grid place-items-center">
            <div className="relative grid h-44 w-44 place-items-center rounded-3xl bg-gradient-to-br from-[#34D399] to-[#059669] shadow-brand">
              <ShieldCheck className="h-20 w-20 text-white" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </section>

      {/* Módulos principais */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Módulos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            icon={<ClipboardList className="h-5 w-5" />}
            title="RTI — Não Conformidades"
            desc="Registro, acompanhamento e encerramento de NCs. Plano de ação, custos e evidências fotográficas."
            to="/rti"
          />
          <ModuleCard
            icon={<Users className="h-5 w-5" />}
            title="Qualificações NR-10"
            desc="Treinamentos, autorizações, ASOs e carteirinhas dos colaboradores habilitados."
            to="/qualificacoes"
          />
          <ModuleCard
            icon={<Smartphone className="h-5 w-5" />}
            title="Inspeções de Campo"
            desc="App offline para inspeções em campo. Sincronização automática ao retornar à rede."
            to="/campo"
          />
          <ModuleCard
            icon={<Lock className="h-5 w-5" />}
            title="Cadeados LOTO"
            desc="Controle de dispositivos de bloqueio com auditoria imutável de cada movimentação."
            to="/cadeados"
          />
          <ModuleCard
            icon={<Zap className="h-5 w-5" />}
            title="EPIs Dielétricos"
            desc="Gestão de luvas, detectores e equipamentos dielétricos com rastreio de testes."
            to="/epis"
          />
          <ModuleCard
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Vencimentos"
            desc="Alertas de vencimento de qualificações, EPIs e documentos regulatórios."
            to="/vencimentos"
          />
        </div>
      </section>

      {/* Administração */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Administração
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            icon={<BarChart3 className="h-5 w-5" />}
            title="Relatórios"
            desc="Dossiês, relatórios de conformidade e exportações para auditorias externas."
            to="/relatorio"
            muted
          />
          <ModuleCard
            icon={<Settings className="h-5 w-5" />}
            title="Administração"
            desc="Usuários, empresas, carga de dados e auditoria do sistema."
            to="/admin/usuarios"
            muted
          />
        </div>
      </section>
    </PageShell>
  );
}

function ModuleCard({
  icon,
  title,
  desc,
  to,
  muted = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  to: string;
  muted?: boolean;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="h-full transition-shadow hover:shadow-card-soft">
        <CardContent className="p-6">
          <div
            className={`grid h-10 w-10 place-items-center rounded-xl text-white shadow-brand ${
              muted
                ? "bg-secondary text-foreground shadow-none"
                : "bg-gradient-to-br from-[#34D399] to-[#059669]"
            }`}
          >
            {icon}
          </div>
          <h3 className="mt-4 font-semibold text-foreground group-hover:text-[#059669] transition-colors">
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
