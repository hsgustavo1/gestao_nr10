import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Lock, ShieldCheck, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { deriveStatus, formatDateTime, statusColor, statusLabel, type Padlock, type PadlockEvent } from "@/lib/padlocks";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — LOTO Atvos" }] }),
});

function DashboardPage() {
  const [padlocks, setPadlocks] = useState<Padlock[]>([]);
  const [events, setEvents] = useState<PadlockEvent[]>([]);

  useEffect(() => {
    supabase.from("padlocks").select("*").order("updated_at", { ascending: false }).then(({ data }) => setPadlocks(data ?? []));
    supabase.from("padlock_events").select("*").order("created_at", { ascending: false }).limit(10).then(({ data }) => setEvents(data ?? []));
  }, []);

  const counts = padlocks.reduce(
    (acc, p) => {
      const s = deriveStatus(p);
      acc[s] += 1;
      return acc;
    },
    { disponivel: 0, aplicado: 0, vencido: 0 } as Record<string, number>,
  );

  const overdue = padlocks.filter((p) => deriveStatus(p) === "vencido");

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral dos cadeados e últimos eventos.</p>
        </div>
        <Link to="/cadeados" className="text-sm font-medium text-accent hover:underline inline-flex items-center gap-1">
          Ver todos os cadeados <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total" value={padlocks.length} icon={<Lock className="h-5 w-5" />} />
        <Kpi label="Aplicados" value={counts.aplicado} icon={<ShieldCheck className="h-5 w-5" />} tone="warning" />
        <Kpi label="Vencidos" value={counts.vencido} icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
        <Kpi label="Disponíveis" value={counts.disponivel} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </section>

      {overdue.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Cadeados vencidos
          </h2>
          <Card className="border-red-500/40">
            <CardContent className="p-0 divide-y divide-border">
              {overdue.map((p) => (
                <Link
                  key={p.id}
                  to="/cadeados/$codigo"
                  params={{ codigo: p.code }}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-secondary/50 transition"
                >
                  <div>
                    <div className="font-mono text-sm font-bold">{p.code}</div>
                    <div className="text-xs text-muted-foreground">{p.location || "Sem localização"} · prazo {formatDateTime(p.due_at)}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{p.applied_by_name}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Últimos eventos</h2>
        <Card>
          <CardContent className="p-0">
            {events.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum evento registrado.</div>
            ) : (
              <ul className="divide-y divide-border">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 p-4">
                    <div className={`mt-1 h-2 w-2 rounded-full ${eventDot(e.action)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to="/cadeados/$codigo" params={{ codigo: e.padlock_code }} className="font-mono text-sm font-semibold hover:underline">
                          {e.padlock_code}
                        </Link>
                        <span className="text-xs text-muted-foreground">{actionLabel(e.action)}</span>
                        {e.actor_name && <span className="text-xs text-muted-foreground">· {e.actor_name}</span>}
                      </div>
                      {e.notes && <div className="text-xs text-muted-foreground mt-0.5 truncate">{e.notes}</div>}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* legend */}
      <div className="mt-4 flex gap-2 flex-wrap">
        {(["disponivel", "aplicado", "vencido"] as const).map((s) => (
          <span key={s} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor[s]}`}>
            {statusLabel[s]}
          </span>
        ))}
      </div>
    </PageShell>
  );
}

function eventDot(action: string) {
  switch (action) {
    case "applied":
      return "bg-amber-500";
    case "released":
      return "bg-emerald-500";
    case "deleted":
      return "bg-red-500";
    case "created":
      return "bg-sky-500";
    default:
      return "bg-muted-foreground";
  }
}
function actionLabel(action: string) {
  return ({ created: "criado", updated: "editado", deleted: "excluído", applied: "aplicado", released: "removido" } as Record<string, string>)[action] ?? action;
}

function Kpi({ label, value, icon, tone = "neutral" }: { label: string; value: number; icon: React.ReactNode; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const toneMap = {
    neutral: "text-foreground",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
    success: "text-emerald-600 dark:text-emerald-400",
  } as const;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`grid h-9 w-9 place-items-center rounded-lg bg-secondary ${toneMap[tone]}`}>{icon}</div>
        </div>
        <div className={`mt-3 text-3xl font-bold tabular-nums ${toneMap[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}