import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, ShieldAlert, UserPlus, Trash2, KeyRound, Pencil } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/usuarios")({
  component: AdminUsersPage,
    head: () => ({ meta: [{ title: "Controle de acessos — Bloqueio de energias perigosas" }] }),
});

type Profile = { id: string; email: string | null; display_name: string | null };
type Row = Profile & { roles: AppRole[] };

function AdminUsersPage() {
  const { isAdmin, loading, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [openInvite, setOpenInvite] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
          <p className="text-sm text-muted-foreground mt-1">Apenas Admins podem gerenciar usuários e permissões.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/dashboard">Voltar</Link></Button>
        </div>
      </PageShell>
    );
  }

  async function setRole(userId: string, role: AppRole, enable: boolean) {
    setBusy(userId + role);
    if (enable) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) { setBusy(null); return toast.error(error.message); }
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) { setBusy(null); return toast.error(error.message); }
    }
    toast.success("Permissão atualizada");
    setBusy(null);
    reload();
  }

  async function deleteUser(row: Row) {
    setBusy(row.id);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { type: "delete", user_id: row.id },
    });
    setBusy(null);
    setPendingDelete(null);
    if (error || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string } | null)?.error ?? error?.message ?? "Erro ao remover";
      return toast.error(msg);
    }
    toast.success(`Usuário ${row.email ?? ""} removido`);
    reload();
  }

  async function sendReset(row: Row) {
    if (!row.email) return toast.error("Usuário sem e-mail");
    setBusy(row.id);
    const redirect_to =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { type: "reset_password", email: row.email, redirect_to },
    });
    setBusy(null);
    if (error || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string } | null)?.error ?? error?.message ?? "Erro";
      return toast.error(msg);
    }
    toast.success(`E-mail de redefinição enviado para ${row.email}`);
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Controle de acessos</h1>
          <p className="text-sm text-muted-foreground">Cadastre Apoios e Donos de RAC, gerencie permissões, edite dados e envie redefinição de senha.</p>
        </div>
        <Button onClick={() => setOpenInvite(true)} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
          <UserPlus className="h-4 w-4" /> Novo Acesso
        </Button>
      </div>

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
                  <TableCell className="font-medium">
                    {u.display_name || "—"}
                    {u.id === user?.id && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">(você)</span>}
                  </TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5 flex-wrap">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">Sem perfil</span>}
                      {u.roles.map((r) => (
                        <span key={r} className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          <ShieldCheck className="h-3 w-3" />{r === "admin" ? "Dono de RAC (Admin)" : "Apoio"}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <RoleToggle role="apoio" active={u.roles.includes("apoio")} disabled={busy !== null} onChange={(v) => setRole(u.id, "apoio", v)} />
                      <RoleToggle role="admin" active={u.roles.includes("admin")} disabled={busy !== null || u.id === user?.id} onChange={(v) => setRole(u.id, "admin", v)} />
                      <Button size="sm" variant="ghost" disabled={busy === u.id} onClick={() => setEditing(u)} title="Editar usuário">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy === u.id} onClick={() => sendReset(u)} title="Enviar redefinição de senha">
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={busy === u.id || u.id === user?.id}
                        onClick={() => setPendingDelete(u)}
                        title="Remover usuário"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4">
        Donos de RAC (Admin) têm controle total. Apoios podem cadastrar, transferir e realizar baixas de dispositivos.
        Você não pode rebaixar nem remover a si mesmo — peça a outro Dono de RAC.
      </p>

      <InviteUserDialog open={openInvite} onOpenChange={setOpenInvite} onCreated={reload} />
      <EditUserDialog row={editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {pendingDelete?.display_name ?? pendingDelete?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário será removido do sistema e perderá imediatamente o acesso. Esta ação é irreversível.
              Os cadeados criados por ele permanecem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteUser(pendingDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function RoleToggle({ role, active, disabled, onChange }: { role: AppRole; active: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      disabled={disabled}
      onClick={() => onChange(!active)}
      className={active ? "bg-brand-gradient text-white" : ""}
    >
      {active ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
      {role === "admin" ? "Dono de RAC" : "Apoio"}
    </Button>
  );
}

function InviteUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("apoio");
  const [loading, setLoading] = useState(false);

  function reset() {
    setEmail(""); setName(""); setPassword(""); setRole("apoio"); setLoading(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("E-mail inválido");
    if (password.length < 8) return toast.error("Senha deve ter ao menos 8 caracteres");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { type: "create", email, password, display_name: name || undefined, role },
    });
    setLoading(false);
    if (error || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string } | null)?.error ?? error?.message ?? "Erro ao cadastrar";
      return toast.error(msg);
    }
    toast.success(`Usuário ${email} cadastrado como ${role === "admin" ? "Dono de RAC (Admin)" : "Apoio"}`);
    reset();
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Acesso</DialogTitle>
          <DialogDescription>
            Crie a conta diretamente — o usuário poderá entrar imediatamente com a senha definida e
            redefini-la depois pelo fluxo de "Esqueci minha senha".
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="iname">Nome</Label>
            <Input id="iname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Maria Silva" maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iemail">E-mail</Label>
            <Input id="iemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ipass">Senha provisória</Label>
            <Input id="ipass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres" />
            <p className="text-[11px] text-muted-foreground">Compartilhe pessoalmente. O usuário pode trocá-la em "Esqueci minha senha".</p>
          </div>
          <div className="space-y-1.5">
            <Label>Perfil inicial</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apoio">Apoio</SelectItem>
                <SelectItem value="admin">Dono de RAC (Admin)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
              {loading ? "Criando..." : "Liberar Acesso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ row, onOpenChange, onSaved }: { row: Row | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (row) {
      setName(row.display_name ?? "");
      setEmail(row.email ?? "");
      setPassword("");
    }
  }, [row]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!row) return;
    if (email && !email.includes("@")) return toast.error("E-mail inválido");
    if (password && password.length < 8) return toast.error("Senha deve ter ao menos 8 caracteres");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        type: "update",
        user_id: row.id,
        display_name: name,
        email: email || undefined,
        password: password || undefined,
      },
    });
    setLoading(false);
    if (error || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string } | null)?.error ?? error?.message ?? "Erro ao salvar";
      return toast.error(msg);
    }
    toast.success("Usuário atualizado");
    onSaved();
  }

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Atualize nome, e-mail ou defina uma nova senha. Deixe a senha em branco para mantê-la.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ename">Nome</Label>
            <Input id="ename" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eemail">E-mail</Label>
            <Input id="eemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="epass">Nova senha (opcional)</Label>
            <Input id="epass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} placeholder="Mínimo 8 caracteres" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}