import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Lock, Pencil, Trash2, History, ArrowLeftRight, XCircle, AlertTriangle, Printer, AlertCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { CancelPadlockDialog } from "@/components/cancel-padlock-dialog";
import { DeletePadlockDialog } from "@/components/delete-padlock-dialog";
import { PrintLabelDialog } from "@/components/print-label-dialog";
import { SectorSelect } from "@/components/sector-select";
import { ReportInconsistencyDialog } from "@/components/report-inconsistency-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePadlockDetail, useQueryClient } from "@/lib/queries";
import {
  formatDateTime, formatPhoneBR, logEvent, PADLOCK_COLORS,
  colorBadge, colorLabel, colorSwatch,
  type Padlock, type PadlockEvent, type PadlockColor,
} from "@/lib/padlocks";

export const Route = createFileRoute("/cadeados/$codigo")({
  component: PadlockDetail,
  head: ({ params }) => ({ meta: [{ title: `Dispositivo ${params.codigo} — Bloqueio de energias perigosas` }] }),
});

function PadlockDetail() {
  const { codigo } = Route.useParams();
  const navigate = useNavigate();
  const { user, isStaff, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = usePadlockDetail(codigo);

  const padlock = data?.padlock ?? null;
  const events = data?.events ?? [];

  const [openTransfer, setOpenTransfer] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openPrint, setOpenPrint] = useState(false);
  const [openReport, setOpenReport] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["padlock", codigo] });

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="flex items-start gap-4 mt-3">
          <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card><CardContent className="p-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
          </CardContent></Card>
          <Card><CardContent className="p-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
          </CardContent></Card>
        </div>
      </PageShell>
    );
  }

  if (!padlock) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <h1 className="text-xl font-bold">Dispositivo não encontrado</h1>
          <p className="text-sm text-muted-foreground mt-2">Código: {codigo}</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/cadeados"><ArrowLeft className="h-4 w-4" /> Voltar à lista</Link></Button>
        </div>
      </PageShell>
    );
  }

  const isRed = padlock.color === "vermelho";
  const isCancelled = padlock.cancelled;

  return (
    <PageShell>
      <Link to="/cadeados" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mt-3 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className={`grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl border-2 shadow-brand ${colorSwatch[padlock.color]}`}>
            <Lock className="h-6 w-6 sm:h-7 sm:w-7 text-white drop-shadow" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Dispositivo de Bloqueio</div>
            <h1 className="font-mono text-lg sm:text-2xl font-bold truncate">{colorLabel[padlock.color]} #{padlock.number}</h1>
            <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorBadge[padlock.color]}`}>
              {colorLabel[padlock.color]}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 sm:flex-wrap w-full sm:w-auto">
          {isStaff && !isRed && !isCancelled && (
            <Button onClick={() => setOpenTransfer(true)} className="bg-brand-gradient text-white shadow-brand hover:opacity-95 col-span-2">
              <ArrowLeftRight className="h-4 w-4" /> Transferir cadeado
            </Button>
          )}
          {!isCancelled && (
            <Button onClick={() => setOpenPrint(true)} variant="outline">
              <Printer className="h-4 w-4" /> Imprimir etiqueta
            </Button>
          )}
          <Button onClick={() => setOpenReport(true)} variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10">
            <AlertCircle className="h-4 w-4" /> Reportar inconsistência
          </Button>
          {isAdmin && !isCancelled && (
            <Button onClick={() => setOpenEdit(true)} variant="ghost"><Pencil className="h-4 w-4" /> Editar</Button>
          )}
          {isStaff && !isCancelled && (
            <Button onClick={() => setOpenCancel(true)} variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10">
              <XCircle className="h-4 w-4" /> Cancelar cadeado
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setOpenDelete(true)} variant="ghost" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Eliminar registro
            </Button>
          )}
        </div>
      </div>

      {isCancelled && (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-destructive">Dispositivo baixado</div>
            <div className="text-muted-foreground">
              Motivo: <strong className="text-foreground">{padlock.cancellation_reason ?? "—"}</strong>
              {padlock.cancellation_detail && <> — {padlock.cancellation_detail}</>}
            </div>
            <div className="text-xs text-muted-foreground">
              Cancelado em {formatDateTime(padlock.cancelled_at)}.
              O número está liberado para reuso em um novo cadastro.
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-5 space-y-3">
          <Field label="Setor / Empresa" value={padlock.owner_sector} />
          {!isRed && (
            <>
              <Field label="Dono" value={padlock.owner_name} />
              {user && <Field label="Matrícula" value={padlock.owner_registration} mono />}
              {user && <Field label="Função" value={padlock.owner_role} />}
              {user && <Field label="Telefone" value={padlock.owner_phone ? formatPhoneBR(padlock.owner_phone) : null} />}
            </>
          )}
          {isRed && (
            <p className="text-xs text-muted-foreground">
              Cadeados vermelhos não exigem dados pessoais — apenas número e setor.
            </p>
          )}
        </CardContent></Card>
        <Card><CardContent className="p-5 space-y-3">
          <Field label="Cor" value={colorLabel[padlock.color]} />
          <Field label="Nº" value={String(padlock.number)} mono />
          <Field label="Cadastrado em" value={formatDateTime(padlock.created_at)} />
          <Field label="Última atualização" value={formatDateTime(padlock.updated_at)} />
        </CardContent></Card>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <History className="h-4 w-4" /> Linha do tempo
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
                      <span className="text-sm font-semibold">{actionLabel(e.action)}</span>
                      {e.actor_name && <span className="text-xs text-muted-foreground">por {e.actor_name}</span>}
                    </div>
                    {e.notes && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.notes}</div>}
                    <div className="text-xs text-muted-foreground mt-1">{formatDateTime(e.created_at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent></Card>
      </section>

      <TransferDialog open={openTransfer} onOpenChange={setOpenTransfer} padlock={padlock} onDone={invalidate} />
      <EditDialog open={openEdit} onOpenChange={setOpenEdit} padlock={padlock} onDone={invalidate} onCodeChanged={(newCode) => navigate({ to: "/cadeados/$codigo", params: { codigo: newCode } })} />
      <CancelPadlockDialog open={openCancel} onOpenChange={setOpenCancel} padlock={padlock} onDone={invalidate} />
      <DeletePadlockDialog open={openDelete} onOpenChange={setOpenDelete} padlock={padlock} onDeleted={() => navigate({ to: "/cadeados" })} />
      <PrintLabelDialog open={openPrint} onOpenChange={setOpenPrint} padlock={padlock} />
      <ReportInconsistencyDialog open={openReport} onOpenChange={setOpenReport} padlock={padlock} />
    </PageShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm text-foreground ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
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
    created: "Cadastrado",
    updated: "Editado",
    deleted: "Eliminado definitivamente",
    transferred: "Transferido",
    applied: "Em uso",
    released: "Removido",
  } as Record<string, string>)[action] ?? action;
}

/* ============== Transfer ============== */
const transferSchema = z.object({
  owner_name: z.string().trim().min(1, "Informe o nome do novo dono").max(120),
  owner_registration: z.string().trim().min(1, "Informe a matrícula").max(40),
  owner_role: z.string().trim().min(1, "Informe a função").max(80),
  owner_sector: z.string().trim().min(1, "Informe o setor").max(100),
  owner_phone: z.string().trim().min(1, "Informe o telefone").max(30),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

function TransferDialog({ open, onOpenChange, padlock, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; padlock: Padlock; onDone: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [reg, setReg] = useState("");
  const [role, setRole] = useState("");
  const [sector, setSector] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = transferSchema.safeParse({
      owner_name: name, owner_registration: reg, owner_role: role,
      owner_sector: sector, owner_phone: phone, notes,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { data, error } = await supabase
      .from("padlocks")
      .update({
        owner_name: parsed.data.owner_name,
        owner_registration: parsed.data.owner_registration,
        owner_role: parsed.data.owner_role,
        owner_sector: parsed.data.owner_sector,
        owner_phone: parsed.data.owner_phone,
      })
      .eq("id", padlock.id).select().single();
    if (error || !data) {
      setLoading(false);
      return toast.error(translateError(error?.message ?? "Erro"));
    }
    await logEvent({
      padlock_id: padlock.id, padlock_code: padlock.code, action: "transferred",
      actor_id: user?.id ?? null, actor_name: user?.email ?? null,
      previous_data: {
        owner_name: padlock.owner_name, owner_registration: padlock.owner_registration,
        owner_role: padlock.owner_role, owner_sector: padlock.owner_sector,
        owner_phone: padlock.owner_phone,
      },
      new_data: {
        owner_name: data.owner_name, owner_registration: data.owner_registration,
        owner_role: data.owner_role, owner_sector: data.owner_sector,
        owner_phone: data.owner_phone,
      },
      notes: parsed.data.notes
        ? `De ${padlock.owner_name ?? "—"} (${padlock.owner_registration ?? "—"}) para ${data.owner_name} (${data.owner_registration}). ${parsed.data.notes}`
        : `De ${padlock.owner_name ?? "—"} (${padlock.owner_registration ?? "—"}) para ${data.owner_name} (${data.owner_registration}).`,
    });
    await supabase.storage.from("padlock-photos").remove([`${padlock.id}.jpg`]);
    toast.success("Cadeado transferido");
    setLoading(false); onOpenChange(false); onDone();
    setName(""); setReg(""); setRole(""); setSector(""); setPhone(""); setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferir cadeado — {colorLabel[padlock.color]} #{padlock.number}</DialogTitle>
          <DialogDescription>
            Dono atual: <strong>{padlock.owner_name ?? "—"}</strong> ({padlock.owner_registration ?? "—"}).
            A mudança fica registrada na linha do tempo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Dono</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required /></div>
            <div className="space-y-1.5"><Label>Matrícula</Label><Input value={reg} onChange={(e) => setReg(e.target.value)} maxLength={40} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Função</Label><Input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} required /></div>
            <div className="space-y-1.5">
              <Label>Setor / Empresa</Label>
              {padlock.color === "latao" ? (
                <Input value={sector} onChange={(e) => setSector(e.target.value)} maxLength={100} required />
              ) : (
                <SectorSelect value={sector} onChange={setSector} required />
              )}
            </div>
          </div>
          <div className="space-y-1.5"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(formatPhoneBR(e.target.value))} inputMode="tel" placeholder="(XX) XXXXX-XXXX" maxLength={16} required /></div>
          <div className="space-y-1.5"><Label>Observação (opcional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">{loading ? "..." : "Transferir"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============== Edit (admin) ============== */
function EditDialog({ open, onOpenChange, padlock, onDone, onCodeChanged }: {
  open: boolean; onOpenChange: (o: boolean) => void; padlock: Padlock;
  onDone: () => void; onCodeChanged: (newCode: string) => void;
}) {
  const { user } = useAuth();
  const [color, setColor] = useState<PadlockColor>(padlock.color);
  const [number, setNumber] = useState(String(padlock.number));
  const [name, setName] = useState(padlock.owner_name ?? "");
  const [reg, setReg] = useState(padlock.owner_registration ?? "");
  const [role, setRole] = useState(padlock.owner_role ?? "");
  const [sector, setSector] = useState(padlock.owner_sector ?? "");
  const [phone, setPhone] = useState(padlock.owner_phone ?? "");
  const [loading, setLoading] = useState(false);

  const isRed = color === "vermelho";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(number);
    if (!Number.isInteger(num) || num < 0) return toast.error("Número inválido");
    if (!sector.trim()) return toast.error("Setor é obrigatório");
    if (!isRed) {
      if (!name.trim() || !reg.trim() || !role.trim() || !phone.trim()) {
        return toast.error("Preencha todos os dados do dono");
      }
    }
    setLoading(true);
    const newCode = `${color}-${num}`;
    const { data, error } = await supabase
      .from("padlocks")
      .update({
        code: newCode,
        color, number: num,
        owner_name: isRed ? null : name.trim() || null,
        owner_registration: isRed ? null : reg.trim() || null,
        owner_role: isRed ? null : role.trim() || null,
        owner_sector: sector.trim(),
        owner_phone: isRed ? null : phone.trim() || null,
      })
      .eq("id", padlock.id).select().single();
    if (error || !data) {
      setLoading(false);
      return toast.error(translateError(error?.message ?? "Erro"));
    }
    await logEvent({
      padlock_id: padlock.id, padlock_code: data.code, action: "updated",
      actor_id: user?.id ?? null, actor_name: user?.email ?? null,
      previous_data: padlock, new_data: data,
    });
    toast.success("Cadeado atualizado");
    setLoading(false); onOpenChange(false); onDone();
    if (data.code !== padlock.code) onCodeChanged(data.code);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader><DialogTitle>Editar cadeado</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <Select value={color} onValueChange={(v) => setColor(v as PadlockColor)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PADLOCK_COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full border ${colorSwatch[c]}`} />
                        {colorLabel[c]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Número</Label><Input type="number" min={0} value={number} onChange={(e) => setNumber(e.target.value)} required /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Setor</Label>
            {color === "latao" ? (
              <Input value={sector} onChange={(e) => setSector(e.target.value)} maxLength={100} required />
            ) : (
              <SectorSelect value={sector} onChange={setSector} required />
            )}
          </div>
          {!isRed && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required /></div>
                <div className="space-y-1.5"><Label>Matrícula</Label><Input value={reg} onChange={(e) => setReg(e.target.value)} maxLength={40} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Função</Label><Input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} required /></div>
                <div className="space-y-1.5"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(formatPhoneBR(e.target.value))} inputMode="tel" placeholder="(XX) XXXXX-XXXX" maxLength={16} required /></div>
              </div>
            </>
          )}
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">{loading ? "..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function translateError(msg: string): string {
  if (msg.includes("padlocks_owner_unique_blue_brass")) {
    return "Esta matrícula já possui um cadeado dessa cor (azul/latão é 1 por pessoa).";
  }
  if (msg.includes("padlocks_color_number_key") || msg.includes("duplicate key")) {
    return "Já existe um cadeado com essa cor e número.";
  }
  return msg;
}
