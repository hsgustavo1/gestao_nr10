import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { CheckCircle2, XCircle, MinusCircle, Upload, Pencil } from "lucide-react";
import { z } from "zod";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useEmployees, useNR10Trainings } from "@/lib/qualificacoes-queries";
import { NR10TrainingDialog } from "@/components/nr10-training-dialog";
import { trainingExpiryStatus, formatDatePtBR, type TrainingType, type NR10Training } from "@/lib/qualificacoes";
import { cn } from "@/lib/utils";

const nr10SearchSchema = z.object({
  view: z.enum(["matrix", "table"]).optional().default("matrix"),
  tipo: z.string().optional().default("all"),
  status: z.string().optional().default("all"),
  setor: z.string().optional().default("all"),
});

export const Route = createFileRoute("/qualificacoes/nr10")({
  validateSearch: nr10SearchSchema,
  component: NR10Page,
  head: () => ({ meta: [{ title: "Capacitações NR-10 — Pessoas" }] }),
});

const COLUMNS: { type: TrainingType; category: "formacao" | "reciclagem"; label: string }[] = [
  { type: "nr10_basico",              category: "formacao",   label: "NR-10 B.\nFormação" },
  { type: "nr10_basico",              category: "reciclagem", label: "NR-10 B.\nReciclagem" },
  { type: "nr10_areas_classificadas", category: "formacao",   label: "Áreas Class.\nFormação" },
  { type: "nr10_areas_classificadas", category: "reciclagem", label: "Áreas Class.\nReciclagem" },
  { type: "sep",                      category: "formacao",   label: "SEP\nFormação" },
  { type: "sep",                      category: "reciclagem", label: "SEP\nReciclagem" },
];

type DialogState = {
  employeeId: string;
  employeeName: string;
  type: TrainingType;
  category: "formacao" | "reciclagem";
  training?: NR10Training;
};

function StatusCell({ training, onClick, isRevalidatedByReciclagem }: {
  training?: NR10Training;
  onClick: () => void;
  isRevalidatedByReciclagem?: boolean;
}) {
  const { isStaff } = useAuth();
  const tdClass = cn("py-2 px-3 text-center", isStaff && "cursor-pointer hover:bg-muted/40");

  if (!training || !training.training_date) {
    return (
      <td onClick={isStaff ? onClick : undefined} className={tdClass}>
        <MinusCircle className="h-4 w-4 mx-auto text-muted-foreground/40" />
      </td>
    );
  }

  // If this formação is revalidated by a valid reciclagem, always show OK
  if (isRevalidatedByReciclagem) {
    return (
      <td onClick={isStaff ? onClick : undefined} className={tdClass} title={formatDatePtBR(training.training_date)}>
        <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500" />
      </td>
    );
  }

  const expiry = trainingExpiryStatus(training.training_date);
  return (
    <td onClick={isStaff ? onClick : undefined} className={tdClass} title={formatDatePtBR(training.training_date)}>
      {expiry === "ok" ? (
        <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500" />
      ) : expiry === "expiring" ? (
        <CheckCircle2 className="h-4 w-4 mx-auto text-amber-500" />
      ) : (
        <XCircle className="h-4 w-4 mx-auto text-destructive" />
      )}
    </td>
  );
}

function StatusIcon({ status, date }: { status: "ok" | "expiring" | "expired" | "none"; date?: string | null }) {
  const title = date ? formatDatePtBR(date) : "Sem registro";
  if (status === "ok") return <span title={title}><CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /></span>;
  if (status === "expiring") return <span title={title}><CheckCircle2 className="h-4 w-4 text-amber-500 mx-auto" /></span>;
  if (status === "expired") return <span title={title}><XCircle className="h-4 w-4 text-destructive mx-auto" /></span>;
  return <span title="Sem registro"><MinusCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" /></span>;
}

type EmployeeRow = {
  emp: { id: string; name: string; matricula: string; setor: string | null; [key: string]: unknown };
  nr10_basico: "ok" | "expiring" | "expired" | "none";
  nr10_areas_classificadas: "ok" | "expiring" | "expired" | "none";
  sep: "ok" | "expiring" | "expired" | "none";
  overall: "ok" | "expiring" | "expired" | "none";
  nr10_basicoFormDate: string | null;
  nr10_basicoRecDate: string | null;
  nr10_areas_classificadasFormDate: string | null;
  nr10_areas_classificadasRecDate: string | null;
  sepFormDate: string | null;
  sepRecDate: string | null;
};

function NR10Page() {
  const { isStaff, isAdmin } = useAuth();
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { data: trainings = [], isLoading: trLoading } = useNR10Trainings();
  const isLoading = empLoading || trLoading;
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const view = search.view ?? "matrix";

  const [nameSearch, setNameSearch] = useState("");
  const [tableSetor, setTableSetor] = useState(search.setor ?? "all");
  const [tableType, setTableType] = useState(search.tipo ?? "all");
  const [tableStatus, setTableStatus] = useState(search.status ?? "all");

  const trainingMap = useMemo(() => {
    const map = new Map<string, NR10Training>();
    for (const t of trainings) {
      map.set(`${t.employee_id}:${t.training_type}:${t.category}`, t);
    }
    return map;
  }, [trainings]);

  const tableData = useMemo((): EmployeeRow[] => {
    const rows: EmployeeRow[] = employees.map(emp => {
      function effectiveStatus(type: string): "ok" | "expiring" | "expired" | "none" {
        const formacao = trainingMap.get(`${emp.id}:${type}:formacao`);
        const reciclagem = trainingMap.get(`${emp.id}:${type}:reciclagem`);
        const recStatus = reciclagem?.training_date ? trainingExpiryStatus(reciclagem.training_date) : "none";
        if (recStatus === "ok" || recStatus === "expiring") return recStatus;
        return formacao?.training_date ? trainingExpiryStatus(formacao.training_date) : "none";
      }
      const s1 = effectiveStatus("nr10_basico");
      const s2 = effectiveStatus("nr10_areas_classificadas");
      const s3 = effectiveStatus("sep");
      const allStatuses = [s1, s2, s3];
      const overall: "ok" | "expiring" | "expired" | "none" =
        allStatuses.every(s => s === "ok") ? "ok"
        : allStatuses.some(s => s === "expired") ? "expired"
        : allStatuses.some(s => s === "expiring") ? "expiring"
        : "none";
      return {
        emp,
        nr10_basico: s1,
        nr10_areas_classificadas: s2,
        sep: s3,
        overall,
        nr10_basicoFormDate: trainingMap.get(`${emp.id}:nr10_basico:formacao`)?.training_date ?? null,
        nr10_basicoRecDate: trainingMap.get(`${emp.id}:nr10_basico:reciclagem`)?.training_date ?? null,
        nr10_areas_classificadasFormDate: trainingMap.get(`${emp.id}:nr10_areas_classificadas:formacao`)?.training_date ?? null,
        nr10_areas_classificadasRecDate: trainingMap.get(`${emp.id}:nr10_areas_classificadas:reciclagem`)?.training_date ?? null,
        sepFormDate: trainingMap.get(`${emp.id}:sep:formacao`)?.training_date ?? null,
        sepRecDate: trainingMap.get(`${emp.id}:sep:reciclagem`)?.training_date ?? null,
      };
    });

    return rows.filter(row => {
      if (nameSearch && !row.emp.name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      if (tableSetor !== "all" && row.emp.setor !== tableSetor) return false;
      if (tableType !== "all") {
        const typeStatus = row[tableType as keyof EmployeeRow] as string;
        if (tableStatus !== "all") {
          if (tableStatus === "ok" && typeStatus !== "ok") return false;
          if (tableStatus === "expiring" && typeStatus !== "expiring") return false;
          if (tableStatus === "expired" && typeStatus !== "expired") return false;
          if (tableStatus === "none" && typeStatus !== "none") return false;
        }
      } else if (tableStatus !== "all") {
        if (tableStatus === "ok" && row.overall !== "ok") return false;
        if (tableStatus === "expiring" && row.overall !== "expiring") return false;
        if (tableStatus === "expired" && row.overall !== "expired") return false;
        if (tableStatus === "none" && row.overall !== "none") return false;
        if (tableStatus === "non_compliant" && row.overall !== "expired" && row.overall !== "none") return false;
      }
      return true;
    });
  }, [employees, trainingMap, nameSearch, tableSetor, tableType, tableStatus]);

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Capacitações NR-10</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isStaff ? "Clique em uma célula para registrar ou editar o treinamento." : "Visão geral dos treinamentos NR-10."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => navigate({ search: (prev) => ({ ...prev, view: "matrix" }) })}
              className={`px-3 py-1.5 font-medium transition-colors ${view === "matrix" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              Matriz
            </button>
            <button
              type="button"
              onClick={() => navigate({ search: (prev) => ({ ...prev, view: "table" }) })}
              className={`px-3 py-1.5 font-medium transition-colors ${view === "table" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              Por Integrante
            </button>
          </div>
          {isAdmin && (
            <Button asChild className="bg-brand-gradient text-white shadow-brand hover:opacity-95 gap-1.5">
              <Link to="/admin/certificados/importar">
                <Upload className="h-4 w-4" />
                Importar certificados em lote
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* MATRIX VIEW */}
      {view === "matrix" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="py-3 px-3 text-left font-medium text-muted-foreground min-w-[180px]">Colaborador</th>
                <th className="py-2 px-2 text-left font-medium text-muted-foreground w-16">Mat.</th>
                {COLUMNS.map((c) => (
                  <th key={`${c.type}:${c.category}`} className="py-2 px-3 text-center font-medium text-muted-foreground whitespace-pre-line min-w-[80px]">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-3 px-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-12" /></td>
                      {COLUMNS.map((_, j) => (
                        <td key={j} className="py-2 px-3 text-center">
                          <Skeleton className="h-4 w-4 mx-auto rounded-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : employees.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-muted/20">
                      <td className="py-3 px-3 font-medium">{emp.name}</td>
                      <td className="py-2 px-2 text-muted-foreground">{emp.matricula}</td>
                      {COLUMNS.map((col) => {
                        const training = trainingMap.get(`${emp.id}:${col.type}:${col.category}`);

                        let isRevalidatedByReciclagem = false;
                        if (col.category === "formacao") {
                          const reciclagem = trainingMap.get(`${emp.id}:${col.type}:reciclagem`);
                          if (reciclagem?.training_date) {
                            const recStatus = trainingExpiryStatus(reciclagem.training_date);
                            isRevalidatedByReciclagem = recStatus === "ok" || recStatus === "expiring";
                          }
                        }

                        return (
                          <StatusCell
                            key={`${col.type}:${col.category}`}
                            training={training}
                            isRevalidatedByReciclagem={isRevalidatedByReciclagem}
                            onClick={() => setDialog({
                              employeeId: emp.id,
                              employeeName: emp.name,
                              type: col.type,
                              category: col.category,
                              training,
                            })}
                          />
                        );
                      })}
                    </tr>
                  ))
              }
            </tbody>
          </table>
          {!isLoading && employees.length === 0 && (
            <p className="py-12 text-center text-muted-foreground text-sm">
              Nenhum colaborador cadastrado. Importe a planilha ou adicione colaboradores manualmente.
            </p>
          )}
        </div>
      )}

      {/* TABLE VIEW — Per-employee */}
      {view === "table" && (
        <>
          {/* Filters bar */}
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <Input
              placeholder="Buscar por nome..."
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
              className="h-8 text-xs w-48"
            />
            <Select value={tableSetor} onValueChange={setTableSetor}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue placeholder="Equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as equipes</SelectItem>
                {["ELE","GER","INS","MEC","ADM","OPE","OUT"].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tableType} onValueChange={setTableType}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="Tipo de treino" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="nr10_basico">NR-10 Básico</SelectItem>
                <SelectItem value="nr10_areas_classificadas">Áreas Classificadas</SelectItem>
                <SelectItem value="sep">SEP</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tableStatus} onValueChange={setTableStatus}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ok">Conforme</SelectItem>
                <SelectItem value="expiring">Vencendo</SelectItem>
                <SelectItem value="expired">Vencido</SelectItem>
                <SelectItem value="non_compliant">Não conforme</SelectItem>
                <SelectItem value="none">Sem registro</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {tableData.length} integrante{tableData.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="py-3 px-3 text-left font-medium text-muted-foreground min-w-[180px]">Integrante</th>
                  <th className="py-2 px-2 text-left font-medium text-muted-foreground w-16">Mat.</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground w-16">Setor</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground" colSpan={2}>NR-10 Básico</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground" colSpan={2}>Áreas Class.</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground" colSpan={2}>SEP</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground">Status</th>
                  {isStaff && <th className="py-2 font-medium text-muted-foreground w-10"></th>}
                </tr>
                <tr className="border-b bg-muted/10">
                  <th colSpan={3} />
                  <th className="py-1 px-2 text-center text-[10px] text-muted-foreground font-normal">Form.</th>
                  <th className="py-1 px-2 text-center text-[10px] text-muted-foreground font-normal">Recic.</th>
                  <th className="py-1 px-2 text-center text-[10px] text-muted-foreground font-normal">Form.</th>
                  <th className="py-1 px-2 text-center text-[10px] text-muted-foreground font-normal">Recic.</th>
                  <th className="py-1 px-2 text-center text-[10px] text-muted-foreground font-normal">Form.</th>
                  <th className="py-1 px-2 text-center text-[10px] text-muted-foreground font-normal">Recic.</th>
                  <th />
                  {isStaff && <th />}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-3 px-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-12" /></td>
                      <td className="py-2 px-3"><Skeleton className="h-4 w-8" /></td>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="py-2 px-3 text-center"><Skeleton className="h-4 w-4 mx-auto rounded-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : tableData.length === 0 ? (
                  <tr>
                    <td colSpan={isStaff ? 11 : 10} className="py-12 text-center text-muted-foreground">
                      Nenhum integrante encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  tableData.map(row => {
                    const overallVariant = row.overall === "ok" ? "default" : row.overall === "expiring" ? "secondary" : row.overall === "expired" ? "destructive" : "outline";
                    const overallLabel = row.overall === "ok" ? "Conforme" : row.overall === "expiring" ? "Vencendo" : row.overall === "expired" ? "Vencido" : "Sem registro";
                    return (
                      <tr key={row.emp.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3 font-medium">{row.emp.name}</td>
                        <td className="py-2 px-2 text-muted-foreground">{row.emp.matricula}</td>
                        <td className="py-2 px-3">
                          {row.emp.setor && <Badge variant="outline" className="text-[10px]">{row.emp.setor as string}</Badge>}
                        </td>
                        {/* NR-10 Básico */}
                        <td className="py-2 px-3 text-center">
                          <StatusIcon
                            status={row.nr10_basicoFormDate ? trainingExpiryStatus(row.nr10_basicoFormDate) : "none"}
                            date={row.nr10_basicoFormDate}
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <StatusIcon
                            status={row.nr10_basicoRecDate ? trainingExpiryStatus(row.nr10_basicoRecDate) : "none"}
                            date={row.nr10_basicoRecDate}
                          />
                        </td>
                        {/* Áreas Class. */}
                        <td className="py-2 px-3 text-center">
                          <StatusIcon
                            status={row.nr10_areas_classificadasFormDate ? trainingExpiryStatus(row.nr10_areas_classificadasFormDate) : "none"}
                            date={row.nr10_areas_classificadasFormDate}
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <StatusIcon
                            status={row.nr10_areas_classificadasRecDate ? trainingExpiryStatus(row.nr10_areas_classificadasRecDate) : "none"}
                            date={row.nr10_areas_classificadasRecDate}
                          />
                        </td>
                        {/* SEP */}
                        <td className="py-2 px-3 text-center">
                          <StatusIcon
                            status={row.sepFormDate ? trainingExpiryStatus(row.sepFormDate) : "none"}
                            date={row.sepFormDate}
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <StatusIcon
                            status={row.sepRecDate ? trainingExpiryStatus(row.sepRecDate) : "none"}
                            date={row.sepRecDate}
                          />
                        </td>
                        {/* Status geral */}
                        <td className="py-2 px-3 text-center">
                          <Badge variant={overallVariant} className="text-[10px]">{overallLabel}</Badge>
                        </td>
                        {isStaff && (
                          <td className="py-2 px-2">
                            <Button
                              size="icon" variant="ghost" className="h-6 w-6"
                              title="Editar treinamentos"
                              onClick={() => setDialog({
                                employeeId: row.emp.id,
                                employeeName: row.emp.name,
                                type: "nr10_basico",
                                category: "formacao",
                                training: trainingMap.get(`${row.emp.id}:nr10_basico:formacao`),
                              })}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Dialog — unchanged */}
      {dialog && (
        <NR10TrainingDialog
          open={!!dialog}
          onOpenChange={(v) => { if (!v) setDialog(null); }}
          employeeId={dialog.employeeId}
          employeeName={dialog.employeeName}
          defaultType={dialog.type}
          defaultCategory={dialog.category}
          training={dialog.training}
        />
      )}
    </PageShell>
  );
}
