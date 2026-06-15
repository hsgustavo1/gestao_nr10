import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Download, FileText, Plus, Search, Stethoscope, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ASO_RESULTADO_LABELS,
  ASO_RESULTADOS,
  ASO_STATUS_LABELS,
  ASO_TIPO_LABELS,
  ASO_TIPOS,
  asoStatus,
  latestASOByEmployee,
  type ASO,
  type ASOResultado,
  type ASOStatus,
  type ASOTipo,
} from "@/lib/asos";
import { asoFileUrl, uploadASOFile, useASOs, useDeleteASO, useUpsertASO } from "@/lib/asos-queries";
import { useEmployees } from "@/lib/qualificacoes-queries";
import { formatDatePtBR, type Employee } from "@/lib/qualificacoes";

export const Route = createFileRoute("/qualificacoes/asos")({
  component: ASOsPage,
  head: () => ({
    meta: [
      { title: "ASOs — Gestão NR-10" },
      {
        name: "description",
        content:
          "Controle de Atestados de Saúde Ocupacional dos trabalhadores autorizados (NR-10 10.8.7).",
      },
    ],
  }),
});

function statusBadge(status: ASOStatus) {
  const cls: Record<ASOStatus, string> = {
    ok: "border-emerald-300 bg-emerald-50 text-emerald-700",
    expiring: "border-amber-300 bg-amber-50 text-amber-700",
    expired: "border-red-300 bg-red-50 text-red-700",
    inapto: "border-red-400 bg-red-100 text-red-800",
    none: "border-slate-300 bg-slate-50 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls[status]}`}
    >
      {ASO_STATUS_LABELS[status]}
    </span>
  );
}

function ASOsPage() {
  const { isStaff } = useAuth();
  const { data: employees = [], isLoading: loadingEmp } = useEmployees("ativo");
  const { data: asos = [], isLoading: loadingAsos } = useASOs();
  const isLoading = loadingEmp || loadingAsos;

  const [search, setSearch] = useState("");
  const [setorFilter, setSetorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [historyFor, setHistoryFor] = useState<Employee | null>(null);

  const latestByEmp = useMemo(() => latestASOByEmployee(asos), [asos]);

  const setores = useMemo(() => {
    const s = new Set<string>();
    for (const e of employees) if (e.setor) s.add(e.setor);
    return Array.from(s).sort();
  }, [employees]);

  const stats = useMemo(() => {
    let emDia = 0,
      vencendo = 0,
      vencidos = 0,
      inaptos = 0,
      semAso = 0;
    for (const e of employees) {
      const st = asoStatus(latestByEmp.get(e.id) ?? null);
      if (st === "ok") emDia++;
      else if (st === "expiring") vencendo++;
      else if (st === "expired") vencidos++;
      else if (st === "inapto") inaptos++;
      else semAso++;
    }
    return { total: employees.length, emDia, vencendo, vencidos, inaptos, semAso };
  }, [employees, latestByEmp]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (setorFilter !== "all" && e.setor !== setorFilter) return false;
      if (statusFilter !== "all" && asoStatus(latestByEmp.get(e.id) ?? null) !== statusFilter)
        return false;
      if (!t) return true;
      return (
        e.name.toLowerCase().includes(t) ||
        e.matricula.toLowerCase().includes(t) ||
        (e.setor ?? "").toLowerCase().includes(t) ||
        (e.funcao ?? "").toLowerCase().includes(t)
      );
    });
  }, [employees, search, setorFilter, statusFilter, latestByEmp]);

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <Stethoscope className="h-5 w-5 shrink-0 text-primary" />
            ASOs — Saúde Ocupacional
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Aptidão médica dos trabalhadores autorizados (NR-10 10.8.7) ·{" "}
            {isLoading ? "Carregando..." : `${employees.length} colaboradores ativos`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard label="Ativos" value={stats.total} />
        <StatCard label="Em dia" value={stats.emDia} tone="green" />
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
          label="Inaptos"
          value={stats.inaptos}
          tone={stats.inaptos > 0 ? "red" : "default"}
        />
        <StatCard
          label="Sem ASO"
          value={stats.semAso}
          tone={stats.semAso > 0 ? "amber" : "default"}
        />
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, matrícula, setor..."
            className="pl-8 w-full sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {setores.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ok">Em dia</SelectItem>
            <SelectItem value="expiring">Vencendo (≤ 60 dias)</SelectItem>
            <SelectItem value="expired">Vencido</SelectItem>
            <SelectItem value="inapto">Inapto</SelectItem>
            <SelectItem value="none">Sem ASO</SelectItem>
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
              Nenhum colaborador corresponde aos filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Último exame</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const last = latestByEmp.get(e.id) ?? null;
                    const status = asoStatus(last);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="max-w-[220px]">
                          <div className="font-medium leading-tight truncate" title={e.name}>
                            {e.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Mat. {e.matricula}
                            {e.funcao ? ` · ${e.funcao}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{e.setor ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {last ? (
                            <>
                              <div className="text-sm">{formatDatePtBR(last.exam_date)}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {ASO_TIPO_LABELS[last.tipo]}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {last ? formatDatePtBR(last.validity_date) : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {last ? (
                            <>
                              <div className="text-sm">{ASO_RESULTADO_LABELS[last.resultado]}</div>
                              {!last.apto_eletricidade && (
                                <div className="text-[11px] text-red-600 font-medium">
                                  Sem aptidão p/ eletricidade
                                </div>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={
                              status === "expired" || status === "none" || status === "inapto"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => setHistoryFor(e)}
                            title="Histórico de ASOs"
                            className={
                              status === "expired" || status === "inapto"
                                ? "bg-red-500 hover:bg-red-600 text-white"
                                : status === "none"
                                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                                  : ""
                            }
                          >
                            <Stethoscope className="h-4 w-4" />
                            <span className="hidden sm:inline">Histórico</span>
                          </Button>
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

      {historyFor && (
        <ASOHistoryDialog
          employee={historyFor}
          onOpenChange={(o) => {
            if (!o) setHistoryFor(null);
          }}
          canEdit={isStaff}
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
  tone?: "default" | "green" | "amber" | "red";
}) {
  const valueCls =
    tone === "red"
      ? "text-red-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "green"
          ? "text-emerald-600"
          : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold tabular-nums ${valueCls}`}>{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function ASOHistoryDialog({
  employee,
  onOpenChange,
  canEdit,
}: {
  employee: Employee;
  onOpenChange: (o: boolean) => void;
  canEdit: boolean;
}) {
  const { isAdmin, user } = useAuth();
  const { data: asos = [], isLoading } = useASOs(employee.id);
  const upsert = useUpsertASO();
  const deleteASO = useDeleteASO();

  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [validityDate, setValidityDate] = useState("");
  const [tipo, setTipo] = useState<string>("periodico");
  const [resultado, setResultado] = useState<string>("apto");
  const [aptoEletricidade, setAptoEletricidade] = useState<string>("sim");
  const [restricoes, setRestricoes] = useState("");
  const [medico, setMedico] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addASO(e: FormEvent) {
    e.preventDefault();
    if (!examDate) return toast.error("Informe a data do exame.");
    if (!validityDate) return toast.error("Informe a validade do ASO.");
    if (validityDate <= examDate)
      return toast.error("A validade deve ser posterior à data do exame.");
    if (file && file.type !== "application/pdf")
      return toast.error("O ASO deve ser um arquivo PDF.");
    if (file && file.size > 10 * 1024 * 1024) return toast.error("PDF excede 10 MB.");

    setBusy(true);
    try {
      let filePath: string | null = null;
      if (file) filePath = await uploadASOFile(file);

      await upsert.mutateAsync({
        employee_id: employee.id,
        exam_date: examDate,
        validity_date: validityDate,
        tipo: tipo as ASOTipo,
        resultado: resultado as ASOResultado,
        apto_eletricidade: aptoEletricidade === "sim",
        restricoes: restricoes.trim() || null,
        medico: medico.trim() || null,
        file_path: filePath,
        notes: notes.trim() || null,
        created_by_name: user?.user_metadata?.display_name ?? user?.email ?? null,
      });
      setRestricoes("");
      setMedico("");
      setNotes("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("ASO registrado.");
    } catch (err) {
      toast.error("Falha ao salvar: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(aso: ASO) {
    if (!window.confirm("Excluir este registro de ASO?")) return;
    try {
      await deleteASO.mutateAsync({ id: aso.id, file_path: aso.file_path });
      toast.success("ASO excluído.");
    } catch (err) {
      toast.error("Falha ao excluir: " + (err as Error).message);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-tight">
            <Stethoscope className="h-5 w-5 shrink-0 text-primary" />
            ASOs — {employee.name}
          </DialogTitle>
          <DialogDescription>
            Histórico de Atestados de Saúde Ocupacional. Mat. {employee.matricula}
            {employee.setor ? ` · ${employee.setor}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading && <Skeleton className="h-16" />}
          {!isLoading && asos.length === 0 && (
            <div className="rounded-md border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              Nenhum ASO registrado para este colaborador.
            </div>
          )}
          {asos.map((a) => (
            <div
              key={a.id}
              className="rounded-md border p-3 flex items-start justify-between gap-3 flex-wrap"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{formatDatePtBR(a.exam_date)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {ASO_TIPO_LABELS[a.tipo]}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${a.resultado === "inapto" || !a.apto_eletricidade ? "border-red-300 bg-red-50 text-red-700" : a.resultado === "apto_com_restricoes" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}
                  >
                    {ASO_RESULTADO_LABELS[a.resultado]}
                    {!a.apto_eletricidade ? " · sem aptidão p/ eletricidade" : ""}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Validade:{" "}
                  <strong className="text-foreground">{formatDatePtBR(a.validity_date)}</strong>
                  {a.medico && <> · Médico: {a.medico}</>}
                  {a.restricoes && <> · Restrições: {a.restricoes}</>}
                  {a.notes && <> · {a.notes}</>}
                </div>
              </div>
              <div className="flex gap-1">
                {a.file_path && (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={asoFileUrl(a.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      title="ASO (PDF)"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove(a)}
                    title="Excluir ASO"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {canEdit && (
          <form onSubmit={addASO} className="space-y-3 rounded-md border bg-muted/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Registrar novo ASO
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="aso-exam">Data do exame</Label>
                <Input
                  id="aso-exam"
                  type="date"
                  value={examDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aso-validity">Válido até</Label>
                <Input
                  id="aso-validity"
                  type="date"
                  value={validityDate}
                  onChange={(e) => setValidityDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="aso-tipo">Tipo de exame</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger id="aso-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASO_TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ASO_TIPO_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aso-result">Resultado</Label>
                <Select value={resultado} onValueChange={setResultado}>
                  <SelectTrigger id="aso-result">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASO_RESULTADOS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ASO_RESULTADO_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="aso-apto">Apto p/ trabalho em eletricidade</Label>
                <Select value={aptoEletricidade} onValueChange={setAptoEletricidade}>
                  <SelectTrigger id="aso-apto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aso-medico">Médico examinador (opcional)</Label>
                <Input
                  id="aso-medico"
                  value={medico}
                  onChange={(e) => setMedico(e.target.value)}
                  maxLength={150}
                  placeholder="Nome / CRM"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aso-restr">Restrições (opcional)</Label>
              <Input
                id="aso-restr"
                value={restricoes}
                onChange={(e) => setRestricoes(e.target.value)}
                maxLength={300}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="aso-file">Arquivo do ASO (PDF, opcional)</Label>
                <Input
                  id="aso-file"
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aso-notes">Observações (opcional)</Label>
                <Input
                  id="aso-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={300}
                />
              </div>
            </div>
            {file && (
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </div>
            )}
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={busy}
                className="bg-brand-gradient text-white shadow-brand"
              >
                <Plus className="h-4 w-4" /> {busy ? "Salvando..." : "Registrar ASO"}
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
