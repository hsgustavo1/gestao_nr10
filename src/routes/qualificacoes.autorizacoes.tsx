import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useEmployees, useWorkAuthorizations } from "@/lib/qualificacoes-queries";
import { AuthorizationDialog } from "@/components/authorization-dialog";
import { formatDatePtBR } from "@/lib/qualificacoes";
import type { WorkAuthorization } from "@/lib/qualificacoes";

export const Route = createFileRoute("/qualificacoes/autorizacoes")({
  component: AutorizacoesPage,
  head: () => ({ meta: [{ title: "Autorizações de Trabalho — Qualificações" }] }),
});

function AutorizacoesPage() {
  const { isStaff } = useAuth();
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { data: authorizations = [], isLoading: authLoading } = useWorkAuthorizations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>("");
  const [editingAuth, setEditingAuth] = useState<WorkAuthorization | undefined>();

  const isLoading = empLoading || authLoading;

  // Build a map from employee_id to authorization record
  const authByEmployee = new Map<string, WorkAuthorization>();
  for (const auth of authorizations) {
    authByEmployee.set(auth.employee_id, auth as WorkAuthorization);
  }

  function handleEdit(employeeId: string, employeeName: string) {
    setSelectedEmployeeId(employeeId);
    setSelectedEmployeeName(employeeName);
    setEditingAuth(authByEmployee.get(employeeId));
    setDialogOpen(true);
  }

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

      <div className="mt-6 overflow-x-auto">
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
                    {Array.from({ length: isStaff ? 7 : 6 }).map((_, j) => (
                      <td key={j} className="py-3 pr-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : employees.map((emp) => {
                  const auth = authByEmployee.get(emp.id);
                  const isHighLevel = auth?.level === "A3" || auth?.level === "A4";

                  return (
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
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEdit(emp.id, emp.name)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!isLoading && employees.length === 0 && (
          <p className="py-12 text-center text-muted-foreground text-sm">
            Nenhum colaborador cadastrado.
          </p>
        )}
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
    </PageShell>
  );
}
