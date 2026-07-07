import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, XCircle, MinusCircle, Clock, CircleDashed, Upload, Users, GraduationCap } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { getPessoasAccess } from "@/lib/tenancy-gates";
import { useEmployees, useNR10Trainings } from "@/lib/qualificacoes-queries";
import { NR10TrainingDialog } from "@/components/nr10-training-dialog";
import { NR10TurmaDialog } from "@/components/nr10-turma-dialog";
import {
  reciclagemStatus,
  trainingExpiryStatus,
  requiredTrainings,
  formatDatePtBR,
  TRAINING_LABELS,
  SETOR_FULL_NAMES,
  type TrainingType,
  type NR10Training,
} from "@/lib/qualificacoes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/qualificacoes/nr10")({
  validateSearch: (search: Record<string, unknown>) => ({
    tipo: (search.tipo as string | undefined) ?? "all",
    status: (search.status as string | undefined) ?? "all",
    setor: (search.setor as string | undefined) ?? "all",
  }),
  component: NR10Page,
  head: () => ({ meta: [{ title: "Capacitações NR-10 — Pessoas" }] }),
});

type DialogState = {
  employeeId: string;
  employeeName: string;
  type: TrainingType;
  category: "formacao" | "reciclagem";
  training?: NR10Training;
};

/** Calcula a data de vencimento (formação + 2 anos) em formato pt-BR. */
function vencimentoStr(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setFullYear(d.getFullYear() + 2);
  return formatDatePtBR(d.toISOString().slice(0, 10));
}

/** Ícone de formação: perene — nunca X. */
function FormacaoIcon({ date, hasCertificate }: { date?: string | null; hasCertificate?: boolean }) {
  if (!date) return <span title="Sem registro" className="flex justify-center"><MinusCircle className="h-4 w-4 text-muted-foreground/40" /></span>;
  const noCert = hasCertificate === false;
  const tooltip = noCert ? `${formatDatePtBR(date)} · Certificado não anexado` : formatDatePtBR(date);
  return (
    <span title={tooltip} className="flex justify-center">
      <CheckCircle2 className={`h-4 w-4 ${noCert ? "text-amber-500" : "text-emerald-500"}`} />
    </span>
  );
}

/**
 * Ícone de reciclagem.
 * - Reciclagem feita → CheckCircle2 (verde ou amarelo se sem certificado)
 * - Válido pela formação (sem reciclagem) → Clock na cor do status
 * - Vencido/expirando → XCircle / AlertTriangle
 * - Sem dado → MinusCircle
 */
function ReciclagemCell({
  reciclagemDate,
  formacaoDate,
  hasCertificate,
  onClick,
}: {
  reciclagemDate?: string | null;
  formacaoDate?: string | null;
  hasCertificate?: boolean;
  onClick: () => void;
}) {
  const { isStaff, isAdmin, hasEntitlement, hasOrgRole } = useAuth();
  const { canEdit } = getPessoasAccess({ isStaff, isAdmin, hasEntitlement, hasOrgRole });
  const tdClass = cn("py-2 px-3 text-center", canEdit && "cursor-pointer hover:bg-muted/40");

  if (reciclagemDate) {
    // Reciclagem realizada
    const status = trainingExpiryStatus(reciclagemDate);
    const certSuffix = hasCertificate === false ? " · Certificado não anexado" : "";
    if (status === "ok") {
      const noCert = hasCertificate === false;
      return (
        <td onClick={canEdit ? onClick : undefined} className={tdClass}>
          <span title={`${formatDatePtBR(reciclagemDate)}${certSuffix}`} className="flex justify-center">
            <CheckCircle2 className={`h-4 w-4 ${noCert ? "text-amber-500" : "text-emerald-500"}`} />
          </span>
        </td>
      );
    }
    if (status === "expiring") {
      return (
        <td onClick={canEdit ? onClick : undefined} className={tdClass}>
          <span title={`${formatDatePtBR(reciclagemDate)} · Vence em breve${certSuffix}`} className="flex justify-center">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </span>
        </td>
      );
    }
    // expired
    return (
      <td onClick={canEdit ? onClick : undefined} className={tdClass}>
        <span title={`${formatDatePtBR(reciclagemDate)} · Vencida${certSuffix}`} className="flex justify-center">
          <XCircle className="h-4 w-4 text-destructive" />
        </span>
      </td>
    );
  }

  if (formacaoDate) {
    // Sem reciclagem — vigência vem da formação
    const status = trainingExpiryStatus(formacaoDate);
    const venc = vencimentoStr(formacaoDate);
    if (status === "expired") {
      return (
        <td onClick={canEdit ? onClick : undefined} className={tdClass}>
          <span title={`Reciclagem vencida · base: ${formatDatePtBR(formacaoDate)}`} className="flex justify-center">
            <XCircle className="h-4 w-4 text-destructive" />
          </span>
        </td>
      );
    }
    const color = status === "expiring" ? "text-amber-500" : "text-emerald-500";
    return (
      <td onClick={canEdit ? onClick : undefined} className={tdClass}>
        <span title={`Sem reciclagem · válido pela formação até ${venc}`} className="flex justify-center">
          <Clock className={`h-4 w-4 ${color}`} />
        </span>
      </td>
    );
  }

  return (
    <td onClick={canEdit ? onClick : undefined} className={tdClass}>
      <span title="Sem registro" className="flex justify-center">
        <MinusCircle className="h-4 w-4 text-muted-foreground/40" />
      </span>
    </td>
  );
}

/** Célula para treinamento não obrigatório (ex: GER + Áreas Classificadas). */
function NaoObrigatorioCell({ hasTraining, date, onClick }: { hasTraining: boolean; date?: string | null; onClick: () => void }) {
  const { isStaff, isAdmin, hasEntitlement, hasOrgRole } = useAuth();
  const { canEdit } = getPessoasAccess({ isStaff, isAdmin, hasEntitlement, hasOrgRole });
  const tdClass = cn("py-2 px-3 text-center", canEdit && "cursor-pointer hover:bg-muted/40");
  if (hasTraining && date) {
    return (
      <td onClick={canEdit ? onClick : undefined} className={tdClass}>
        <span title={`${formatDatePtBR(date)} · Não obrigatório para esta equipe`} className="flex justify-center">
          <CheckCircle2 className="h-4 w-4 text-emerald-500/60" />
        </span>
      </td>
    );
  }
  return (
    <td className="py-2 px-3 text-center">
      <span title="Não obrigatório para esta equipe" className="flex justify-center">
        <CircleDashed className="h-4 w-4 text-muted-foreground/30" />
      </span>
    </td>
  );
}

/** Célula clicável de formação. */
function FormacaoCell({
  training,
  onClick,
}: {
  training?: NR10Training;
  onClick: () => void;
}) {
  const { isStaff, isAdmin, hasEntitlement, hasOrgRole } = useAuth();
  const { canEdit } = getPessoasAccess({ isStaff, isAdmin, hasEntitlement, hasOrgRole });
  const tdClass = cn("py-2 px-3 text-center", canEdit && "cursor-pointer hover:bg-muted/40");
  const hasCertificate = training ? !!training.art_arquivo_url : undefined;
  return (
    <td onClick={canEdit ? onClick : undefined} className={tdClass}>
      <FormacaoIcon date={training?.training_date} hasCertificate={hasCertificate} />
    </td>
  );
}

type EmployeeRow = {
  emp: {
    id: string;
    name: string;
    matricula: string;
    setor: string | null;
    reciclagem_requerida?: boolean;
    reciclagem_motivo?: string | null;
    [key: string]: unknown;
  };
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
  const { isStaff, isAdmin, hasEntitlement, hasOrgRole } = useAuth();
  const { canEdit, canAdmin } = getPessoasAccess({ isStaff, isAdmin, hasEntitlement, hasOrgRole });
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { data: trainings = [], isLoading: trLoading } = useNR10Trainings();
  const isLoading = empLoading || trLoading;
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [turmaOpen, setTurmaOpen] = useState(false);

  const searchParams = Route.useSearch();
  const [nameSearch, setNameSearch] = useState("");
  const [tableSetor, setTableSetor] = useState(searchParams.setor ?? "all");
  const [tableType, setTableType] = useState(searchParams.tipo ?? "all");
  const [tableStatus, setTableStatus] = useState(searchParams.status ?? "all");

  const trainingMap = useMemo(() => {
    const map = new Map<string, NR10Training>();
    for (const t of trainings) {
      map.set(`${t.employee_id}:${t.training_type}:${t.category}`, t);
    }
    return map;
  }, [trainings]);

  const tableData = useMemo((): EmployeeRow[] => {
    const rows: EmployeeRow[] = employees.map((emp) => {
      function effectiveStatus(type: string): "ok" | "expiring" | "expired" | "none" {
        const formacaoDate = trainingMap.get(`${emp.id}:${type}:formacao`)?.training_date ?? null;
        const reciclagemDate = trainingMap.get(`${emp.id}:${type}:reciclagem`)?.training_date ?? null;
        if (!formacaoDate) return "none";
        return reciclagemStatus(reciclagemDate, formacaoDate);
      }
      const s1 = effectiveStatus("nr10_basico");
      const s2 = effectiveStatus("nr10_areas_classificadas");
      const s3 = effectiveStatus("sep");
      const required = requiredTrainings(emp.setor);
      const requiredStatuses = required.map((t) =>
        t === "nr10_basico" ? s1 : t === "nr10_areas_classificadas" ? s2 : s3
      );
      const overall: "ok" | "expiring" | "expired" | "none" = requiredStatuses.every((s) => s === "ok")
        ? "ok"
        : requiredStatuses.some((s) => s === "expired")
          ? "expired"
          : requiredStatuses.some((s) => s === "expiring")
            ? "expiring"
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

    return rows.filter((row) => {
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

  function openDialog(emp: EmployeeRow["emp"], type: TrainingType, category: "formacao" | "reciclagem") {
    setDialog({
      employeeId: emp.id,
      employeeName: emp.name,
      type,
      category,
      training: trainingMap.get(`${emp.id}:${type}:${category}`),
    });
  }

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Capacitações NR-10</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {canEdit
              ? "Clique em uma célula para registrar ou editar o treinamento."
              : "Visão geral dos treinamentos NR-10."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link to="/qualificacoes/turmas">
              <GraduationCap className="h-4 w-4" />
              Turmas
            </Link>
          </Button>
          {canEdit && (
            <Button variant="outline" className="gap-1.5" onClick={() => setTurmaOpen(true)}>
              <Users className="h-4 w-4" />
              Registrar turma
            </Button>
          )}
          {canAdmin && (
            <Button
              asChild
              className="bg-brand-gradient text-white shadow-brand hover:opacity-95 gap-1.5"
            >
              <Link to="/admin/certificados/importar">
                <Upload className="h-4 w-4" />
                Importar certificados em lote
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Input
          placeholder="Buscar por nome..."
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          className="h-8 text-xs w-48"
        />
        <Select value={tableSetor} onValueChange={setTableSetor}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as equipes</SelectItem>
            {([
              ["ELE", "ELE — Elétrica"],
              ["INS", "INS — Instrumentação"],
              ["GER", "GER — Geração de energia"],
              ["ADM", "ADM — Administrativo"],
            ] as [string, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tableType} onValueChange={setTableType}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(["nr10_basico", "nr10_areas_classificadas", "sep"] as TrainingType[]).map((t) => (
              <SelectItem key={t} value={t}>{TRAINING_LABELS[t]}</SelectItem>
            ))}
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
          {tableData.length} colaborador{tableData.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="py-3 px-3 text-left font-medium text-muted-foreground min-w-[180px]">
                Colaborador
              </th>
              <th className="py-2 px-2 text-left font-medium text-muted-foreground w-16">Mat.</th>
              <th className="py-2 px-3 text-left font-medium text-muted-foreground w-16">Equipe</th>
              <th className="py-2 px-3 text-center font-medium text-muted-foreground" colSpan={2}>
                {TRAINING_LABELS.nr10_basico}
              </th>
              <th className="py-2 px-3 text-center font-medium text-muted-foreground" colSpan={2}>
                {TRAINING_LABELS.nr10_areas_classificadas}
              </th>
              <th className="py-2 px-3 text-center font-medium text-muted-foreground" colSpan={2}>
                {TRAINING_LABELS.sep}
              </th>
              <th className="py-2 px-3 text-center font-medium text-muted-foreground">Status</th>
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
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="py-3 px-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="py-2 px-2"><Skeleton className="h-4 w-12" /></td>
                  <td className="py-2 px-3"><Skeleton className="h-4 w-8" /></td>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="py-2 px-3 text-center">
                      <Skeleton className="h-4 w-4 mx-auto rounded-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : tableData.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-muted-foreground">
                  Nenhum colaborador encontrado com os filtros selecionados.
                </td>
              </tr>
            ) : (
              tableData.map((row) => {
                const overallVariant =
                  row.overall === "ok" ? "default"
                  : row.overall === "expiring" ? "secondary"
                  : row.overall === "expired" ? "destructive"
                  : "outline";
                const overallLabel =
                  row.overall === "ok" ? "Conforme"
                  : row.overall === "expiring" ? "Vencendo"
                  : row.overall === "expired" ? "Vencido"
                  : "Sem registro";
                return (
                  <tr key={row.emp.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-3 font-medium">
                      {row.emp.name}
                      {row.emp.reciclagem_requerida && (
                        <span
                          className="ml-1.5 inline-flex items-center rounded-full border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700"
                          title={`Reciclagem extraordinária pendente${row.emp.reciclagem_motivo ? `: ${row.emp.reciclagem_motivo}` : ""} (NR-10 10.8.8)`}
                        >
                          Reciclagem
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{row.emp.matricula}</td>
                    <td className="py-2 px-3">
                      {row.emp.setor && (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          title={SETOR_FULL_NAMES[row.emp.setor as string] ?? row.emp.setor}
                        >
                          {row.emp.setor as string}
                        </Badge>
                      )}
                    </td>
                    {/* NR-10 Básico */}
                    <FormacaoCell
                      training={trainingMap.get(`${row.emp.id}:nr10_basico:formacao`)}
                      onClick={() => openDialog(row.emp, "nr10_basico", "formacao")}
                    />
                    <ReciclagemCell
                      reciclagemDate={row.nr10_basicoRecDate}
                      formacaoDate={row.nr10_basicoFormDate}
                      hasCertificate={trainingMap.get(`${row.emp.id}:nr10_basico:reciclagem`) ? !!trainingMap.get(`${row.emp.id}:nr10_basico:reciclagem`)!.art_arquivo_url : undefined}
                      onClick={() => openDialog(row.emp, "nr10_basico", "reciclagem")}
                    />
                    {/* Áreas Classificadas */}
                    {requiredTrainings(row.emp.setor as string).includes("nr10_areas_classificadas") ? (
                      <>
                        <FormacaoCell
                          training={trainingMap.get(`${row.emp.id}:nr10_areas_classificadas:formacao`)}
                          onClick={() => openDialog(row.emp, "nr10_areas_classificadas", "formacao")}
                        />
                        <ReciclagemCell
                          reciclagemDate={row.nr10_areas_classificadasRecDate}
                          formacaoDate={row.nr10_areas_classificadasFormDate}
                          hasCertificate={trainingMap.get(`${row.emp.id}:nr10_areas_classificadas:reciclagem`) ? !!trainingMap.get(`${row.emp.id}:nr10_areas_classificadas:reciclagem`)!.art_arquivo_url : undefined}
                          onClick={() => openDialog(row.emp, "nr10_areas_classificadas", "reciclagem")}
                        />
                      </>
                    ) : (
                      <>
                        <NaoObrigatorioCell
                          hasTraining={!!row.nr10_areas_classificadasFormDate}
                          date={row.nr10_areas_classificadasFormDate}
                          onClick={() => openDialog(row.emp, "nr10_areas_classificadas", "formacao")}
                        />
                        <NaoObrigatorioCell
                          hasTraining={!!row.nr10_areas_classificadasRecDate}
                          date={row.nr10_areas_classificadasRecDate}
                          onClick={() => openDialog(row.emp, "nr10_areas_classificadas", "reciclagem")}
                        />
                      </>
                    )}
                    {/* SEP */}
                    <FormacaoCell
                      training={trainingMap.get(`${row.emp.id}:sep:formacao`)}
                      onClick={() => openDialog(row.emp, "sep", "formacao")}
                    />
                    <ReciclagemCell
                      reciclagemDate={row.sepRecDate}
                      formacaoDate={row.sepFormDate}
                      hasCertificate={trainingMap.get(`${row.emp.id}:sep:reciclagem`) ? !!trainingMap.get(`${row.emp.id}:sep:reciclagem`)!.art_arquivo_url : undefined}
                      onClick={() => openDialog(row.emp, "sep", "reciclagem")}
                    />
                    {/* Status geral */}
                    <td className="py-2 px-3 text-center">
                      <Badge variant={overallVariant} className="text-[10px]">
                        {overallLabel}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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

      {canEdit && turmaOpen && <NR10TurmaDialog open={turmaOpen} onOpenChange={setTurmaOpen} />}
    </PageShell>
  );
}
