import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Lock, ArrowRight, CheckCircle2, XCircle, Plus } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { NewPadlockDialog } from "@/components/new-padlock-dialog";
import {
  formatDateTime, PADLOCK_COLORS, colorLabel, colorAccent,
  type Padlock, type PadlockEvent,
} from "@/lib/padlocks";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — Bloqueio de energias perigosas" },
      { name: "description", content: "Monitoramento de bloqueio: dispositivos em uso, distribuição por unidade e linha do tempo." },
      { property: "og:title", content: "Dashboard — Bloqueio de energias perigosas" },
      { property: "og:description", content: "Visão consolidada dos dispositivos com em uso, baixados e atividade recente." },
    ],
  }),
});

function DashboardPage() {
  const { isStaff } = useAuth();
  const [padlocks, setPadlocks] = useState<Padlock[]>([]);
  const [events, setEvents] = useState<PadlockEvent[]>([]);
  const [openNew, setOpenNew] = useState(false);

  const reload = () => {
    supabase.from("padlocks").select("*").order("updated_at", { ascending: false })
      .then(({ data }) => setPadlocks(data ?? []));
    supabase.from("padlock_events").select("*").order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setEvents(data ?? []));
  };
  useEffect(reload, []);

  const ativos = padlocks.filter((p) => !p.cancelled);
  const cancelados = padlocks.filter((p) => p.cancelled);

  const byColor = PADLOCK_COLORS.map((c) => ({
    color: c, count: ativos.filter((p) => p.color === c).length,
  }));

  // Distribuição por setor (somente cadeados ativos)
  const sectors = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of ativos) {
      const s = (p.owner_sector ?? "").trim() || "Sem setor";
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    const arr = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }, [ativos]);
  const sectorMax = sectors[0]?.count ?? 1;

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do bloqueio de energias perigosas.
          </p>
        </div>
        {isStaff && (
          <Button onClick={() => setOpenNew(true)} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
            <Plus className="h-4 w-4" /> Novo Dispositivo
          </Button>
        )}
      </div>

      {/* Stats principais */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={padlocks.length} accent="bg-[#0D3A5C]" icon={<Lock className="h-5 w-5" />} />
        <StatCard label="Em uso" value={ativos.length} accent="bg-[#0F7A47]" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Baixados" value={cancelados.length} accent="bg-[#B8281A]" icon={<XCircle className="h-5 w-5" />} />
      </section>

      {/* Stats por cor */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {byColor.map(({ color, count }) => (
          <Card key={color} className="overflow-hidden">
            <div className={`h-1 ${colorAccent[color]}`} />
            <CardContent className="p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{colorLabel[color]}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">{count}</span>
                <span className="text-xs text-muted-foreground">em uso</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Distribuição por setor */}
      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                DISTRIBUIÇÃO POR SETOR
              </h2>
              <Link to="/cadeados" className="text-xs font-medium text-accent hover:underline inline-flex items-center gap-1">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {sectors.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma unidade com dispositivos em uso.</div>
            ) : (
              <ul className="space-y-3">
                {sectors.map((s) => {
                  const pct = Math.max(6, Math.round((s.count / sectorMax) * 100));
                  return (
                    <li key={s.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium truncate">{s.name}</span>
                        <span className="tabular-nums text-muted-foreground">{s.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: "linear-gradient(90deg, #F79220, #E35D12)",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Últimos eventos */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Linha do tempo
            </h2>
            {events.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum evento.</div>
            ) : (
              <ul className="divide-y divide-border -mx-2">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-2 py-3">
                    <div className={`mt-1.5 h-2 w-2 rounded-full ${eventDot(e.action)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to="/cadeados/$codigo" params={{ codigo: e.padlock_code }} className="font-mono text-xs font-semibold hover:underline">
                          {e.padlock_code}
                        </Link>
                        <span className="text-xs text-muted-foreground">{actionLabel(e.action)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDateTime(e.created_at)}
                        {e.actor_name && <> · {e.actor_name}</>}
                        {ownerNameFor(e, padlocks) && <> · Dono: {ownerNameFor(e, padlocks)}</>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <NewPadlockDialog open={openNew} onOpenChange={setOpenNew} onCreated={reload} />
    </PageShell>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${accent}`} />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-foreground">{icon}</div>
        </div>
        <div className="mt-3 text-3xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
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

function ownerNameFor(e: PadlockEvent, padlocks: Padlock[]): string | null {
  const fromNew = (e.new_data as { owner_name?: string } | null)?.owner_name;
  const fromPrev = (e.previous_data as { owner_name?: string } | null)?.owner_name;
  const fromPadlock = padlocks.find((p) => p.id === e.padlock_id)?.owner_name;
  const name = fromNew ?? fromPadlock ?? fromPrev ?? null;
  return name && name.trim().length > 0 ? name : null;
}