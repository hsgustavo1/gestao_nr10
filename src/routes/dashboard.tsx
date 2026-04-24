import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDateTime, PADLOCK_COLORS, colorLabel, colorSwatch,
  type Padlock, type PadlockEvent,
} from "@/lib/padlocks";

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

  const byColor = PADLOCK_COLORS.map((c) => ({
    color: c, count: padlocks.filter((p) => p.color === c).length,
  }));

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

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-foreground"><Lock className="h-5 w-5" /></div>
            </div>
            <div className="mt-3 text-3xl font-bold tabular-nums">{padlocks.length}</div>
          </CardContent>
        </Card>
        {byColor.map(({ color, count }) => (
          <Card key={color}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{colorLabel[color]}</div>
                <div className={`h-7 w-7 rounded-full border-2 ${colorSwatch[color]}`} />
              </div>
              <div className="mt-3 text-3xl font-bold tabular-nums">{count}</div>
            </CardContent>
          </Card>
        ))}
      </section>

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
    </PageShell>
  );
}

function eventDot(action: string) {
  switch (action) {
    case "transferred": return "bg-violet-500";
    case "updated": return "bg-amber-500";
    case "deleted": return "bg-red-500";
    case "created": return "bg-sky-500";
    default: return "bg-muted-foreground";
  }
}
function actionLabel(action: string) {
  return ({
    created: "criado", updated: "editado", deleted: "excluído",
    transferred: "dono transferido", applied: "aplicado", released: "removido",
  } as Record<string, string>)[action] ?? action;
}