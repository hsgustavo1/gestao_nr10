import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, ClipboardList, HardHat, ListChecks, MapPin, Plus, Trash2, User,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { useDeleteRtiReport } from "@/lib/rti-queries";
import { supabase } from "@/integrations/supabase/client";

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
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
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
              {canDelete && (
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }}
                  title="Excluir coleta"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </Link>
        </CardContent>
      </Card>
      {deleteOpen && (
        <ExcluirInspecaoDialog inspection={inspection} onOpenChange={(o) => { if (!o) setDeleteOpen(false); }} />
      )}
    </>
  );
}

type ExcluirScope = "campo" | "rti" | "ambos";

function ExcluirInspecaoDialog({
  inspection,
  onOpenChange,
}: {
  inspection: FieldInspection;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const deleteInsp = useDeleteFieldInspection();
  const deleteRti = useDeleteRtiReport();
  const hasRti = !!inspection.report_id;

  const [step, setStep] = useState<"scope" | "confirm">(hasRti ? "scope" : "confirm");
  const [scope, setScope] = useState<ExcluirScope>("ambos");
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      const finalScope: ExcluirScope = hasRti ? scope : "campo";

      if (finalScope === "campo" || finalScope === "ambos") {
        await deleteInsp.mutateAsync(inspection.id);
      }

      if ((finalScope === "rti" || finalScope === "ambos") && inspection.report_id) {
        if (finalScope === "rti") {
          await supabase
            .from("field_inspections")
            .update({ report_id: null, status: "em_andamento" })
            .eq("id", inspection.id);
          await qc.invalidateQueries({ queryKey: ["field_inspections"] });
        }
        await deleteRti.mutateAsync(inspection.report_id);
      }

      toast.success("Excluído com sucesso.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao excluir: " + (err as Error).message);
      setBusy(false);
    }
  }

  const scopeLabel: Record<ExcluirScope, string> = {
    campo: "a inspeção de campo (fotos e pontos)",
    rti: "o Plano de Ação RTI e suas não conformidades",
    ambos: "a inspeção de campo E o Plano de Ação RTI",
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-1rem)]">
        {step === "scope" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive shrink-0" />
                Excluir — o que deseja remover?
              </DialogTitle>
              <DialogDescription>
                Selecione o que será excluído para a inspeção <strong>{inspection.titulo}</strong>.
              </DialogDescription>
            </DialogHeader>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as ExcluirScope)} className="space-y-2 pt-1">
              <Label className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="campo" className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-sm">Excluir somente da Coleta em Campo</div>
                  <div className="text-xs text-muted-foreground">Remove pontos, achados e fotos. O Plano de Ação RTI é mantido.</div>
                </div>
              </Label>
              <Label className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="rti" className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-sm">Excluir somente do Plano de Ação RTI</div>
                  <div className="text-xs text-muted-foreground">Remove o relatório RTI e suas NCs. A coleta em campo volta ao status em andamento.</div>
                </div>
              </Label>
              <Label className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/50 has-[[data-state=checked]]:border-destructive has-[[data-state=checked]]:bg-destructive/5">
                <RadioGroupItem value="ambos" className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-sm">Excluir de ambos</div>
                  <div className="text-xs text-muted-foreground">Remove a coleta de campo e o Plano de Ação RTI completamente.</div>
                </div>
              </Label>
            </RadioGroup>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => setStep("confirm")}>Continuar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Confirmar exclusão
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    Você está prestes a excluir permanentemente{" "}
                    <strong>{scopeLabel[hasRti ? scope : "campo"]}</strong>{" "}
                    referente a <strong>{inspection.titulo}</strong>.
                  </p>
                  <p className="font-medium text-destructive">
                    Esta ação não pode ser desfeita e os dados não poderão ser recuperados.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => hasRti ? setStep("scope") : onOpenChange(false)} disabled={busy}>
                {hasRti ? "Voltar" : "Cancelar"}
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={busy}>
                {busy ? "Excluindo..." : "Excluir permanentemente"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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
