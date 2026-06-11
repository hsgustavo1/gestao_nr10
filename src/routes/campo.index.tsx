import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ClipboardList, HardHat, ListChecks, MapPin, Plus, Trash2, User,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { formatDatePtBR } from "@/lib/qualificacoes";
import {
  FIELD_INSPECTION_STATUS_BADGE, FIELD_INSPECTION_STATUS_LABELS,
  type FieldInspection,
} from "@/lib/campo";
import {
  useDeleteFieldInspection, useFieldInspections, useUpsertFieldInspection,
} from "@/lib/campo-queries";

export const Route = createFileRoute("/campo/")({
  component: CampoIndexPage,
  head: () => ({
    meta: [
      { title: "Coleta em Campo — RTI — Gestão NR-10" },
      { name: "description", content: "Inspeção RTI em campo: o consultor coleta fotos e modos de falha e o sistema compõe o RTI." },
    ],
  }),
});

function CampoIndexPage() {
  const { isStaff } = useAuth();
  const { data: inspections = [], isLoading } = useFieldInspections();
  const [novaOpen, setNovaOpen] = useState(false);

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <HardHat className="h-5 w-5 shrink-0 text-primary" />
            Coleta em Campo — RTI
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            O consultor inspeciona em campo (fotos + modos de falha) e o sistema compõe o Plano de Ação RTI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/campo/modos">
              <ListChecks className="h-4 w-4" /> Base de modos de falha
            </Link>
          </Button>
          {isStaff && (
            <Button onClick={() => setNovaOpen(true)} className="bg-brand-gradient text-white shadow-brand">
              <Plus className="h-4 w-4" /> Nova inspeção
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : inspections.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center space-y-3">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Nenhuma coleta de campo ainda.
              {isStaff ? " Crie uma inspeção para começar a registrar os pontos." : ""}
            </p>
            {isStaff && (
              <Button onClick={() => setNovaOpen(true)} className="bg-brand-gradient text-white shadow-brand">
                <Plus className="h-4 w-4" /> Nova inspeção
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="mt-5 space-y-3">
          {inspections.map((insp) => (
            <InspectionCard key={insp.id} inspection={insp} canDelete={isStaff} />
          ))}
        </div>
      )}

      {isStaff && novaOpen && (
        <NovaInspecaoDialog onOpenChange={(o) => { if (!o) setNovaOpen(false); }} />
      )}
    </PageShell>
  );
}

function InspectionCard({ inspection, canDelete }: { inspection: FieldInspection; canDelete: boolean }) {
  const deleteInsp = useDeleteFieldInspection();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Excluir a coleta "${inspection.titulo}"? Pontos, achados e fotos serão removidos.`)) return;
    try {
      await deleteInsp.mutateAsync(inspection.id);
      toast.success("Coleta excluída.");
    } catch (err) {
      toast.error("Falha ao excluir: " + (err as Error).message);
    }
  }

  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="p-0">
        <Link to="/campo/inspecao/$id" params={{ id: inspection.id }} className="block p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold leading-tight">{inspection.titulo}</span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FIELD_INSPECTION_STATUS_BADGE[inspection.status]}`}>
                  {FIELD_INSPECTION_STATUS_LABELS[inspection.status]}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                {inspection.cliente && <span className="inline-flex items-center gap-1"><HardHat className="h-3 w-3" />{inspection.cliente}</span>}
                {inspection.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{inspection.local}</span>}
                {inspection.engenheiro && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{inspection.engenheiro}</span>}
                <span>{formatDatePtBR(inspection.data_inspecao)}</span>
              </div>
            </div>
            {canDelete && inspection.status !== "importada" && (
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground shrink-0"
                onClick={handleDelete} title="Excluir coleta"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

function NovaInspecaoDialog({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const upsert = useUpsertFieldInspection();

  const actorName =
    (user?.user_metadata?.display_name as string | undefined) ||
    user?.email?.split("@")[0] || null;

  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState("");
  const [local, setLocal] = useState("");
  const [engenheiro, setEngenheiro] = useState(actorName ?? "");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return toast.error("Informe um título para a inspeção.");
    setBusy(true);
    try {
      const insp = await upsert.mutateAsync({
        titulo: titulo.trim(),
        cliente: cliente.trim() || null,
        local: local.trim() || null,
        engenheiro: engenheiro.trim() || null,
        data_inspecao: data,
        status: "em_andamento",
        created_by_name: actorName,
      });
      toast.success("Inspeção criada. Adicione os pontos de coleta.");
      navigate({ to: "/campo/inspecao/$id", params: { id: insp.id } });
    } catch (err) {
      toast.error("Falha ao criar: " + (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <HardHat className="h-5 w-5 shrink-0 text-primary" /> Nova inspeção de campo
          </DialogTitle>
          <DialogDescription>
            Identifique a inspeção. Os pontos e achados são registrados na tela seguinte.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fi-titulo">Título</Label>
            <Input id="fi-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={150} placeholder="Ex.: RTI Usina Água Emendada — Safra 2026" required />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fi-cliente">Cliente / unidade</Label>
              <Input id="fi-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} maxLength={150} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fi-local">Local</Label>
              <Input id="fi-local" value={local} onChange={(e) => setLocal(e.target.value)} maxLength={150} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fi-eng">Engenheiro responsável</Label>
              <Input id="fi-eng" value={engenheiro} onChange={(e) => setEngenheiro(e.target.value)} maxLength={150} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fi-data">Data</Label>
              <Input id="fi-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy} className="bg-brand-gradient text-white shadow-brand">
              {busy ? "Criando..." : "Criar e adicionar pontos"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
