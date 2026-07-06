import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SectorSelect } from "@/components/sector-select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABELS,
  INSPECTION_RESULTS,
  INSPECTION_RESULT_LABELS,
  INSPECTION_TYPE_LABELS,
  INSPECTION_TYPE_SHORT,
  type ActionStatus,
  type Inspection,
  type InspectionAction,
  type InspectionResult,
  type InspectionType,
} from "@/lib/inspecoes";
import {
  inspectionReportUrl,
  uploadInspectionReport,
  useDeleteInspection,
  useDeleteInspectionAction,
  useInspectionActions,
  useInspections,
  useOpenActions,
  useUpsertInspection,
  useUpsertInspectionAction,
} from "@/lib/inspecoes-queries";
import { DOC_STATUS_LABELS, docExpiryStatus, type DocExpiryStatus } from "@/lib/prontuario";
import { formatDatePtBR } from "@/lib/qualificacoes";

function validityBadge(status: DocExpiryStatus) {
  const cls: Record<DocExpiryStatus, string> = {
    ok: "border-emerald-300 bg-emerald-50 text-emerald-700",
    expiring: "border-amber-300 bg-amber-50 text-amber-700",
    expired: "border-red-300 bg-red-50 text-red-700",
    perennial: "border-slate-300 bg-slate-50 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls[status]}`}
    >
      {DOC_STATUS_LABELS[status]}
    </span>
  );
}

function resultBadge(result: InspectionResult) {
  const cls: Record<InspectionResult, string> = {
    conforme: "border-emerald-300 bg-emerald-50 text-emerald-700",
    conforme_com_ressalvas: "border-amber-300 bg-amber-50 text-amber-700",
    nao_conforme: "border-red-300 bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls[result]}`}
    >
      {INSPECTION_RESULT_LABELS[result]}
    </span>
  );
}

export function InspecoesPage({ type }: { type: InspectionType }) {
  const { isStaff, isAdmin, user } = useAuth();
  const { data: inspections = [], isLoading } = useInspections(type);
  const { data: openActions = [] } = useOpenActions(type);
  const deleteInspection = useDeleteInspection();

  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [validityFilter, setValidityFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Inspection | null>(null);
  const [actionsFor, setActionsFor] = useState<Inspection | null>(null);

  const stats = useMemo(() => {
    const total = inspections.length;
    const naoConformes = inspections.filter((i) => i.result === "nao_conforme").length;
    const vencidos = inspections.filter(
      (i) => docExpiryStatus(i.validity_date) === "expired",
    ).length;
    const vencendo = inspections.filter(
      (i) => docExpiryStatus(i.validity_date) === "expiring",
    ).length;
    return { total, naoConformes, vencidos, vencendo, acoesAbertas: openActions.length };
  }, [inspections, openActions]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return inspections.filter((i) => {
      if (resultFilter !== "all" && i.result !== resultFilter) return false;
      if (validityFilter !== "all" && docExpiryStatus(i.validity_date) !== validityFilter)
        return false;
      if (!t) return true;
      return (
        i.equipment.toLowerCase().includes(t) ||
        (i.sector ?? "").toLowerCase().includes(t) ||
        (i.responsavel ?? "").toLowerCase().includes(t) ||
        (i.art ?? "").toLowerCase().includes(t) ||
        (i.notes ?? "").toLowerCase().includes(t)
      );
    });
  }, [inspections, search, resultFilter, validityFilter]);

  async function handleDelete(insp: Inspection) {
    if (
      !window.confirm(
        `Excluir a inspeção de "${insp.equipment}"? O plano de ação vinculado também será excluído.`,
      )
    )
      return;
    try {
      await deleteInspection.mutateAsync({ id: insp.id, report_path: insp.report_path });
      toast.success("Inspeção excluída.");
    } catch (e) {
      toast.error("Não foi possível excluir. Detalhe: " + (e as Error).message);
    }
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
            {INSPECTION_TYPE_LABELS[type]}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isLoading
              ? "Carregando..."
              : `${inspections.length} ${inspections.length === 1 ? "laudo registrado" : "laudos registrados"}`}
          </p>
        </div>
        {isStaff && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="bg-brand-gradient text-white shadow-brand"
          >
            <Plus className="h-4 w-4" /> Nova inspeção
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Laudos" value={stats.total} />
        <StatCard
          label="Vencendo"
          value={stats.vencendo}
          tone={stats.vencendo > 0 ? "amber" : "default"}
        />
        <StatCard
          label="Vencidos"
          value={stats.vencidos}
          tone={stats.vencidos > 0 ? "red" : "default"}
        />
        <StatCard
          label="Não conformes"
          value={stats.naoConformes}
          tone={stats.naoConformes > 0 ? "red" : "default"}
        />
        <StatCard
          label="Ações abertas"
          value={stats.acoesAbertas}
          tone={stats.acoesAbertas > 0 ? "amber" : "default"}
        />
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por equipamento, setor, responsável..."
            className="pl-8 w-full sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os resultados</SelectItem>
            {INSPECTION_RESULTS.map((r) => (
              <SelectItem key={r} value={r}>
                {INSPECTION_RESULT_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={validityFilter} onValueChange={setValidityFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Validade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as validades</SelectItem>
            <SelectItem value="ok">Válido</SelectItem>
            <SelectItem value="expiring">Vencendo (≤ 90 dias)</SelectItem>
            <SelectItem value="expired">Vencido</SelectItem>
            <SelectItem value="perennial">Sem validade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card className="mt-4">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {inspections.length === 0
                ? `Nenhuma inspeção de ${INSPECTION_TYPE_SHORT[type]} registrada ainda.`
                : "Nenhuma inspeção corresponde aos filtros."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipamento / Local</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Inspeção</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Responsável / ART</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => {
                    const status = docExpiryStatus(i.validity_date);
                    const openCount = openActions.filter((a) => a.inspection_id === i.id).length;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="max-w-[220px]">
                          <div className="font-medium leading-tight truncate" title={i.equipment}>
                            {i.equipment}
                          </div>
                          {i.notes && (
                            <div
                              className="text-[11px] text-muted-foreground truncate"
                              title={i.notes}
                            >
                              {i.notes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{i.sector || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDatePtBR(i.inspection_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDatePtBR(i.validity_date)}
                        </TableCell>
                        <TableCell>{validityBadge(status)}</TableCell>
                        <TableCell>{resultBadge(i.result)}</TableCell>
                        <TableCell className="max-w-[170px]">
                          <div className="text-sm truncate">{i.responsavel || "—"}</div>
                          {i.art && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              ART {i.art}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant={openCount > 0 ? "default" : "outline"}
                              onClick={() => setActionsFor(i)}
                              title="Plano de ação"
                              className={
                                openCount > 0 ? "bg-amber-500 hover:bg-amber-600 text-white" : ""
                              }
                            >
                              <ClipboardList className="h-4 w-4" />
                              {openCount > 0 && (
                                <span className="ml-1 text-[11px] font-bold">{openCount}</span>
                              )}
                            </Button>
                            {i.report_path && (
                              <Button asChild size="sm" variant="outline">
                                <a
                                  href={inspectionReportUrl(i.report_path)}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Baixar laudo (PDF)"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {isStaff && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditing(i);
                                  setDialogOpen(true);
                                }}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => handleDelete(i)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isStaff && dialogOpen && (
        <InspectionDialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
          type={type}
          existing={editing}
          actorId={user?.id ?? null}
          actorName={
            (user?.user_metadata?.display_name as string | undefined) ||
            user?.email?.split("@")[0] ||
            "Usuário"
          }
        />
      )}

      {actionsFor && (
        <ActionPlanDialog
          inspection={actionsFor}
          onOpenChange={(o) => {
            if (!o) setActionsFor(null);
          }}
          canEdit={isStaff}
          canDelete={isAdmin}
        />
      )}
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "red";
}) {
  const valueCls = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold tabular-nums ${valueCls}`}>{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function InspectionDialog({
  open,
  onOpenChange,
  type,
  existing,
  actorId,
  actorName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  type: InspectionType;
  existing: Inspection | null;
  actorId: string | null;
  actorName: string;
}) {
  const isEdit = !!existing;
  const upsert = useUpsertInspection();
  const [equipment, setEquipment] = useState(existing?.equipment ?? "");
  const [sector, setSector] = useState(existing?.sector ?? "");
  const [inspectionDate, setInspectionDate] = useState(
    existing?.inspection_date ?? new Date().toISOString().slice(0, 10),
  );
  const [validityDate, setValidityDate] = useState(existing?.validity_date ?? "");
  const [result, setResult] = useState<string>(existing?.result ?? "conforme");
  const [responsavel, setResponsavel] = useState(existing?.responsavel ?? "");
  const [art, setArt] = useState(existing?.art ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!equipment.trim()) return toast.error("Informe o equipamento ou local inspecionado.");
    if (!inspectionDate) return toast.error("Informe a data da inspeção.");
    if (file && file.type !== "application/pdf")
      return toast.error("O laudo deve ser um arquivo PDF.");
    if (file && file.size > 20 * 1024 * 1024) return toast.error("PDF excede 20 MB.");

    setBusy(true);
    try {
      let reportPath = existing?.report_path ?? null;
      if (file) {
        reportPath = await uploadInspectionReport(file);
      }

      await upsert.mutateAsync({
        ...(isEdit ? { id: existing!.id } : {}),
        inspection_type: type,
        equipment: equipment.trim(),
        sector: sector || null,
        inspection_date: inspectionDate,
        validity_date: validityDate || null,
        result: result as InspectionResult,
        report_path: reportPath,
        responsavel: responsavel.trim() || null,
        art: art.trim() || null,
        notes: notes.trim() || null,
        created_by: existing?.created_by ?? actorId,
        created_by_name: existing?.created_by_name ?? actorName,
      });
      toast.success(isEdit ? "Inspeção atualizada." : "Inspeção registrada.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível salvar. Detalhe: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
            {isEdit ? "Editar inspeção" : `Nova inspeção — ${INSPECTION_TYPE_SHORT[type]}`}
          </DialogTitle>
          <DialogDescription>
            Registre o laudo e sua validade. Resultados não conformes podem receber um plano de
            ação.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="in-equipment">Equipamento / Local</Label>
            <Input
              id="in-equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              maxLength={200}
              placeholder="Ex.: Subestação 01 — Transformador T1"
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <SectorSelect value={sector} onChange={setSector} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-result">Resultado</Label>
              <Select value={result} onValueChange={setResult}>
                <SelectTrigger id="in-result">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSPECTION_RESULTS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {INSPECTION_RESULT_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="in-date">Data da inspeção</Label>
              <Input
                id="in-date"
                type="date"
                value={inspectionDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setInspectionDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-validity">Validade do laudo (opcional)</Label>
              <Input
                id="in-validity"
                type="date"
                value={validityDate}
                onChange={(e) => setValidityDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="in-resp">Responsável técnico (opcional)</Label>
              <Input
                id="in-resp"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                maxLength={150}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-art">ART (opcional)</Label>
              <Input
                id="in-art"
                value={art}
                onChange={(e) => setArt(e.target.value)}
                maxLength={80}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-notes">Observações (opcional)</Label>
            <Textarea
              id="in-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-file">
              Laudo (PDF){isEdit ? " — opcional (substitui o atual)" : " (opcional)"}
            </Label>
            <Input
              id="in-file"
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </div>
            )}
            {isEdit && !file && existing?.report_path && (
              <div className="text-[11px] text-muted-foreground">PDF atual será mantido.</div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-brand-gradient text-white shadow-brand"
            >
              {busy ? "Salvando..." : isEdit ? "Salvar alterações" : "Registrar inspeção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActionPlanDialog({
  inspection,
  onOpenChange,
  canEdit,
  canDelete,
}: {
  inspection: Inspection;
  onOpenChange: (o: boolean) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { data: actions = [], isLoading } = useInspectionActions(inspection.id);
  const upsertAction = useUpsertInspectionAction();
  const deleteAction = useDeleteInspectionAction();

  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function addAction(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return toast.error("Descreva a ação corretiva.");
    setBusy(true);
    try {
      await upsertAction.mutateAsync({
        inspection_id: inspection.id,
        description: description.trim(),
        responsible: responsible.trim() || null,
        due_date: dueDate || null,
        status: "pendente",
        completed_at: null,
      });
      setDescription("");
      setResponsible("");
      setDueDate("");
      toast.success("Ação adicionada ao plano.");
    } catch (err) {
      toast.error("Não foi possível salvar. Detalhe: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(action: InspectionAction, status: ActionStatus) {
    try {
      await upsertAction.mutateAsync({
        ...action,
        status,
        completed_at: status === "concluida" ? new Date().toISOString().slice(0, 10) : null,
      });
    } catch (err) {
      toast.error("Não foi possível atualizar. Detalhe: " + (err as Error).message);
    }
  }

  async function remove(action: InspectionAction) {
    if (!window.confirm("Excluir esta ação do plano?")) return;
    try {
      await deleteAction.mutateAsync(action.id);
      toast.success("Ação excluída.");
    } catch (err) {
      toast.error("Não foi possível excluir. Detalhe: " + (err as Error).message);
    }
  }

  function actionStatusBadge(status: ActionStatus) {
    const cls: Record<ActionStatus, string> = {
      pendente: "border-red-300 bg-red-50 text-red-700",
      em_andamento: "border-amber-300 bg-amber-50 text-amber-700",
      concluida: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls[status]}`}
      >
        {ACTION_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <ClipboardList className="h-5 w-5 shrink-0 text-primary" />
            Plano de ação — {inspection.equipment}
          </DialogTitle>
          <DialogDescription>
            Ações corretivas para as não-conformidades apontadas no laudo de{" "}
            {formatDatePtBR(inspection.inspection_date)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading && <Skeleton className="h-16" />}
          {!isLoading && actions.length === 0 && (
            <div className="rounded-md border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              Nenhuma ação registrada para esta inspeção.
            </div>
          )}
          {actions.map((a) => (
            <div key={a.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="text-sm whitespace-pre-wrap min-w-0 flex-1">{a.description}</div>
                {actionStatusBadge(a.status)}
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-[11px] text-muted-foreground">
                  {a.responsible && (
                    <>
                      Responsável: <strong className="text-foreground">{a.responsible}</strong>{" "}
                      ·{" "}
                    </>
                  )}
                  Prazo: <strong className="text-foreground">{formatDatePtBR(a.due_date)}</strong>
                  {a.completed_at && <> · Concluída em {formatDatePtBR(a.completed_at)}</>}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <Select value={a.status} onValueChange={(v) => setStatus(a, v as ActionStatus)}>
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ACTION_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => remove(a)}
                        title="Excluir ação"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {canEdit && (
          <form onSubmit={addAction} className="space-y-3 rounded-md border bg-muted/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nova ação corretiva
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-desc">Descrição</Label>
              <Textarea
                id="ap-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={500}
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ap-resp">Responsável (opcional)</Label>
                <Input
                  id="ap-resp"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  maxLength={150}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-due">Prazo (opcional)</Label>
                <Input
                  id="ap-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={busy}
                className="bg-brand-gradient text-white shadow-brand"
              >
                <Plus className="h-4 w-4" /> {busy ? "Salvando..." : "Adicionar ação"}
              </Button>
            </div>
          </form>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
