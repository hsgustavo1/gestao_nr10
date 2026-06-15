import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Check, X, Clock, ArrowLeft, History } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/padlocks";

type ReportStatus = "aguardando" | "solucionado" | "recusado";

type Report = {
  id: string;
  padlock_id: string;
  padlock_code: string;
  reporter_name: string | null;
  reporter_contact: string | null;
  message: string;
  status: ReportStatus;
  resolution_note: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
};

type ReportEvent = {
  id: string;
  report_id: string;
  action: string;
  actor_name: string | null;
  notes: string | null;
  created_at: string;
};

export const Route = createFileRoute("/admin/reports")({
  component: AdminReportsPage,
  head: () => ({ meta: [{ title: "Inconsistências — Bloqueio de energias perigosas" }] }),
});

function AdminReportsPage() {
  const { isAdmin, loading, user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [events, setEvents] = useState<Record<string, ReportEvent[]>>({});
  const [filter, setFilter] = useState<ReportStatus | "all">("aguardando");
  const [acting, setActing] = useState<{ report: Report; resolution: ReportStatus } | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Report | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const { data } = await supabase
      .from("padlock_reports")
      .select("*")
      .order("created_at", { ascending: false });
    setReports((data ?? []) as Report[]);

    const { data: ev } = await supabase
      .from("padlock_report_events")
      .select("*")
      .order("created_at", { ascending: false });
    const map: Record<string, ReportEvent[]> = {};
    (ev ?? []).forEach((e) => {
      const arr = map[e.report_id] ?? [];
      arr.push(e as ReportEvent);
      map[e.report_id] = arr;
    });
    setEvents(map);
  }

  useEffect(() => {
    if (isAdmin) void reload();
  }, [isAdmin]);

  const filtered = useMemo(
    () => reports.filter((r) => filter === "all" || r.status === filter),
    [reports, filter],
  );

  const counts = useMemo(() => {
    return {
      aguardando: reports.filter((r) => r.status === "aguardando").length,
      solucionado: reports.filter((r) => r.status === "solucionado").length,
      recusado: reports.filter((r) => r.status === "recusado").length,
    };
  }, [reports]);

  if (loading)
    return (
      <PageShell>
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </PageShell>
    );
  if (!isAdmin) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Apenas o Dono de RAC pode acessar esta área.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/cadeados">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const submitResolution = async () => {
    if (!acting) return;
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      toast.error("A justificativa precisa ter pelo menos 5 caracteres.");
      return;
    }
    setBusy(true);
    const actorName =
      (user?.user_metadata?.display_name as string | undefined) ||
      user?.email?.split("@")[0] ||
      "Admin";
    const { error } = await supabase
      .from("padlock_reports")
      .update({
        status: acting.resolution,
        resolution_note: trimmed,
        resolved_by: user?.id ?? null,
        resolved_by_name: actorName,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", acting.report.id);
    if (error) {
      setBusy(false);
      toast.error("Erro ao atualizar report.");
      return;
    }
    await supabase.from("padlock_report_events").insert({
      report_id: acting.report.id,
      padlock_id: acting.report.padlock_id,
      padlock_code: acting.report.padlock_code,
      action: acting.resolution,
      actor_id: user?.id ?? null,
      actor_name: actorName,
      notes: trimmed,
    });
    setBusy(false);
    toast.success(
      acting.resolution === "solucionado" ? "Report marcado como solucionado." : "Report recusado.",
    );
    setActing(null);
    setNote("");
    void reload();
  };

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            Inconsistências
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {counts.aguardando} aguardando · {counts.solucionado} solucionados · {counts.recusado}{" "}
            recusados
          </p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as ReportStatus | "all")}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aguardando">Aguardando tratativa</SelectItem>
            <SelectItem value="solucionado">Solucionados</SelectItem>
            <SelectItem value="recusado">Recusados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5 grid gap-3">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum report nesta categoria.
            </CardContent>
          </Card>
        )}
        {filtered.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={r.status} />
                    <Link
                      to="/cadeados/$codigo"
                      params={{ codigo: r.padlock_code }}
                      className="font-mono text-sm font-semibold hover:underline"
                    >
                      {r.padlock_code}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(r.created_at)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Reportado por{" "}
                    <strong className="text-foreground">{r.reporter_name || "Anônimo"}</strong>
                    {r.reporter_contact && <> · {r.reporter_contact}</>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(r)}>
                    <History className="h-4 w-4" /> Histórico
                  </Button>
                  {r.status === "aguardando" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setActing({ report: r, resolution: "solucionado" });
                          setNote("");
                        }}
                        className="bg-[#0F7A47] text-white hover:bg-[#0F7A47]/90"
                      >
                        <Check className="h-4 w-4" /> Solucionar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActing({ report: r, resolution: "recusado" });
                          setNote("");
                        }}
                        className="text-destructive border-destructive/40 hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" /> Recusar
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {r.message}
              </div>
              {r.status !== "aguardando" && r.resolution_note && (
                <div className="rounded-md border-l-4 border-l-primary/60 bg-muted/20 p-3 text-xs">
                  <div className="font-semibold mb-1">
                    Justificativa ({r.status === "solucionado" ? "solucionado" : "recusado"}) —{" "}
                    {r.resolved_by_name}
                    {r.resolved_at && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {formatDateTime(r.resolved_at)}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap">{r.resolution_note}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Diálogo: solucionar / recusar */}
      <Dialog
        open={!!acting}
        onOpenChange={(o) => {
          if (!o) {
            setActing(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acting?.resolution === "solucionado" ? "Marcar como solucionado" : "Recusar report"}
            </DialogTitle>
            <DialogDescription>
              Uma justificativa é obrigatória e ficará registrada no histórico.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Descreva a tratativa dada ao report..."
            />
            <div className="text-[11px] text-muted-foreground mt-1">{note.length}/1000</div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActing(null);
                setNote("");
              }}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              onClick={submitResolution}
              disabled={busy}
              className="bg-brand-gradient text-white shadow-brand"
            >
              {busy ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: histórico */}
      <Dialog
        open={!!historyOpen}
        onOpenChange={(o) => {
          if (!o) setHistoryOpen(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico do report</DialogTitle>
            <DialogDescription>{historyOpen?.padlock_code}</DialogDescription>
          </DialogHeader>
          <ol className="relative divide-y divide-border max-h-[60vh] overflow-y-auto">
            {(events[historyOpen?.id ?? ""] ?? []).map((e) => (
              <li key={e.id} className="flex gap-3 py-3">
                <div className="pt-1">
                  <ActionDot action={e.action} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{actionLabel(e.action)}</div>
                  {e.actor_name && (
                    <div className="text-xs text-muted-foreground">por {e.actor_name}</div>
                  )}
                  {e.notes && <div className="text-xs mt-1 whitespace-pre-wrap">{e.notes}</div>}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {formatDateTime(e.created_at)}
                  </div>
                </div>
              </li>
            ))}
            {(events[historyOpen?.id ?? ""] ?? []).length === 0 && (
              <li className="py-4 text-center text-sm text-muted-foreground">
                Sem eventos registrados.
              </li>
            )}
          </ol>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  if (status === "aguardando") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
        <Clock className="h-3 w-3" /> Aguardando tratativa
      </span>
    );
  }
  if (status === "solucionado") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#0F7A47]/40 bg-[#E0F2E9] px-2 py-0.5 text-[11px] font-medium text-[#0F7A47]">
        <Check className="h-3 w-3" /> Solucionado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
      <X className="h-3 w-3" /> Recusado
    </span>
  );
}

function ActionDot({ action }: { action: string }) {
  const cls =
    action === "solucionado"
      ? "bg-[#0F7A47]"
      : action === "recusado"
        ? "bg-destructive"
        : "bg-amber-500";
  return <div className={`h-2.5 w-2.5 rounded-full ${cls}`} />;
}

function actionLabel(a: string): string {
  if (a === "criado") return "Report criado";
  if (a === "solucionado") return "Marcado como solucionado";
  if (a === "recusado") return "Recusado";
  return a;
}
