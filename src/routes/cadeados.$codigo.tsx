import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Lock, LockOpen, Pencil, Trash2, History } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deriveStatus, formatDateTime, logEvent, statusColor, statusLabel, type Padlock, type PadlockEvent } from "@/lib/padlocks";

export const Route = createFileRoute("/cadeados/$codigo")({
  component: PadlockDetail,
  head: ({ params }) => ({ meta: [{ title: `Cadeado ${params.codigo} — LOTO Atvos` }] }),
});

function PadlockDetail() {
  const { codigo } = Route.useParams();
  const navigate = useNavigate();
  const { user, isStaff, isAdmin } = useAuth();
  const [padlock, setPadlock] = useState<Padlock | null>(null);
  const [events, setEvents] = useState<PadlockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [openApply, setOpenApply] = useState(false);
  const [openRelease, setOpenRelease] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  async function reload() {
    const { data: p } = await supabase.from("padlocks").select("*").eq("code", codigo).maybeSingle();
    setPadlock(p);
    if (p) {
      const { data: ev } = await supabase
        .from("padlock_events")
        .select("*")
        .eq("padlock_id", p.id)
        .order("created_at", { ascending: false });
      setEvents(ev ?? []);
    }
    setLoading(false);
  }
  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [codigo]);

  if (loading) return <PageShell><div className="text-sm text-muted-foreground">Carregando...</div></PageShell>;
  if (!padlock) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <h1 className="text-xl font-bold">Cadeado não encontrado</h1>
          <p className="text-sm text-muted-foreground mt-2">Código: {codigo}</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/cadeados"><ArrowLeft className="h-4 w-4" /> Voltar à lista</Link></Button>
        </div>
      </PageShell>
    );
  }

  const status = deriveStatus(padlock);

  return (
    <PageShell>
      <Link to="/cadeados" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mt-3 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient shadow-brand">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Cadeado</div>
            <h1 className="font-mono text-2xl font-bold">{padlock.code}</h1>
            <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor[status]}`}>
              {statusLabel[status]}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isStaff && status === "disponivel" && (
            <Button onClick={() => setOpenApply(true)} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
              <Lock className="h-4 w-4" /> Aplicar
            </Button>
          )}
          {isStaff && status !== "disponivel" && (
            <Button onClick={() => setOpenRelease(true)} variant="outline">
              <LockOpen className="h-4 w-4" /> Remover
            </Button>
          )}
          {isAdmin && (
            <>
              <Button onClick={() => setOpenEdit(true)} variant="ghost"><Pencil className="h-4 w-4" /> Editar</Button>
              <Button onClick={() => setOpenDelete(true)} variant="ghost" className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /> Excluir</Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-5 space-y-3">
          <Field label="Localização / equipamento" value={padlock.location} />
          <Field label="Responsável atual" value={padlock.applied_by_name} />
          <Field label="Aplicado em" value={formatDateTime(padlock.applied_at)} />
          <Field label="Prazo previsto" value={formatDateTime(padlock.due_at)} highlight={status === "vencido"} />
        </CardContent></Card>
        <Card><CardContent className="p-5 space-y-3">
          <Field label="Motivo do bloqueio" value={padlock.reason} />
          <Field label="Observações" value={padlock.notes} multiline />
          <Field label="Criado em" value={formatDateTime(padlock.created_at)} />
        </CardContent></Card>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico de auditoria
        </h2>
        <Card><CardContent className="p-0">
          {events.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Sem eventos.</div>
          ) : (
            <ol className="relative divide-y divide-border">
              {events.map((e) => (
                <li key={e.id} className="flex gap-4 p-4">
                  <div className="flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full ${eventDot(e.action)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold capitalize">{actionLabel(e.action)}</span>
                      {e.actor_name && <span className="text-xs text-muted-foreground">por {e.actor_name}</span>}
                    </div>
                    {e.notes && <div className="text-xs text-muted-foreground mt-1">{e.notes}</div>}
                    <div className="text-xs text-muted-foreground mt-1">{formatDateTime(e.created_at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent></Card>
      </section>

      <ApplyDialog open={openApply} onOpenChange={setOpenApply} padlock={padlock} onDone={reload} />
      <ReleaseDialog open={openRelease} onOpenChange={setOpenRelease} padlock={padlock} onDone={reload} />
      <EditDialog open={openEdit} onOpenChange={setOpenEdit} padlock={padlock} onDone={reload} />
      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cadeado {padlock.code}?</AlertDialogTitle>
            <AlertDialogDescription>O registro será removido. O histórico de auditoria também será apagado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await logEvent({
                  padlock_id: padlock.id,
                  padlock_code: padlock.code,
                  action: "deleted",
                  actor_id: user?.id ?? null,
                  actor_name: user?.email ?? null,
                  previous_data: padlock,
                });
                const { error } = await supabase.from("padlocks").delete().eq("id", padlock.id);
                if (error) return toast.error(error.message);
                toast.success("Cadeado excluído");
                navigate({ to: "/cadeados" });
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function Field({ label, value, multiline, highlight }: { label: string; value: string | null | undefined; multiline?: boolean; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm ${multiline ? "whitespace-pre-wrap" : ""} ${highlight ? "text-red-600 dark:text-red-400 font-semibold" : "text-foreground"}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function eventDot(action: string) {
  switch (action) {
    case "applied": return "bg-amber-500";
    case "released": return "bg-emerald-500";
    case "deleted": return "bg-red-500";
    case "created": return "bg-sky-500";
    default: return "bg-muted-foreground";
  }
}
function actionLabel(action: string) {
  return ({ created: "Criado", updated: "Editado", deleted: "Excluído", applied: "Aplicado", released: "Removido" } as Record<string, string>)[action] ?? action;
}

/* ============== Apply ============== */
const applySchema = z.object({
  reason: z.string().trim().min(1, "Informe o motivo").max(300),
  location: z.string().trim().min(1, "Informe a localização").max(200),
  due_at: z.string().min(1, "Informe o prazo"),
});

function ApplyDialog({ open, onOpenChange, padlock, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; padlock: Padlock; onDone: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState(padlock.location ?? "");
  const [due, setDue] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = applySchema.safeParse({ reason, location, due_at: due });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const dueIso = new Date(parsed.data.due_at).toISOString();
    const { data, error } = await supabase
      .from("padlocks")
      .update({
        status: "aplicado",
        reason: parsed.data.reason,
        location: parsed.data.location,
        due_at: dueIso,
        applied_at: new Date().toISOString(),
        applied_by: user?.id ?? null,
        applied_by_name: user?.email ?? null,
      })
      .eq("id", padlock.id)
      .select()
      .single();
    if (error || !data) { setLoading(false); return toast.error(error?.message ?? "Erro"); }
    await logEvent({
      padlock_id: padlock.id, padlock_code: padlock.code, action: "applied",
      actor_id: user?.id ?? null, actor_name: user?.email ?? null,
      previous_data: padlock, new_data: data, notes: parsed.data.reason,
    });
    toast.success("Cadeado aplicado");
    setLoading(false); onOpenChange(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar cadeado {padlock.code}</DialogTitle>
          <DialogDescription>Registre motivo, localização e prazo previsto de liberação.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label>Motivo</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required /></div>
          <div className="space-y-1.5"><Label>Localização / equipamento</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} required /></div>
          <div className="space-y-1.5"><Label>Prazo previsto</Label><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">{loading ? "..." : "Aplicar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============== Release ============== */
function ReleaseDialog({ open, onOpenChange, padlock, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; padlock: Padlock; onDone: () => void }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase
      .from("padlocks")
      .update({
        status: "disponivel", reason: null, applied_at: null, applied_by: null,
        applied_by_name: null, due_at: null,
      })
      .eq("id", padlock.id).select().single();
    if (error || !data) { setLoading(false); return toast.error(error?.message ?? "Erro"); }
    await logEvent({
      padlock_id: padlock.id, padlock_code: padlock.code, action: "released",
      actor_id: user?.id ?? null, actor_name: user?.email ?? null,
      previous_data: padlock, new_data: data, notes: notes || undefined,
    });
    toast.success("Cadeado liberado");
    setLoading(false); onOpenChange(false); onDone();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Remover cadeado {padlock.code}</DialogTitle><DialogDescription>O cadeado voltará ao status "Disponível".</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label>Observações (opcional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "..." : "Remover"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============== Edit (admin only) ============== */
function EditDialog({ open, onOpenChange, padlock, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; padlock: Padlock; onDone: () => void }) {
  const { user } = useAuth();
  const [code, setCode] = useState(padlock.code);
  const [location, setLocation] = useState(padlock.location ?? "");
  const [notes, setNotes] = useState(padlock.notes ?? "");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase
      .from("padlocks")
      .update({ code: code.trim(), location: location || null, notes: notes || null })
      .eq("id", padlock.id).select().single();
    if (error || !data) { setLoading(false); return toast.error(error?.message ?? "Erro"); }
    await logEvent({
      padlock_id: padlock.id, padlock_code: data.code, action: "updated",
      actor_id: user?.id ?? null, actor_name: user?.email ?? null,
      previous_data: padlock, new_data: data,
    });
    toast.success("Cadeado atualizado");
    setLoading(false); onOpenChange(false); onDone();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar cadeado</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label>Código</Label><Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={60} required /></div>
          <div className="space-y-1.5"><Label>Localização</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} /></div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">{loading ? "..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}