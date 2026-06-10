import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Download, FileText, FlaskConical, HardHat, Pencil, Plus, Search, Trash2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SectorSelect } from "@/components/sector-select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import {
  EPI_STATUS_LABELS, EPI_TYPES, EPI_TYPE_LABELS, epiTestStatus, lastTestByEpi, nextTestDate,
  type EPI, type EPITest, type EPITestStatus, type EPIType,
} from "@/lib/epis";
import {
  epiCertificateUrl, uploadEPICertificate,
  useDeleteEPI, useDeleteEPITest, useEPIs, useEPITests, useInsertEPITest, useUpsertEPI,
  type EPIWithEmployee,
} from "@/lib/epis-queries";
import { useEmployees } from "@/lib/qualificacoes-queries";
import { formatDatePtBR } from "@/lib/qualificacoes";

export const Route = createFileRoute("/epis/")({
  component: EPIsPage,
  head: () => ({
    meta: [
      { title: "EPIs e EPCs — Gestão NR-10" },
      { name: "description", content: "Gestão de EPIs e EPCs especiais com controle de ensaios dielétricos periódicos." },
    ],
  }),
});

const NO_EMPLOYEE = "__none__";

function statusBadge(status: EPITestStatus) {
  const cls: Record<EPITestStatus, string> = {
    ok: "border-emerald-300 bg-emerald-50 text-emerald-700",
    expiring: "border-amber-300 bg-amber-50 text-amber-700",
    expired: "border-red-300 bg-red-50 text-red-700",
    failed: "border-red-400 bg-red-100 text-red-800",
    none: "border-slate-300 bg-slate-50 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls[status]}`}>
      {EPI_STATUS_LABELS[status]}
    </span>
  );
}

function EPIsPage() {
  const { isStaff, isAdmin } = useAuth();
  const { data: epis = [], isLoading } = useEPIs();
  const { data: allTests = [] } = useEPITests();
  const deleteEPI = useDeleteEPI();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EPIWithEmployee | null>(null);
  const [testsFor, setTestsFor] = useState<EPIWithEmployee | null>(null);

  const lastTests = useMemo(() => lastTestByEpi(allTests), [allTests]);

  const stats = useMemo(() => {
    let emDia = 0, vencendo = 0, vencidos = 0, reprovados = 0, semEnsaio = 0;
    for (const e of epis) {
      const st = epiTestStatus(e, lastTests.get(e.id) ?? null);
      if (st === "ok") emDia++;
      else if (st === "expiring") vencendo++;
      else if (st === "expired") vencidos++;
      else if (st === "failed") reprovados++;
      else semEnsaio++;
    }
    return { total: epis.length, emDia, vencendo, vencidos, reprovados, semEnsaio };
  }, [epis, lastTests]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return epis.filter((e) => {
      if (typeFilter !== "all" && e.epi_type !== typeFilter) return false;
      if (statusFilter !== "all" && epiTestStatus(e, lastTests.get(e.id) ?? null) !== statusFilter) return false;
      if (!t) return true;
      return (
        (e.description ?? "").toLowerCase().includes(t) ||
        (e.serial_number ?? "").toLowerCase().includes(t) ||
        (e.ca ?? "").toLowerCase().includes(t) ||
        (e.epi_class ?? "").toLowerCase().includes(t) ||
        (e.sector ?? "").toLowerCase().includes(t) ||
        (e.employees?.name ?? "").toLowerCase().includes(t) ||
        (e.employees?.matricula ?? "").toLowerCase().includes(t) ||
        EPI_TYPE_LABELS[e.epi_type].toLowerCase().includes(t)
      );
    });
  }, [epis, search, typeFilter, statusFilter, lastTests]);

  async function handleDelete(epi: EPIWithEmployee) {
    if (!window.confirm(`Excluir o EPI "${EPI_TYPE_LABELS[epi.epi_type]}${epi.serial_number ? ` ${epi.serial_number}` : ""}"? O histórico de ensaios também será excluído.`)) return;
    try {
      await deleteEPI.mutateAsync(epi.id);
      toast.success("EPI excluído.");
    } catch (e) {
      toast.error("Falha ao excluir: " + (e as Error).message);
    }
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <HardHat className="h-5 w-5 shrink-0 text-primary" />
            EPIs e EPCs especiais
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Controle de ensaios dielétricos periódicos · {isLoading ? "Carregando..." : `${epis.length} ${epis.length === 1 ? "item ativo" : "itens ativos"}`}
          </p>
        </div>
        {isStaff && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-brand-gradient text-white shadow-brand">
            <Plus className="h-4 w-4" /> Novo EPI
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Em dia" value={stats.emDia} tone="green" />
        <StatCard label="Vencendo" value={stats.vencendo} tone={stats.vencendo > 0 ? "amber" : "default"} />
        <StatCard label="Vencidos" value={stats.vencidos} tone={stats.vencidos > 0 ? "red" : "default"} />
        <StatCard label="Reprovados" value={stats.reprovados} tone={stats.reprovados > 0 ? "red" : "default"} />
        <StatCard label="Sem ensaio" value={stats.semEnsaio} tone={stats.semEnsaio > 0 ? "amber" : "default"} />
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por série, CA, colaborador, setor..."
            className="pl-8 w-full sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {EPI_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{EPI_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ok">Em dia</SelectItem>
            <SelectItem value="expiring">Vencendo (≤ 30 dias)</SelectItem>
            <SelectItem value="expired">Ensaio vencido</SelectItem>
            <SelectItem value="failed">Reprovado</SelectItem>
            <SelectItem value="none">Sem ensaio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card className="mt-4">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {epis.length === 0
                ? "Nenhum EPI cadastrado ainda. Comece cadastrando as luvas isolantes e detectores de tensão."
                : "Nenhum EPI corresponde aos filtros."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>EPI</TableHead>
                    <TableHead>Série / CA</TableHead>
                    <TableHead>Vinculado a</TableHead>
                    <TableHead>Último ensaio</TableHead>
                    <TableHead>Próximo ensaio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const last = lastTests.get(e.id) ?? null;
                    const status = epiTestStatus(e, last);
                    const next = last && last.result === "aprovado" ? nextTestDate(e, last) : null;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="max-w-[220px]">
                          <div className="font-medium leading-tight">
                            {EPI_TYPE_LABELS[e.epi_type]}
                            {e.epi_class && <span className="ml-1 text-xs text-muted-foreground">classe {e.epi_class}</span>}
                          </div>
                          {e.description && (
                            <div className="text-[11px] text-muted-foreground truncate" title={e.description}>{e.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm">{e.serial_number || "—"}</div>
                          {e.ca && <div className="text-[11px] text-muted-foreground">CA {e.ca}</div>}
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          {e.employees ? (
                            <>
                              <div className="text-sm truncate" title={e.employees.name}>{e.employees.name}</div>
                              <div className="text-[11px] text-muted-foreground">Mat. {e.employees.matricula}</div>
                            </>
                          ) : (
                            <div className="text-sm">{e.sector ? `Setor ${e.sector}` : "Uso coletivo"}</div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{last ? formatDatePtBR(last.test_date) : "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{next ? formatDatePtBR(next) : "—"}</TableCell>
                        <TableCell>{statusBadge(status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant={status === "expired" || status === "none" || status === "failed" ? "default" : "outline"}
                              onClick={() => setTestsFor(e)}
                              title="Histórico de ensaios"
                              className={status === "expired" || status === "failed" ? "bg-red-500 hover:bg-red-600 text-white" : status === "none" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                            >
                              <FlaskConical className="h-4 w-4" />
                            </Button>
                            {isStaff && (
                              <Button size="sm" variant="outline" onClick={() => { setEditing(e); setDialogOpen(true); }} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {isAdmin && (
                              <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(e)} title="Excluir">
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
        <EPIDialog
          open={dialogOpen}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
          existing={editing}
        />
      )}

      {testsFor && (
        <EPITestsDialog
          epi={testsFor}
          onOpenChange={(o) => { if (!o) setTestsFor(null); }}
          canEdit={isStaff}
          canDelete={isAdmin}
        />
      )}
    </PageShell>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "green" | "amber" | "red" }) {
  const valueCls =
    tone === "red" ? "text-red-600" :
    tone === "amber" ? "text-amber-600" :
    tone === "green" ? "text-emerald-600" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold tabular-nums ${valueCls}`}>{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function EPIDialog({
  open, onOpenChange, existing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: EPIWithEmployee | null;
}) {
  const isEdit = !!existing;
  const upsert = useUpsertEPI();
  const { data: employees = [] } = useEmployees("ativo");
  const [epiType, setEpiType] = useState<string>(existing?.epi_type ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [epiClass, setEpiClass] = useState(existing?.epi_class ?? "");
  const [serialNumber, setSerialNumber] = useState(existing?.serial_number ?? "");
  const [ca, setCa] = useState(existing?.ca ?? "");
  const [employeeId, setEmployeeId] = useState<string>(existing?.employee_id ?? NO_EMPLOYEE);
  const [sector, setSector] = useState(existing?.sector ?? "");
  const [acquisitionDate, setAcquisitionDate] = useState(existing?.acquisition_date ?? "");
  const [intervalMonths, setIntervalMonths] = useState(String(existing?.test_interval_months ?? 6));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!epiType) return toast.error("Selecione o tipo de EPI.");
    const interval = parseInt(intervalMonths, 10);
    if (!Number.isFinite(interval) || interval < 1 || interval > 60) {
      return toast.error("Intervalo de ensaio deve ser entre 1 e 60 meses.");
    }

    setBusy(true);
    try {
      await upsert.mutateAsync({
        ...(isEdit ? { id: existing!.id } : {}),
        epi_type: epiType as EPIType,
        description: description.trim() || null,
        epi_class: epiClass.trim() || null,
        serial_number: serialNumber.trim() || null,
        ca: ca.trim() || null,
        employee_id: employeeId === NO_EMPLOYEE ? null : employeeId,
        sector: sector || null,
        acquisition_date: acquisitionDate || null,
        test_interval_months: interval,
        active: existing?.active ?? true,
        notes: notes.trim() || null,
      });
      toast.success(isEdit ? "EPI atualizado." : "EPI cadastrado.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao salvar: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <HardHat className="h-5 w-5 shrink-0 text-primary" />
            {isEdit ? "Editar EPI" : "Novo EPI"}
          </DialogTitle>
          <DialogDescription>
            Vincule a um colaborador ou deixe como uso coletivo do setor. O intervalo padrão de ensaio dielétrico é semestral.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-type">Tipo</Label>
              <Select value={epiType || undefined} onValueChange={setEpiType} required>
                <SelectTrigger id="ep-type"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {EPI_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{EPI_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-class">Classe de isolação (opcional)</Label>
              <Input id="ep-class" value={epiClass} onChange={(e) => setEpiClass(e.target.value)} maxLength={20} placeholder="Ex.: 00, 0, 1, 2" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-desc">Descrição (opcional)</Label>
            <Input id="ep-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Ex.: Luva isolante classe 00, tamanho 9" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-serial">Número de série (opcional)</Label>
              <Input id="ep-serial" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-ca">CA (opcional)</Label>
              <Input id="ep-ca" value={ca} onChange={(e) => setCa(e.target.value)} maxLength={40} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-emp">Colaborador</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger id="ep-emp"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_EMPLOYEE}>Uso coletivo / setor</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.matricula})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <SectorSelect value={sector} onChange={setSector} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-acq">Data de aquisição (opcional)</Label>
              <Input id="ep-acq" type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-interval">Intervalo de ensaio (meses)</Label>
              <Input id="ep-interval" type="number" min={1} max={60} value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-notes">Observações (opcional)</Label>
            <Textarea id="ep-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy} className="bg-brand-gradient text-white shadow-brand">
              {busy ? "Salvando..." : (isEdit ? "Salvar alterações" : "Cadastrar EPI")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EPITestsDialog({
  epi, onOpenChange, canEdit, canDelete,
}: {
  epi: EPIWithEmployee;
  onOpenChange: (o: boolean) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { data: tests = [], isLoading } = useEPITests(epi.id);
  const insertTest = useInsertEPITest();
  const deleteTest = useDeleteEPITest();

  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<string>("aprovado");
  const [laboratory, setLaboratory] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addTest(e: FormEvent) {
    e.preventDefault();
    if (!testDate) return toast.error("Informe a data do ensaio.");
    if (file && file.type !== "application/pdf") return toast.error("O certificado deve ser um arquivo PDF.");
    if (file && file.size > 10 * 1024 * 1024) return toast.error("PDF excede 10 MB.");

    setBusy(true);
    try {
      let certificatePath: string | null = null;
      if (file) certificatePath = await uploadEPICertificate(file);

      await insertTest.mutateAsync({
        epi_id: epi.id,
        test_date: testDate,
        result: result as "aprovado" | "reprovado",
        laboratory: laboratory.trim() || null,
        certificate_path: certificatePath,
        notes: notes.trim() || null,
      });
      setLaboratory("");
      setNotes("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Ensaio registrado.");
    } catch (err) {
      toast.error("Falha ao salvar: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(test: EPITest) {
    if (!window.confirm("Excluir este registro de ensaio?")) return;
    try {
      await deleteTest.mutateAsync({ id: test.id, certificate_path: test.certificate_path });
      toast.success("Ensaio excluído.");
    } catch (err) {
      toast.error("Falha ao excluir: " + (err as Error).message);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <FlaskConical className="h-5 w-5 shrink-0 text-primary" />
            Ensaios — {EPI_TYPE_LABELS[epi.epi_type]}{epi.serial_number ? ` (série ${epi.serial_number})` : ""}
          </DialogTitle>
          <DialogDescription>
            Histórico de ensaios dielétricos. Intervalo configurado: {epi.test_interval_months} {epi.test_interval_months === 1 ? "mês" : "meses"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading && <Skeleton className="h-16" />}
          {!isLoading && tests.length === 0 && (
            <div className="rounded-md border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              Nenhum ensaio registrado para este EPI.
            </div>
          )}
          {tests.map((t) => (
            <div key={t.id} className="rounded-md border p-3 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{formatDatePtBR(t.test_date)}</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${t.result === "aprovado" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-700"}`}>
                    {t.result === "aprovado" ? "Aprovado" : "Reprovado"}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {t.laboratory && <>Laboratório: <strong className="text-foreground">{t.laboratory}</strong></>}
                  {t.notes && <> · {t.notes}</>}
                </div>
              </div>
              <div className="flex gap-1">
                {t.certificate_path && (
                  <Button asChild size="sm" variant="outline">
                    <a href={epiCertificateUrl(t.certificate_path)} target="_blank" rel="noreferrer" title="Certificado (PDF)">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {canDelete && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(t)} title="Excluir ensaio">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {canEdit && (
          <form onSubmit={addTest} className="space-y-3 rounded-md border bg-muted/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registrar novo ensaio</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="et-date">Data do ensaio</Label>
                <Input id="et-date" type="date" value={testDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setTestDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="et-result">Resultado</Label>
                <Select value={result} onValueChange={setResult}>
                  <SelectTrigger id="et-result"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="reprovado">Reprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="et-lab">Laboratório (opcional)</Label>
                <Input id="et-lab" value={laboratory} onChange={(e) => setLaboratory(e.target.value)} maxLength={150} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="et-file">Certificado (PDF, opcional)</Label>
                <Input id="et-file" ref={fileRef} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            {file && (
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="et-notes">Observações (opcional)</Label>
              <Input id="et-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={busy} className="bg-brand-gradient text-white shadow-brand">
                <Plus className="h-4 w-4" /> {busy ? "Salvando..." : "Registrar ensaio"}
              </Button>
            </div>
          </form>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
