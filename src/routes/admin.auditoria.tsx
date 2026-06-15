import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ScrollText } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/auditoria")({
  component: AdminAuditoriaPage,
  head: () => ({ meta: [{ title: "Auditoria — Gestão NR-10" }] }),
});

type AuditEntry = {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  actor_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

const TABLE_LABELS: Record<string, string> = {
  employees: "Colaboradores",
  nr10_trainings: "Capacitações NR-10",
  work_authorizations: "Autorizações",
  it_trainings: "ITs",
  nr10_documents: "Prontuário",
  epis: "EPIs",
  epi_tests: "Ensaios de EPI",
  asos: "ASOs",
  electrical_incidents: "Incidentes",
};

const ACTION_LABELS: Record<AuditEntry["action"], string> = {
  INSERT: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
};

const PAGE_SIZE = 50;

/** Campos internos que não interessam no diff exibido. */
const IGNORED_FIELDS = new Set(["id", "created_at", "updated_at"]);

function changedFields(entry: AuditEntry): string[] {
  if (entry.action !== "UPDATE" || !entry.old_data || !entry.new_data) return [];
  const fields: string[] = [];
  for (const key of Object.keys(entry.new_data)) {
    if (IGNORED_FIELDS.has(key)) continue;
    if (JSON.stringify(entry.old_data[key]) !== JSON.stringify(entry.new_data[key])) {
      fields.push(key);
    }
  }
  return fields;
}

function recordLabel(entry: AuditEntry): string {
  const d = entry.new_data ?? entry.old_data;
  if (!d) return entry.record_id.slice(0, 8);
  const name = (d.name ?? d.title ?? d.descricao ?? d.description ?? d.code) as string | undefined;
  return name ? String(name).slice(0, 60) : entry.record_id.slice(0, 8);
}

function AdminAuditoriaPage() {
  const { isAdmin, loading } = useAuth();
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["audit_log", tableFilter, actionFilter, page],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      const { data, error, count } = await q;
      if (error) throw error;
      return { entries: data as unknown as AuditEntry[], count: count ?? 0 };
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", "all"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name, email");
      if (error) throw error;
      return data as { id: string; display_name: string | null; email: string | null }[];
    },
  });

  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.display_name || p.email || p.id.slice(0, 8)])),
    [profiles],
  );

  const entries = data?.entries ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading)
    return (
      <PageShell>
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </PageShell>
    );
  if (!isAdmin) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Apenas administradores podem acessar a trilha de auditoria.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <ScrollText className="h-5 w-5 shrink-0 text-primary" />
            Trilha de Auditoria
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Quem alterou o quê nas tabelas de conformidade · registro imutável via trigger de banco.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Select
          value={tableFilter}
          onValueChange={(v) => {
            setTableFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Tabela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tabelas</SelectItem>
            {Object.entries(TABLE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={actionFilter}
          onValueChange={(v) => {
            setActionFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            <SelectItem value="INSERT">Criação</SelectItem>
            <SelectItem value="UPDATE">Alteração</SelectItem>
            <SelectItem value="DELETE">Exclusão</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {total} registro{total !== 1 ? "s" : ""}
        </span>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum registro de auditoria ainda. Os registros começam após a aplicação da migration
              de auditoria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Campos alterados</TableHead>
                    <TableHead>Autor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => {
                    const fields = changedFields(e);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(e.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {TABLE_LABELS[e.table_name] ?? e.table_name}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <div className="text-sm truncate" title={recordLabel(e)}>
                            {recordLabel(e)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              e.action === "DELETE"
                                ? "destructive"
                                : e.action === "INSERT"
                                  ? "default"
                                  : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {ACTION_LABELS[e.action]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          {e.action === "UPDATE" ? (
                            <span
                              className="text-xs text-muted-foreground truncate block"
                              title={fields.join(", ")}
                            >
                              {fields.length > 0 ? fields.join(", ") : "—"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {e.actor_id
                            ? (profileById.get(e.actor_id) ?? e.actor_id.slice(0, 8))
                            : "Sistema"}
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

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </PageShell>
  );
}
