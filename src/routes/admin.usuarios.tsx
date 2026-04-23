import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, ShieldAlert } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/usuarios")({
  component: AdminUsersPage,
  head: () => ({ meta: [{ title: "Usuários — LOTO Atvos" }] }),
});

type Profile = { id: string; email: string | null; display_name: string | null };
type Row = Profile & { roles: AppRole[] };

function AdminUsersPage() {
  const { isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  async function reload() {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name").order("created_at"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const map = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r) => {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      map.set(r.user_id, arr);
    });
    setRows((profiles ?? []).map((p) => ({ ...p, roles: map.get(p.id) ?? [] })));
  }
  useEffect(() => { void reload(); }, []);

  if (loading) return <PageShell><div className="text-sm text-muted-foreground">Carregando...</div></PageShell>;
  if (!isAdmin) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="mt-3 text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-1">Apenas Admins (Donos de RAC) podem gerenciar usuários.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/dashboard">Voltar</Link></Button>
        </div>
      </PageShell>
    );
  }

  async function setRole(userId: string, role: AppRole, enable: boolean) {
    if (enable) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    }
    toast.success("Permissão atualizada");
    reload();
  }

  return (
    <PageShell>
      <h1 className="text-2xl font-bold">Usuários e permissões</h1>
      <p className="text-sm text-muted-foreground">Atribua perfil de Supervisor ou Admin para cada usuário cadastrado.</p>

      <Card className="mt-6">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfis</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">Nenhum usuário cadastrado.</TableCell></TableRow>
              )}
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5 flex-wrap">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">Sem perfil</span>}
                      {u.roles.map((r) => (
                        <span key={r} className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          <ShieldCheck className="h-3 w-3" />{r === "admin" ? "Admin" : "Supervisor"}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <RoleToggle role="supervisor" active={u.roles.includes("supervisor")} onChange={(v) => setRole(u.id, "supervisor", v)} />
                      <RoleToggle role="admin" active={u.roles.includes("admin")} onChange={(v) => setRole(u.id, "admin", v)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4">
        Dica: o primeiro Admin precisa ser promovido manualmente via banco de dados (Cloud → Tables → user_roles).
      </p>
    </PageShell>
  );
}

function RoleToggle({ role, active, onChange }: { role: AppRole; active: boolean; onChange: (v: boolean) => void }) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} onClick={() => onChange(!active)} className={active ? "bg-brand-gradient text-white" : ""}>
      {active ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
      {role === "admin" ? "Admin" : "Supervisor"}
    </Button>
  );
}