import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Paperclip, FileText } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useEmployees, useDeleteEmployee } from "@/lib/qualificacoes-queries";
import { EmployeeDialog } from "@/components/employee-dialog";
import type { Employee } from "@/lib/qualificacoes";
import { formatDatePtBR, employeeStatusVariant, EMPLOYEE_STATUS_LABELS } from "@/lib/qualificacoes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/qualificacoes/colaboradores")({
  component: ColaboradoresPage,
  head: () => ({ meta: [{ title: "Qualificação — Pessoas" }] }),
});

function ColaboradoresPage() {
  const { isStaff } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"ativo" | "afastado" | "desligado" | "all">("ativo");
  const [setorFilter, setSetorFilter] = useState<string>("todos");
  const { data: employees = [], isLoading } = useEmployees(statusFilter);
  const deleteEmp = useDeleteEmployee();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>();

  const filteredEmployees = setorFilter === "todos"
    ? employees
    : employees.filter((emp) => emp.setor === setorFilter);

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
          <h1 className="text-xl sm:text-2xl font-bold">Qualificação</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Formação e qualificação dos integrantes NR-10.
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

      <div className="flex items-center gap-2 mt-4 mb-2">
        <span className="text-xs text-muted-foreground font-medium">Situação:</span>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="afastado">Afastados</SelectItem>
            <SelectItem value="desligado">Desligados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground font-medium ml-3">Equipe:</span>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {["ELE", "GER", "INS", "MEC", "ADM", "OPE", "OUT"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-left">
              <th className="py-2 pr-4 font-medium">Nome</th>
              <th className="py-2 pr-4 font-medium">Matrícula</th>
              <th className="py-2 pr-4 font-medium">Setor</th>
              <th className="py-2 pr-4 font-medium">Classificação</th>
              <th className="py-2 pr-4 font-medium">Função</th>
              <th className="py-2 pr-4 font-medium">Situação</th>
              <th className="py-2 pr-4 font-medium">Escolaridade</th>
              <th className="py-2 pr-4 font-medium">Diploma</th>
              <th className="py-2 pr-4 font-medium">Conclusão</th>
              {isStaff && <th className="py-2 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="py-3 pr-4"><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))
              : filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-medium">
                      <Link
                        to="/qualificacoes/colaborador/$id"
                        params={{ id: emp.id }}
                        className="hover:underline"
                        title="Abrir dossiê do colaborador"
                      >
                        {emp.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{emp.matricula}</td>
                    <td className="py-3 pr-4">
                      {emp.setor && <Badge variant="outline">{emp.setor}</Badge>}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{emp.classificacao ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground truncate max-w-[200px]">{emp.funcao ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={employeeStatusVariant(emp.status ?? "ativo")}>
                        {EMPLOYEE_STATUS_LABELS[emp.status ?? "ativo"]}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{emp.escolaridade ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{emp.diploma ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatDatePtBR(emp.diploma_conclusao)}</td>
                    {isStaff && (
                      <td className="py-3">
                        <div className="flex gap-1">
                          {/* Attach diploma */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Anexar diploma"
                            onClick={() => toast.info("Anexo de documentos em breve")}
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </Button>
                          {/* Attach histórico escolar */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Anexar histórico escolar"
                            onClick={() => toast.info("Anexo de documentos em breve")}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(emp)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Desligar colaborador" onClick={() => handleDelete(emp)}>
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
        {!isLoading && filteredEmployees.length === 0 && (
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
