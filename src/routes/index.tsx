import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, ShieldCheck, History, ArrowRight, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { PADLOCK_COLORS, colorLabel, colorSwatch, type PadlockColor } from "@/lib/padlocks";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "RAC - Bloqueio de energias perigosas" },
      { name: "description", content: "Bloqueio de energias perigosas: controle de dispositivos, auditoria e monitoramento de bloqueios." },
    ],
  }),
});

function HomePage() {
  const [counts, setCounts] = useState<{ total: number; byColor: Record<PadlockColor, number> }>({
    total: 0,
    byColor: { azul: 0, amarelo: 0, latao: 0, vermelho: 0 },
  });

  useEffect(() => {
    supabase
      .from("padlocks")
      .select("color")
      .then(({ data }) => {
        const list = data ?? [];
        const byColor: Record<PadlockColor, number> = { azul: 0, amarelo: 0, latao: 0, vermelho: 0 };
        list.forEach((p) => { byColor[p.color] += 1; });
        setCounts({ total: list.length, byColor });
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
              <ShieldCheck className="h-3.5 w-3.5" /> Bloqueio de energias perigosas
            </span>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold leading-tight">
              Controle de dispositivos <span className="text-brand-gradient">Requisitos para Atividades Críticas</span>
            </h1>
            <p className="mt-4 max-w-xl text-white/80 text-base whitespace-pre-line">
              Registro único por dispositivo, auditoria imutável de cada transferência e baixa, além visibilidade em tempo real para todo o time.
              {"\n"}Consulta aberta / Operação com login restrito ao Dono de RAC e Apoios.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
                <Link to="/dashboard">Ver dashboard <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white">
                <Link to="/cadeados">Base de dados</Link>
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
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total" value={counts.total} icon={<Lock className="h-5 w-5" />} />
        {PADLOCK_COLORS.map((c) => (
          <Kpi key={c} label={colorLabel[c]} value={counts.byColor[c]} swatch={c} />
        ))}
      </section>

      {/* Features */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <Feature
          icon={<History className="h-5 w-5" />}
          title="Linha do tempo"
          desc="Cada registro, transferência ou baixa de dispositivo fica registrado com responsável, data e observações — auditoria imutável por item."
        />
        <Feature
          icon={<ShieldCheck className="h-5 w-5" />}
          title="3 níveis de acesso"
          desc="Consulta e impressão de etiquetas (público), Apoios (cadastra e transfere), Dono de RAC (controle total)."
        />
        <Feature
          icon={<Users className="h-5 w-5" />}
          title="Regras por cor"
          desc="Pessoal e Equipamento: 1 por matrícula. Equipamento livre. Empréstimo: só número e unidade. Sem repetição na mesma cor."
        />
      </section>
    </PageShell>
  );
}

function Kpi({ label, value, icon, swatch }: { label: string; value: number; icon?: React.ReactNode; swatch?: PadlockColor }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          {swatch ? (
            <div className={`h-7 w-7 rounded-full border-2 ${colorSwatch[swatch]}`} />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-foreground">{icon}</div>
          )}
        </div>
        <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">{value}</div>
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