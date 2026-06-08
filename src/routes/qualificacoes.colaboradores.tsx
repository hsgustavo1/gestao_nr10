import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useEmployees, useDeleteEmployee } from "@/lib/qualificacoes-queries";
import { EmployeeDialog } from "@/components/employee-dialog";
import type { Employee } from "@/lib/qualificacoes";
import { toast } from "sonner";

export const Route = createFileRoute("/qualificacoes/colaboradores")({
  component: ColaboradoresPage,
  head: () => ({ meta: [{ title: "Colaboradores — Qualificações NR-10" }] }),
});

function ColaboradoresPage() {
  const { isStaff } = useAuth();
  const { data: employees = [], isLoading } = useEmployees();
  const deleteEmp = useDeleteEmployee();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>();

  function handleEdit(emp: Employee) {
    setEditing(emp);
    setDialogOpen(true);
  }

  async function handleDelete(emp: Employee) {
    if (!confirm(`Remover ${emp.name}?`)) return;
    try {
      await deleteEmp.mutateAsync(emp.id);
      toast.success("Colaborador removido");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Colaboradores</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Cadastro de integrantes da área NR-10.
          </p>
        </div>
        {isStaff && (
          <Button
            onClick={() => { setEditing(undefined); setDialogOpen(true); }}
            className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> Novo colaborador
          </Button>
        )}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-left">
              <th className="py-2 pr-4 font-medium">Nome</th>
              <th className="py-2 pr-4 font-medium">Matrícula</th>
              <th className="py-2 pr-4 font-medium">Setor</th>
              <th className="py-2 pr-4 font-medium">Classificação</th>
              <th className="py-2 pr-4 font-medium">Função</th>
              {isStaff && <th className="py-2 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="py-3 pr-4"><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))
              : employees.map((emp) => (
                  <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-medium">{emp.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{emp.matricula}</td>
                    <td className="py-3 pr-4">
                      {emp.setor && <Badge variant="outline">{emp.setor}</Badge>}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{emp.classificacao ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground truncate max-w-[200px]">{emp.funcao ?? "—"}</td>
                    {isStaff && (
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(emp)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(emp)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
            }
          </tbody>
        </table>
        {!isLoading && employees.length === 0 && (
          <p className="py-12 text-center text-muted-foreground text-sm">
            Nenhum colaborador cadastrado.{" "}
            {isStaff && "Use o botão acima para adicionar ou importe a planilha."}
          </p>
        )}
      </div>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(undefined); }}
        employee={editing}
      />
    </PageShell>
  );
}
