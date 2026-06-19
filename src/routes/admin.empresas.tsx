import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Users, ShieldAlert, CornerDownRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getEmpresaAdminAccess } from "@/lib/tenancy-gates";
import { buildOrgTree } from "@/lib/org-tree";
import { fetchEmpresas, type EmpresaRow } from "@/lib/empresas-queries";
import { TIPO_LABEL, MODULE_LABEL } from "@/lib/empresas-labels";

export const Route = createFileRoute("/admin/empresas")({
  component: AdminEmpresasPage,
  head: () => ({ meta: [{ title: "Gestão de empresas — Gestão NR-10" }] }),
});

function AdminEmpresasPage() {
  const { isPlatformAdmin, hasOrgRole, loading, setCurrentOrg } = useAuth();
  const navigate = useNavigate();
  const access = getEmpresaAdminAccess({ isPlatformAdmin, hasOrgRole });

  const [rows, setRows] = useState<EmpresaRow[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await fetchEmpresas());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar empresas");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function manageUsers(orgId: string) {
    setCurrentOrg(orgId);
    navigate({ to: "/admin/usuarios" });
  }

  if (loading)
    return (
      <PageShell>
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </PageShell>
    );

  if (!access.canEditOrg) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="mt-3 text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas o dono da plataforma ou administradores de consultoria gerenciam empresas.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard">Voltar</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const tree = buildOrgTree(rows);

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestão de empresas</h1>
          <p className="text-sm text-muted-foreground">
            {access.canCreate
              ? "Crie consultorias, clientes e unidades, defina módulos e o primeiro acesso."
              : "Gerencie os dados e os acessos dos seus clientes."}
          </p>
        </div>
        {access.canCreate && (
          <Button
            disabled
            className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
            title="Disponível na próxima etapa do plano"
          >
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        )}
      </div>

      <Card className="mt-6">
        <CardContent className="p-2 sm:p-3">
          {rows.length === 0 && !busy && (
            <p className="text-center text-muted-foreground py-10 text-sm">
              Nenhuma empresa visível.
            </p>
          )}
          <ul className="divide-y">
            {tree.map(({ org, depth }) => (
              <li
                key={org.id}
                className={`flex items-center gap-2 py-2.5 ${org.ativa ? "" : "opacity-50"}`}
                style={{ paddingLeft: 8 + depth * 20 }}
              >
                {depth > 0 && (
                  <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                )}
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium truncate">{org.nome}</span>
                <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {TIPO_LABEL[org.tipo]}
                </span>
                <div className="flex gap-1 flex-wrap">
                  {org.entitlements.map((m) => (
                    <span
                      key={m}
                      className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
                    >
                      {MODULE_LABEL[m] ?? m}
                    </span>
                  ))}
                </div>
                {!org.ativa && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    inativa
                  </span>
                )}
                <div className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled
                    title="Editar (próxima etapa do plano)"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {access.canManageUsers && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => manageUsers(org.id)}
                      title="Gerenciar usuários"
                    >
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageShell>
  );
}
