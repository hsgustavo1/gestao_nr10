import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { z } from "zod";
import { Plus, Pencil, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useEmployees, useWorkInstructions, useITTrainings } from "@/lib/qualificacoes-queries";
import { InstructionDialog } from "@/components/instruction-dialog";
import { ITTrainingDialog } from "@/components/it-training-dialog";
import { formatDatePtBR } from "@/lib/qualificacoes";
import type { WorkInstruction } from "@/lib/qualificacoes";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const instrSearchSchema = z.object({
  view: z.enum(["matrix", "table"]).optional().default("matrix"),
  setor: z.string().optional().default("all"),
  it: z.string().optional().default("all"),
  status: z.string().optional().default("all"),
});

export const Route = createFileRoute("/qualificacoes/instrucoes")({
  validateSearch: instrSearchSchema,
  component: InstrucoesPage,
  head: () => ({ meta: [{ title: "Instruções de Trabalho — Qualificações" }] }),
});

type EmpSummary = {
  emp: { id: string; name: string; matricula?: string; setor?: string };
  ok: number;
  pendente: number;
  vencido: number;
  overall: "ok" | "pendente" | "vencido" | "none";
  filteredItStatus: string | null;
  filteredItDate: string | null;
};

function InstrucoesPage() {
  const { isStaff, isAdmin } = useAuth();
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { data: instructions = [], isLoading: instrLoading } = useWorkInstructions();
  const { data: itTrainings = [], isLoading: itLoading } = useITTrainings();
  const isLoading = empLoading || instrLoading || itLoading;

  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const view = search.view ?? "matrix";

  const [instrDialog, setInstrDialog] = useState<{ open: boolean; instruction?: WorkInstruction }>({ open: false });
  const [itDialog, setItDialog] = useState<{
    open: boolean;
    employeeId: string;
    employeeName: string;
    instructionId: string;
    instructionCode: string;
    currentStatus?: string;
    currentDate?: string;
  } | null>(null);

  const [nameSearch, setNameSearch] = useState("");
  const [tableSetor, setTableSetor] = useState(search.setor ?? "all");
  const [tableIt, setTableIt] = useState(search.it ?? "all");
  const [tableStatus, setTableStatus] = useState(search.status ?? "all");

  // Map "employeeId:instructionId" → { status, conclusao_date }
  const itMap = useMemo(() => {
    const map = new Map<string, { status: string; conclusao_date: string | null }>();
    for (const t of itTrainings as Array<{ employee_id: string; instruction_id: string; status: string; conclusao_date: string | null }>) {
      map.set(`${t.employee_id}:${t.instruction_id}`, { status: t.status, conclusao_date: t.conclusao_date });
    }
    return map;
  }, [itTrainings]);

  const tableData = useMemo((): EmpSummary[] => {
    const selectedInstr = tableIt !== "all" ? instructions.find(i => i.id === tableIt) : null;

    const rows: EmpSummary[] = (employees as Array<{ id: string; name: string; matricula?: string; setor?: string }>).map(emp => {
      let ok = 0, pendente = 0, vencido = 0;
      for (const instr of instructions) {
        const record = itMap.get(`${emp.id}:${instr.id}`);
        if (!record || record.status === "pendente") pendente++;
        else if (record.status === "ok") ok++;
        else vencido++;
      }
      const overall: EmpSummary["overall"] = vencido > 0 ? "vencido" : pendente > 0 ? "pendente" : ok > 0 ? "ok" : "none";
      const filteredRecord = selectedInstr ? itMap.get(`${emp.id}:${selectedInstr.id}`) : null;
      return {
        emp,
        ok,
        pendente,
        vencido,
        overall,
        filteredItStatus: filteredRecord?.status ?? (selectedInstr ? "pendente" : null),
        filteredItDate: filteredRecord?.conclusao_date ?? null,
      };
    });

    return rows.filter(row => {
      if (nameSearch && !row.emp.name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      if (tableSetor !== "all" && row.emp.setor !== tableSetor) return false;
      if (tableIt !== "all" && tableStatus !== "all") {
        // Filter by specific IT status when an IT is selected
        const itStatus = row.filteredItStatus ?? "pendente";
        if (tableStatus === "ok" && itStatus !== "ok") return false;
        if (tableStatus === "pendente" && itStatus !== "pendente") return false;
        if (tableStatus === "vencido" && itStatus !== "vencido") return false;
      } else if (tableStatus !== "all") {
        if (tableStatus === "ok" && row.overall !== "ok") return false;
        if (tableStatus === "pendente" && row.overall !== "pendente") return false;
        if (tableStatus === "vencido" && row.overall !== "vencido") return false;
      }
      return true;
    });
  }, [employees, itMap, instructions, nameSearch, tableSetor, tableIt, tableStatus]);

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Instruções de Trabalho</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isStaff ? "Clique em uma célula para registrar a conclusão." : "Matriz de conclusão por colaborador."}
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
            <Button onClick={() => setInstrDialog({ open: true, instruction: undefined })} variant="outline" size="sm">
              <Plus className="h-4 w-4" /> Nova IT
            </Button>
          )}
        </div>
      </div>

      {/* IT chips — show in both views */}
      {instructions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {instructions.map((it) => (
            <div key={it.id} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium bg-muted/30">
              <span className="font-mono">{it.code}</span>
              {it.title && <span className="text-muted-foreground">— {it.title}</span>}
              {isAdmin && (
                <button
                  type="button"
                  className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setInstrDialog({ open: true, instruction: it })}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Separator className="mb-4" />

      {/* MATRIX VIEW */}
      {view === "matrix" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="py-3 px-3 text-left font-medium text-muted-foreground min-w-[180px]">Colaborador</th>
                <th className="py-2 px-2 text-left font-medium text-muted-foreground w-16">Mat.</th>
                {instructions.map((it) => (
                  <th key={it.id} className="py-2 px-3 text-center font-medium text-muted-foreground min-w-[70px] font-mono">
                    {it.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-3 px-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-10" /></td>
                      {Array.from({ length: Math.max(instructions.length, 3) }).map((_, j) => (
                        <td key={j} className="py-2 px-3 text-center">
                          <Skeleton className="h-4 w-4 mx-auto rounded-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : (employees as Array<{ id: string; name: string; matricula?: string; setor?: string }>).map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-muted/20">
                      <td className="py-3 px-3 font-medium">{emp.name}</td>
                      <td className="py-2 px-2 text-muted-foreground">{emp.matricula}</td>
                      {instructions.map((it) => {
                        const record = itMap.get(`${emp.id}:${it.id}`);
                        return (
                          <td
                            key={it.id}
                            className={cn(
                              "py-2 px-3 text-center",
                              isStaff && "cursor-pointer hover:bg-muted/40"
                            )}
                            title={record?.conclusao_date ? formatDatePtBR(record.conclusao_date) : "Sem registro"}
                            onClick={isStaff ? () => setItDialog({
                              open: true,
                              employeeId: emp.id,
                              employeeName: emp.name,
                              instructionId: it.id,
                              instructionCode: it.code,
                              currentStatus: record?.status,
                              currentDate: record?.conclusao_date ?? undefined,
                            }) : undefined}
                          >
                            {!record || record.status === "pendente" ? (
                              <MinusCircle className="h-4 w-4 mx-auto text-muted-foreground/40" />
                            ) : record.status === "ok" ? (
                              <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 mx-auto text-destructive" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
              }
            </tbody>
          </table>
          {!isLoading && instructions.length === 0 && (
            <p className="py-12 text-center text-muted-foreground text-sm">
              {isAdmin
                ? "Nenhuma instrução cadastrada. Use \"Nova IT\" para adicionar ou importe a planilha."
                : "Nenhuma instrução de trabalho cadastrada."}
            </p>
          )}
        </div>
      )}

      {/* PER-EMPLOYEE TABLE VIEW */}
      {view === "table" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <Input
              placeholder="Buscar por nome..."
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
              className="h-8 text-xs w-48"
            />
            <Select value={tableSetor} onValueChange={setTableSetor}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as equipes</SelectItem>
                {["ELE", "GER", "INS", "MEC", "ADM", "OPE", "OUT"].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tableIt} onValueChange={setTableIt}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Instrução" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ITs</SelectItem>
                {instructions.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.code}{i.title ? ` — ${i.title}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tableStatus} onValueChange={setTableStatus}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ok">Conforme (OK)</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
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
                  <th className="py-2 px-3 text-center font-medium text-emerald-600">OK</th>
                  <th className="py-2 px-3 text-center font-medium text-amber-500">Pendente</th>
                  <th className="py-2 px-3 text-center font-medium text-destructive">Vencido</th>
                  {tableIt !== "all" && (
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground">
                      {instructions.find(i => i.id === tableIt)?.code ?? "IT"}
                    </th>
                  )}
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground">Status</th>
                  {isStaff && <th className="py-2 w-10" />}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="py-3 px-3"><Skeleton className="h-4 w-16" /></td>
                      ))}
                    </tr>
                  ))
                ) : tableData.length === 0 ? (
                  <tr>
                    <td colSpan={isStaff ? 9 : 8} className="py-12 text-center text-muted-foreground">
                      Nenhum integrante encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  tableData.map(row => {
                    const overallVariant =
                      row.overall === "ok" ? "default" :
                      row.overall === "vencido" ? "destructive" :
                      row.overall === "pendente" ? "secondary" :
                      "outline";
                    const overallLabel =
                      row.overall === "ok" ? "Conforme" :
                      row.overall === "vencido" ? "Vencido" :
                      row.overall === "pendente" ? "Pendente" :
                      "Sem registro";
                    return (
                      <tr key={row.emp.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3 font-medium">{row.emp.name}</td>
                        <td className="py-2 px-2 text-muted-foreground">{row.emp.matricula}</td>
                        <td className="py-2 px-3">
                          {row.emp.setor && (
                            <Badge variant="outline" className="text-[10px]">{row.emp.setor}</Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-semibold text-emerald-600">{row.ok}</td>
                        <td className="py-2 px-3 text-center font-semibold text-amber-500">{row.pendente}</td>
                        <td className="py-2 px-3 text-center font-semibold text-destructive">{row.vencido}</td>
                        {tableIt !== "all" && (
                          <td className="py-2 px-3 text-center">
                            {row.filteredItStatus === "ok" ? (
                              <div className="flex flex-col items-center">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                {row.filteredItDate && (
                                  <span className="text-[10px] text-muted-foreground">{formatDatePtBR(row.filteredItDate)}</span>
                                )}
                              </div>
                            ) : row.filteredItStatus === "vencido" ? (
                              <XCircle className="h-4 w-4 mx-auto text-destructive" />
                            ) : (
                              <MinusCircle className="h-4 w-4 mx-auto text-muted-foreground/40" />
                            )}
                          </td>
                        )}
                        <td className="py-2 px-3 text-center">
                          <Badge variant={overallVariant} className="text-[10px]">{overallLabel}</Badge>
                        </td>
                        {isStaff && (
                          <td className="py-2 px-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => {
                                // Open dialog for filtered instruction, or first non-OK instruction
                                const targetInstr = tableIt !== "all"
                                  ? instructions.find(i => i.id === tableIt)
                                  : instructions.find(i => {
                                      const r = itMap.get(`${row.emp.id}:${i.id}`);
                                      return !r || r.status !== "ok";
                                    }) ?? instructions[0];
                                if (targetInstr) {
                                  const rec = itMap.get(`${row.emp.id}:${targetInstr.id}`);
                                  setItDialog({
                                    open: true,
                                    employeeId: row.emp.id,
                                    employeeName: row.emp.name,
                                    instructionId: targetInstr.id,
                                    instructionCode: targetInstr.code,
                                    currentStatus: rec?.status,
                                    currentDate: rec?.conclusao_date ?? undefined,
                                  });
                                }
                              }}
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

      <InstructionDialog
        open={instrDialog.open}
        onOpenChange={(v) => setInstrDialog((prev) => ({ ...prev, open: v }))}
        instruction={instrDialog.instruction}
      />

      {itDialog && (
        <ITTrainingDialog
          open={itDialog.open}
          onOpenChange={(v) => { if (!v) setItDialog(null); }}
          employeeId={itDialog.employeeId}
          employeeName={itDialog.employeeName}
          instructionId={itDialog.instructionId}
          instructionCode={itDialog.instructionCode}
          currentStatus={itDialog.currentStatus}
          currentDate={itDialog.currentDate}
        />
      )}
    </PageShell>
  );
}
