import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { getPessoasAccess } from "@/lib/tenancy-gates";
import { useEmployees, useDeleteEmployee } from "@/lib/qualificacoes-queries";
import { EmployeeDialog } from "@/components/employee-dialog";
import type { Employee } from "@/lib/qualificacoes";
import { employeeStatusVariant, EMPLOYEE_STATUS_LABELS, SETOR_FULL_NAMES } from "@/lib/qualificacoes";
import { toast } from "sonner";

export const Route = createFileRoute("/qualificacoes/integrantes")({
  component: ColaboradoresPage,
  head: () => ({ meta: [{ title: "Colaboradores — Pessoas" }] }),
});

const SETOR_LABELS: Record<string, string> = {
  ELE: "ELE — Elétrica",
  INS: "INS — Instrumentação",
  GER: "GER — Geração de energia",
  ADM: "ADM — Administrativo",
};

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-emerald-100 text-emerald-800 border-emerald-200",
  afastado: "bg-amber-100 text-amber-800 border-amber-200",
  desligado: "bg-red-100 text-red-700 border-red-200",
};

function ColaboradoresPage() {
  const { isStaff, isAdmin, hasEntitlement, hasOrgRole, managerOrgRole } = useAuth();
  const { canEdit, canEditEmployee } = getPessoasAccess({ isStaff, isAdmin, hasEntitlement, hasOrgRole, managerOrgRole });
  const [statusFilter, setStatusFilter] = useState<"ativo" | "afastado" | "desligado" | "all">(
    "ativo",
  );
  const [setorFilter, setSetorFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const { data: employees = [], isLoading } = useEmployees(statusFilter);
  const deleteEmp = useDeleteEmployee();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((emp) => {
      if (setorFilter !== "todos" && emp.setor !== setorFilter) return false;
      if (!term) return true;
      return (
        emp.name.toLowerCase().includes(term) ||
        emp.matricula.toLowerCase().includes(term) ||
        (emp.funcao ?? "").toLowerCase().includes(term)
      );
    });
  }, [employees, setorFilter, search]);

  function handleEdit(emp: Employee) {
    setEditing(emp);
    setDialogOpen(true);
  }

  async function handleDelete(emp: Employee) {
    if (!confirm(`Remover ${emp.name}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteEmp.mutateAsync(emp.id);
      toast.success("Colaborador removido");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  const counts = useMemo(() => {
    const out = { ativo: 0, afastado: 0, desligado: 0 };
    for (const e of employees) {
      const s = e.status ?? "ativo";
      if (s in out) out[s as keyof typeof out]++;
    }
    return out;
  }, [employees]);

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Colaboradores
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Cadastro e dados dos colaboradores habilitados NR-10.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
            className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> Novo colaborador
          </Button>
        )}
      </div>

      {/* Contadores de status (quando filtro = all) */}
      {statusFilter === "all" && (
        <div className="flex flex-wrap gap-2 mb-3">
          {(["ativo", "afastado", "desligado"] as const).map((s) => (
            <span
              key={s}
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s]}`}
            >
              {EMPLOYEE_STATUS_LABELS[s]}
              <span className="font-bold">{counts[s]}</span>
            </span>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, matrícula ou função..."
            className="pl-8 h-8 text-xs w-56"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="afastado">Afastados</SelectItem>
            <SelectItem value="desligado">Desligados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as equipes</SelectItem>
            {Object.entries(SETOR_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} colaborador{filtered.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-muted-foreground text-left text-xs">
              <th className="py-2.5 px-3 font-medium">Nome</th>
              <th className="py-2.5 px-3 font-medium">Matrícula</th>
              <th className="py-2.5 px-3 font-medium">Equipe</th>
              <th className="py-2.5 px-3 font-medium">Função</th>
              <th className="py-2.5 px-3 font-medium">Classificação</th>
              <th className="py-2.5 px-3 font-medium">Status</th>
              {canEdit && <th className="py-2.5 px-3 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="py-3 px-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.map((emp) => {
                  const status = emp.status ?? "ativo";
                  return (
                    <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-medium">
                        <Link
                          to="/qualificacoes/colaborador/$id"
                          params={{ id: emp.id }}
                          className="hover:underline text-foreground"
                          title="Abrir dossiê do colaborador"
                        >
                          {emp.name}
                        </Link>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                        {emp.matricula}
                      </td>
                      <td className="py-3 px-3">
                        {emp.setor ? (
                          <Badge variant="outline" className="text-[11px]" title={SETOR_FULL_NAMES[emp.setor] ?? emp.setor}>
                            {emp.setor}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-xs max-w-[220px] truncate">
                        {emp.funcao ?? "—"}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">
                        {emp.classificacao ?? "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status]}`}
                        >
                          {EMPLOYEE_STATUS_LABELS[status]}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="py-3 px-3">
                          {canEditEmployee(emp) ? (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Editar dados"
                                onClick={() => handleEdit(emp)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title="Remover colaborador"
                                onClick={() => handleDelete(emp)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground px-1" title="Gerenciado pelo consultor">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!isLoading && filtered.length === 0 && (
          <p className="py-12 text-center text-muted-foreground text-sm">
            {employees.length === 0
              ? "Nenhum colaborador cadastrado."
              : "Nenhum colaborador encontrado com os filtros aplicados."}
          </p>
        )}
      </div>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(undefined);
        }}
        employee={editing}
      />
    </PageShell>
  );
}
