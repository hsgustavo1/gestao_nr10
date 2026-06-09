import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Printer, History, ChevronUp } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useEmployees, useWorkAuthorizations, useAuthorizationHistory } from "@/lib/qualificacoes-queries";
import { AuthorizationDialog } from "@/components/authorization-dialog";
import { AuthorizationPrintDialog } from "@/components/authorization-print-dialog";
import { formatDatePtBR } from "@/lib/qualificacoes";
import type { WorkAuthorization } from "@/lib/qualificacoes";

export const Route = createFileRoute("/qualificacoes/autorizacoes")({
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>("");
  const [editingAuth, setEditingAuth] = useState<WorkAuthorization | undefined>();
  const [setorFilter, setSetorFilter] = useState<string>("todos");
  const [printDialog, setPrintDialog] = useState<{ auth: WorkAuthorization; employee: { name: string; matricula: string; setor: string | null; funcao: string | null } } | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const isLoading = empLoading || authLoading;

  // Build a map from employee_id to authorization record
  const authByEmployee = new Map<string, WorkAuthorization>();
  for (const auth of authorizations) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authByEmployee.set(auth.employee_id, auth as unknown as WorkAuthorization);
  }

  function handleEdit(employeeId: string, employeeName: string) {
    setSelectedEmployeeId(employeeId);
    setSelectedEmployeeName(employeeName);
    setEditingAuth(authByEmployee.get(employeeId));
    setDialogOpen(true);
  }

  const filteredEmployees = setorFilter === "todos"
    ? employees
    : employees.filter(emp => emp.setor === setorFilter);

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
        {/* Setor filter */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground font-medium">Equipe:</span>
          <Select value={setorFilter} onValueChange={setSetorFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {["ELE", "GER", "INS", "MEC", "ADM", "OPE", "OUT"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
