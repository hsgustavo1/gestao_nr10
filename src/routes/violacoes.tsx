import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShieldAlert, FileText, Plus, Search, Download, Pencil } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/padlocks";

type Violation = {
  id: string;
  violation_date: string;
  reason: string;
  requester: string;
  sector: string;
  document_path: string;
  created_by_name: string | null;
  created_at: string;
};

export const Route = createFileRoute("/violacoes")({
  component: ViolacoesPage,
  head: () => ({
    meta: [
       { title: "Registros de violação de dispositivos — RAC" },
      { name: "description", content: "Histórico de violações de cadeado em campo, com termo anexo e responsável pelo registro." },
    ],
  }),
});

function ViolacoesPage() {
  const { isStaff, isAdmin, user } = useAuth();
  const [items, setItems] = useState<Violation[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Violation | null>(null);

  async function reload() {
    const { data } = await supabase
      .from("padlock_violations")
      .select("*")
      .order("violation_date", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Violation[]);
  }

  async function loadSectors() {
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "sectors")
      .maybeSingle();
    if (data?.valor) {
      try {
        const arr = JSON.parse(data.valor) as string[];
        setSectors(arr.sort((a, b) => a.localeCompare(b, "pt-BR")));
      } catch { /* noop */ }
    }
  }

  useEffect(() => {
    void reload();
    void loadSectors();
  }, []);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return items;
    return items.filter((v) =>
      v.reason.toLowerCase().includes(t) ||
      v.requester.toLowerCase().includes(t) ||
      v.sector.toLowerCase().includes(t) ||
      (v.created_by_name ?? "").toLowerCase().includes(t),
    );
  }, [items, search]);

  function publicUrl(path: string): string {
    const { data } = supabase.storage.from("violation-docs").getPublicUrl(path);
    return data.publicUrl;
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
           <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
             <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
             Registros de violação de dispositivos
           </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "registro" : "registros"} · Termo de violação anexo em PDF
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por motivo, solicitante, setor..."
              className="pl-8 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isStaff && (
            <Button onClick={() => setOpen(true)} className="bg-brand-gradient text-white shadow-brand">
              <Plus className="h-4 w-4" /> Novo registro
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {filtered.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum registro de violação encontrado.
          </CardContent></Card>
        )}
        {filtered.map((v) => (
          <Card key={v.id}>
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                     <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive whitespace-nowrap">
                       <ShieldAlert className="h-3 w-3" /> Violação de dispositivo
                     </span>
                    <span className="text-sm font-semibold">
                      {formatDate(v.violation_date)}
                    </span>
                    <span className="text-xs text-muted-foreground">· Setor: <strong className="text-foreground">{v.sector}</strong></span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Solicitante: <strong className="text-foreground">{v.requester}</strong>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <a href={publicUrl(v.document_path)} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" /> Termo (PDF)
                  </a>
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(v)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                )}
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {v.reason}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Registrado por <strong className="text-foreground">{v.created_by_name || "—"}</strong> em {formatDateTime(v.created_at)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isStaff && (
        <ViolationDialog
          open={open}
          onOpenChange={setOpen}
          sectors={sectors}
          actorId={user?.id ?? null}
          actorName={
            (user?.user_metadata?.display_name as string | undefined) ||
            user?.email?.split("@")[0] ||
            "Usuário"
          }
          onSaved={() => { setOpen(false); void reload(); }}
        />
      )}
      {isAdmin && editing && (
        <ViolationDialog
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          sectors={sectors}
          actorId={user?.id ?? null}
          actorName={
            (user?.user_metadata?.display_name as string | undefined) ||
            user?.email?.split("@")[0] ||
            "Usuário"
          }
          existing={editing}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
    </PageShell>
  );
}

function formatDate(d: string): string {
  // d is YYYY-MM-DD
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

const REASON_OPTIONS = ["EXTRAVIO DA CHAVE", "INTEGRANTE AUSENTE"] as const;

function ViolationDialog({
  open, onOpenChange, sectors, actorId, actorName, existing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sectors: string[];
  actorId: string | null;
  actorName: string;
  existing?: Violation;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [date, setDate] = useState<string>(existing?.violation_date ?? new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<string>(existing?.reason ?? "");
  const [requester, setRequester] = useState<string>((existing?.requester ?? "").toUpperCase());
  const [sector, setSector] = useState<string>(existing?.sector ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    if (isEdit) return;
    setDate(new Date().toISOString().slice(0, 10));
    setReason("");
    setRequester("");
    setSector("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!date) return toast.error("Informe a data da violação.");
    if (!reason) return toast.error("Selecione o motivo da violação.");
    if (!requester.trim()) return toast.error("Informe o solicitante.");
    if (!sector) return toast.error("Selecione o setor.");
    if (!isEdit && !file) return toast.error("Anexe o Termo de violação em PDF.");
    if (file && file.type !== "application/pdf") return toast.error("O anexo deve ser um arquivo PDF.");
    if (file && file.size > 10 * 1024 * 1024) return toast.error("PDF excede 10 MB.");

    setBusy(true);

    let documentPath = existing?.document_path ?? "";
    let oldPathToRemove: string | null = null;

    if (file) {
      const id = isEdit ? (existing!.id) : crypto.randomUUID();
      const path = `${id}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("violation-docs")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) {
        setBusy(false);
        toast.error("Falha ao enviar PDF: " + upErr.message);
        return;
      }
      if (isEdit && existing?.document_path) oldPathToRemove = existing.document_path;
      documentPath = path;
    }

    const payload = {
      violation_date: date,
      reason: reason.toUpperCase(),
      requester: requester.trim().toUpperCase(),
      sector: sector.toUpperCase(),
      document_path: documentPath,
    };

    if (isEdit) {
      const { error } = await supabase
        .from("padlock_violations")
        .update(payload)
        .eq("id", existing!.id);
      if (error) {
        setBusy(false);
        if (file && documentPath) await supabase.storage.from("violation-docs").remove([documentPath]);
        toast.error("Falha ao atualizar registro: " + error.message);
        return;
      }
      if (oldPathToRemove) await supabase.storage.from("violation-docs").remove([oldPathToRemove]);
      setBusy(false);
      toast.success("Registro atualizado.");
      onSaved();
      return;
    }

    const id = crypto.randomUUID();
    const { error } = await supabase.from("padlock_violations").insert({
      id,
      ...payload,
      created_by: actorId,
      created_by_name: actorName,
    });
    if (error) {
      setBusy(false);
      await supabase.storage.from("violation-docs").remove([documentPath]);
      toast.error("Falha ao salvar registro: " + error.message);
      return;
    }
    setBusy(false);
    toast.success("Registro de violação salvo.");
    reset();
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
           <DialogTitle className="flex items-center gap-2 leading-tight">
             <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
            {isEdit ? "Editar registro de violação" : "Novo registro de violação de dispositivos"}
           </DialogTitle>
          <DialogDescription>
            Todos os campos são obrigatórios. {isEdit ? "Anexar um novo PDF substitui o anterior." : "O Termo de violação deve ser anexado em PDF."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vd-date">Data da violação</Label>
              <Input
                id="vd-date"
                type="date"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-sector">Setor da violação</Label>
              <Select value={sector || undefined} onValueChange={setSector} required>
                <SelectTrigger id="vd-sector"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {sectors.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum setor cadastrado.</div>
                  )}
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vd-requester">Solicitante da violação</Label>
            <Input
              id="vd-requester"
              value={requester}
              onChange={(e) => setRequester(e.target.value.toUpperCase())}
              maxLength={150}
              placeholder="NOME DE QUEM SOLICITOU A VIOLAÇÃO"
              className="uppercase"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vd-reason">Motivo da violação</Label>
            <Select value={reason || undefined} onValueChange={setReason} required>
              <SelectTrigger id="vd-reason"><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vd-file">Termo de violação (PDF){isEdit && " — opcional (substitui o atual)"}</Label>
            <Input
              id="vd-file"
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required={!isEdit}
            />
            {file && (
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </div>
            )}
            {isEdit && !file && existing?.document_path && (
              <div className="text-[11px] text-muted-foreground">PDF atual será mantido.</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy} className="bg-brand-gradient text-white shadow-brand">
              {busy ? "Salvando..." : (isEdit ? "Salvar alterações" : "Salvar registro")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}