import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock, ArrowRight, CheckCircle2, XCircle, Plus, ShieldAlert } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { NewPadlockDialog } from "@/components/new-padlock-dialog";
import { useDashboardData, useQueryClient } from "@/lib/queries";
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
  const queryClient = useQueryClient();
  const { padlocks, events, violations, isLoading } = useDashboardData();
  const [openNew, setOpenNew] = useState(false);

  const ativos = padlocks.filter((p) => !p.cancelled);
  const cancelados = padlocks.filter((p) => p.cancelled);

  const violationsByReason = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of violations) {
      const k = (v.reason ?? "").toUpperCase().trim() || "OUTRO";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([reason, count]) => ({ reason, count }));
  }, [violations]);

  const byColor = PADLOCK_COLORS.map((c) => ({
    color: c, count: ativos.filter((p) => p.color === c).length,
  }));

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
          <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Visão geral do bloqueio de energias perigosas.
          </p>
        </div>
        {isStaff && (
          <Button onClick={() => setOpenNew(true)} className="bg-brand-gradient text-white shadow-brand hover:opacity-95 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Novo Dispositivo
          </Button>
        )}
      </div>

      {/* Stats principais */}
      <section className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl col-span-2 sm:col-span-1" />
          </>
        ) : (
          <>
            <StatCard label="Total" value={padlocks.length} accent="bg-[#0D3A5C]" icon={<Lock className="h-5 w-5" />} to="/cadeados" search={{ status: "all" }} />
            <StatCard label="Em uso" value={ativos.length} accent="bg-[#0F7A47]" icon={<CheckCircle2 className="h-5 w-5" />} to="/cadeados" search={{ status: "ativos" }} />
            <StatCard label="Baixados" value={cancelados.length} accent="bg-[#B8281A]" icon={<XCircle className="h-5 w-5" />} to="/cadeados" search={{ status: "cancelados" }} />
          </>
        )}
      </section>

      {/* Stats por cor */}
      <section className="mt-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          byColor.map(({ color, count }) => (
            <Link key={color} to="/cadeados" search={{ color, status: "ativos" }} className="block">
              <Card className="overflow-hidden hover:shadow-md transition cursor-pointer">
                <div className={`h-1 ${colorAccent[color]}`} />
                <CardContent className="p-5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{colorLabel[color]}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold tabular-nums">{count}</span>
                    <span className="text-xs text-muted-foreground">em uso</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </section>

      {/* Violações de dispositivos */}
      <section className="mt-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                Violações de dispositivos
              </h2>
              <Link to="/violacoes" className="text-xs font-medium text-accent hover:underline inline-flex items-center gap-1">
                Ver todas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {isLoading ? (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <div className="rounded-lg border bg-secondary/30 p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Total de violações</div>
                  <div className="mt-2 text-3xl font-bold tabular-nums">{violations.length}</div>
                </div>
                {["EXTRAVIO DA CHAVE", "INTEGRANTE AUSENTE"].map((reason) => {
                  const count = violationsByReason.find((v) => v.reason === reason)?.count ?? 0;
                  return (
                    <div key={reason} className="rounded-lg border bg-secondary/30 p-4">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">{reason}</div>
                      <div className="mt-2 text-3xl font-bold tabular-nums">{count}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Distribuição por setor + Linha do tempo */}
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
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : sectors.length === 0 ? (
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
                          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #F79220, #E35D12)" }}
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
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            ) : events.length === 0 ? (
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

      <NewPadlockDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["padlocks"] })}
      />
    </PageShell>
  );
}

function StatCard({ label, value, accent, icon, to, search }: { label: string; value: number; accent: string; icon: React.ReactNode; to?: string; search?: Record<string, string> }) {
  const card = (
    <Card className={`overflow-hidden ${to ? "hover:shadow-md transition cursor-pointer" : ""}`}>
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
  if (to) {
    return <Link to={to} search={search} className="block">{card}</Link>;
  }
  return card;
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
    created: "criado", updated: "editado", deleted: "cancelado",
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
