import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Pencil, Printer, History, ChevronUp } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useEmployees, useWorkAuthorizations, useAuthorizationHistory } from "@/lib/qualificacoes-queries";
import { AuthorizationDialog } from "@/components/authorization-dialog";
import { AuthorizationPrintDialog } from "@/components/authorization-print-dialog";
import { formatDatePtBR } from "@/lib/qualificacoes";
import type { WorkAuthorization } from "@/lib/qualificacoes";

const autorizacoesSearchSchema = z.object({
  setor: z.string().optional().default("todos"),
  level: z.string().optional().default("all"),
  valida: z.string().optional().default("all"),
  semAuth: z.string().optional().default("all"),
});

export const Route = createFileRoute("/qualificacoes/autorizacoes")({
  validateSearch: autorizacoesSearchSchema,
  component: AutorizacoesPage,
  head: () => ({ meta: [{ title: "Autorizações de Trabalho — Qualificações" }] }),
});

function HistoryRow({ employeeId, colSpan }: { employeeId: string; colSpan: number }) {
  const { data: history = [] } = useAuthorizationHistory(employeeId);
  return (
    <tr className="bg-muted/10">
      <td colSpan={colSpan} className="px-4 py-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Histórico de autorizações anteriores</p>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum histórico registrado.</p>
        ) : (
          <div className="space-y-1">
            {history.map(h => (
              <div key={h.id} className="text-xs flex gap-4 items-center text-muted-foreground">
                <span className="font-mono font-semibold">{h.level}</span>
                <span>{formatDatePtBR(h.authorization_date)}</span>
                <span className="text-[10px]">{h.valid ? "Válida" : "Inválida"}</span>
                <span className="truncate max-w-[200px]">{h.funcao ?? ""}</span>
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

function AutorizacoesPage() {
  const { isStaff } = useAuth();
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { data: authorizations = [], isLoading: authLoading } = useWorkAuthorizations();

  const search = Route.useSearch();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>("");
  const [editingAuth, setEditingAuth] = useState<WorkAuthorization | undefined>();
  const [nameSearch, setNameSearch] = useState("");
  const [setorFilter, setSetorFilter] = useState<string>(search.setor ?? "todos");
  const [levelFilter, setLevelFilter] = useState<string>(search.level ?? "all");
  const [validFilter, setValidFilter] = useState<string>(search.valida ?? "all");
  const [printDialog, setPrintDialog] = useState<{ auth: WorkAuthorization; employee: { name: string; matricula: string; setor: string | null; funcao: string | null } } | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const isLoading = empLoading || authLoading;

  // Build a map from employee_id to authorization record
  const authByEmployee = useMemo(() => {
    const map = new Map<string, WorkAuthorization>();
    for (const auth of authorizations) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.set(auth.employee_id, auth as unknown as WorkAuthorization);
    }
    return map;
  }, [authorizations]);

  function handleEdit(employeeId: string, employeeName: string) {
    setSelectedEmployeeId(employeeId);
    setSelectedEmployeeName(employeeName);
    setEditingAuth(authByEmployee.get(employeeId));
    setDialogOpen(true);
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (nameSearch && !emp.name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      if (setorFilter !== "todos" && emp.setor !== setorFilter) return false;
      const auth = authByEmployee.get(emp.id);
      if (levelFilter !== "all" && auth?.level !== levelFilter) return false;
      if (validFilter === "sim" && !auth?.valid) return false;
      if (validFilter === "nao" && auth?.valid !== false) return false;
      if (validFilter === "sem_auth" && auth) return false;
      return true;
    });
  }, [employees, nameSearch, setorFilter, levelFilter, validFilter, authByEmployee]);

  const colSpan = isStaff ? 7 : 6;

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Autorizações de Trabalho</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Nível de autorização NR-10 por colaborador.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {/* Stats summary */}
        <div className="flex gap-4 text-xs text-muted-foreground mb-3">
          <span>Total: <strong className="text-foreground">{employees.length}</strong></span>
          <span>Com autorização: <strong className="text-foreground">{authorizations.length}</strong></span>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <span>Válidas: <strong className="text-emerald-600">{authorizations.filter((a: any) => a.valid).length}</strong></span>
          <span>Sem autorização: <strong className="text-destructive">{employees.length - authorizations.length}</strong></span>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <Input
            placeholder="Buscar por nome..."
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            className="h-8 text-xs w-48"
          />
          <Select value={setorFilter} onValueChange={setSetorFilter}>
            <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas equipes</SelectItem>
              {["ELE", "GER", "INS", "MEC", "ADM", "OPE", "OUT"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os níveis</SelectItem>
              {["A0", "A1", "A2", "A3", "A4"].map(l => (
                <SelectItem key={l} value={l}>Nível {l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={validFilter} onValueChange={setValidFilter}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="sim">Válidas</SelectItem>
              <SelectItem value="nao">Inválidas</SelectItem>
              <SelectItem value="sem_auth">Sem autorização</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredEmployees.length} integrante{filteredEmployees.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="py-2 pr-4 font-medium">Colaborador</th>
                <th className="py-2 pr-4 font-medium">Mat.</th>
                <th className="py-2 pr-4 font-medium">Setor</th>
                <th className="py-2 pr-4 font-medium">Nível</th>
                <th className="py-2 pr-4 font-medium">Data autorização</th>
                <th className="py-2 pr-4 font-medium">Válida</th>
                {isStaff && <th className="py-2 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: colSpan }).map((_, j) => (
                        <td key={j} className="py-3 pr-4">
                          <Skeleton className="h-4 w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filteredEmployees.map((emp) => {
                    const auth = authByEmployee.get(emp.id);
                    const isHighLevel = auth?.level === "A3" || auth?.level === "A4";

                    return (
                      <>
                        <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-4 font-medium">{emp.name}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{emp.matricula}</td>
                          <td className="py-3 pr-4">
                            {emp.setor && <Badge variant="outline">{emp.setor}</Badge>}
                          </td>
                          <td className="py-3 pr-4">
                            {auth?.level ? (
                              <Badge
                                className={isHighLevel ? "bg-brand-gradient text-white" : undefined}
                              >
                                {auth.level}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatDatePtBR(auth?.authorization_date)}
                          </td>
                          <td className="py-3 pr-4">
                            {auth ? (
                              <Badge variant={auth.valid ? "default" : "destructive"}>
                                {auth.valid ? "Sim" : "Não"}
                              </Badge>
                            ) : null}
                          </td>
                          {isStaff && (
                            <td className="py-3">
                              <div className="flex items-center gap-0.5">
                                {auth && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    title="Imprimir autorização"
                                    onClick={() => setPrintDialog({ auth, employee: emp })}
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground"
                                  title="Ver histórico"
                                  onClick={() => setExpandedHistory(expandedHistory === emp.id ? null : emp.id)}
                                >
                                  {expandedHistory === emp.id
                                    ? <ChevronUp className="h-3.5 w-3.5" />
                                    : <History className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleEdit(emp.id, emp.name)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                        {expandedHistory === emp.id && (
                          <HistoryRow key={`history-${emp.id}`} employeeId={emp.id} colSpan={colSpan} />
                        )}
                      </>
                    );
                  })}
            </tbody>
          </table>
          {!isLoading && filteredEmployees.length === 0 && (
            <p className="py-12 text-center text-muted-foreground text-sm">
              Nenhum colaborador encontrado.
            </p>
          )}
        </div>
      </div>

      <AuthorizationDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) {
            setEditingAuth(undefined);
            setSelectedEmployeeId("");
            setSelectedEmployeeName("");
          }
        }}
        employeeId={selectedEmployeeId}
        employeeName={selectedEmployeeName}
        authorization={editingAuth}
      />

      {printDialog && (
        <AuthorizationPrintDialog
          open={!!printDialog}
          onOpenChange={(v) => { if (!v) setPrintDialog(null); }}
          authorization={printDialog.auth}
          employee={printDialog.employee}
        />
      )}
    </PageShell>
  );
}
