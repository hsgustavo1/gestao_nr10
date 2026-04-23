import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, ShieldCheck, History, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { deriveStatus } from "@/lib/padlocks";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "LOTO Atvos — Controle de Cadeados" },
      { name: "description", content: "Plataforma de Lockout/Tagout da Atvos. Veja status de cadeados, histórico e bloqueios ativos em tempo real." },
    ],
  }),
});

function HomePage() {
  const [counts, setCounts] = useState({ total: 0, aplicado: 0, vencido: 0, disponivel: 0 });

  useEffect(() => {
    supabase
      .from("padlocks")
      .select("status,due_at")
      .then(({ data }) => {
        const list = data ?? [];
        const c = { total: list.length, aplicado: 0, vencido: 0, disponivel: 0 };
        list.forEach((p) => {
          const s = deriveStatus(p);
          c[s] += 1;
        });
        setCounts(c);
      });
  }, []);

  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-brand-blue text-white shadow-card-soft">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-brand-gradient" />
        <div className="grid gap-8 p-8 md:p-12 md:grid-cols-[1.5fr_1fr] items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" /> Lockout / Tagout
            </span>
            <h1 className="mt-4 text-4xl md:text-5xl font-bold leading-tight">
              Controle de cadeados <span className="text-brand-gradient">LOTO Atvos</span>
            </h1>
            <p className="mt-4 max-w-xl text-white/80 text-base">
              Registro único por cadeado, auditoria imutável de cada aplicação e remoção, e visibilidade em
              tempo real para todo o time. Visualização aberta — operação com login.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
                <Link to="/dashboard">Ver dashboard <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white">
                <Link to="/cadeados">Lista de cadeados</Link>
              </Button>
            </div>
          </div>
          <div className="relative grid place-items-center">
            <div className="relative grid h-44 w-44 place-items-center rounded-3xl bg-brand-gradient shadow-brand">
              <Lock className="h-20 w-20 text-white" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total" value={counts.total} icon={<Lock className="h-5 w-5" />} tone="neutral" />
        <Kpi label="Aplicados" value={counts.aplicado} icon={<ShieldCheck className="h-5 w-5" />} tone="warning" />
        <Kpi label="Vencidos" value={counts.vencido} icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
        <Kpi label="Disponíveis" value={counts.disponivel} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </section>

      {/* Features */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <Feature
          icon={<History className="h-5 w-5" />}
          title="Auditoria completa"
          desc="Cada aplicação, remoção e edição é registrada com autor e data — histórico imutável por cadeado."
        />
        <Feature
          icon={<ShieldCheck className="h-5 w-5" />}
          title="3 níveis de acesso"
          desc="Visualizador (público), Supervisor (cria e aplica), Admin/Dono de RAC (controle total)."
        />
        <Feature
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Vencimento automático"
          desc="Cadeados aplicados além do prazo previsto ganham destaque vermelho no dashboard."
        />
      </section>
    </PageShell>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "neutral" | "warning" | "danger" | "success";
}) {
  const toneMap = {
    neutral: "text-foreground",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
    success: "text-emerald-600 dark:text-emerald-400",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`grid h-9 w-9 place-items-center rounded-lg bg-secondary ${toneMap[tone]}`}>
            {icon}
          </div>
        </div>
        <div className={`mt-3 text-3xl font-bold tabular-nums ${toneMap[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
          {icon}
        </div>
        <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}