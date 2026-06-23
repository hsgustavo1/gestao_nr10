import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldOff,
  ShieldAlert,
  UserPlus,
  Trash2,
  KeyRound,
  Pencil,
  Building2,
  Eye,
  UserCheck,
  Loader2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole, type OrgRole } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/usuarios")({
  component: AdminUsersPage,
  head: () => ({ meta: [{ title: "Controle de acessos — Bloqueio de energias perigosas" }] }),
});

// Org semente legada (single-tenant). Para ela o painel mantém o comportamento
// global histórico (papéis "Dono de RAC"/"Apoio"); para orgs-cliente passa a operar
// por org (níveis Administrador/Visualização) via edge function.
const PRINCIPAL_ORG_ID = "00000000-0000-0000-0000-000000000001";

// Papel de org disponível na UI. "owner" só aparece para platform admin.
type ClientOrgRole = Extract<OrgRole, "owner" | "admin" | "viewer">;

type Profile = { id: string; email: string | null; display_name: string | null };
type Row = Profile & { roles: AppRole[]; org_role: OrgRole | null };

function apiErrorMsg(raw: string): string {
  if (/owner/i.test(raw))
    return "Apenas o consultor responsável pode definir esse nível de acesso. Solicite a ele.";
  if (/Email.*already/i.test(raw) || /já.*cadastrado/i.test(raw))
    return "Este e-mail já está cadastrado no sistema.";
  if (/pelo menos 8|at least 8/i.test(raw)) return "A senha deve ter pelo menos 8 caracteres.";
  if (/email.*obrigat|email.*required/i.test(raw)) return "Informe o e-mail do usuário.";
  if (/Forbidden/i.test(raw))
    return "Você não tem permissão para realizar esta ação nesta empresa.";
  return raw;
}

function orgRoleLabel(r: OrgRole | null): string {
  switch (r) {
    case "owner":
      return "Dono da empresa";
    case "admin":
      return "Administrador";
    case "member":
      return "Operador";
    case "viewer":
      return "Visualização";
    default:
      return "—";
  }
}

function AdminUsersPage() {
  const { isAdmin, loading, user, orgs, currentOrg, currentOrgId, hasOrgRole, isPlatformAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [openInvite, setOpenInvite] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const isPrincipal = !currentOrgId || currentOrgId === PRINCIPAL_ORG_ID;
  // Sem tenancy aplicada cai no papel global; com org-cliente exige admin na org
  // (cobre o consultor que gerencia o cliente via managed_by).
  const canManage = isPrincipal ? isAdmin : hasOrgRole("admin");

  // Quem está acima da org ativa na hierarquia (consultoria que gerencia, ou
  // empresa-mãe), para deixar claro "de quem é este cliente".
  const parentOrgId = currentOrg?.managed_by_org_id ?? currentOrg?.parent_org_id ?? null;
  const parentOrg = parentOrgId ? (orgs.find((o) => o.id === parentOrgId) ?? null) : null;
  const parentRelation = currentOrg?.managed_by_org_id ? "gerenciado por" : "unidade de";

  const reload = useCallback(async () => {
    const principal = !currentOrgId || currentOrgId === PRINCIPAL_ORG_ID;
    if (principal) {
      // Legado: leitura direta (RLS libera a co-membros/platform admin).
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
      setRows((profiles ?? []).map((p) => ({ ...p, roles: map.get(p.id) ?? [], org_role: null })));
      return;
    }
    // Org-cliente: o RLS de profiles esconde usuários que o consultor gerencia mas não
    // é co-membro — lista via edge function privilegiada.
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { type: "list", org_id: currentOrgId },
    });
    if (error || (data as { error?: string } | null)?.error) {
      const msg =
        (data as { error?: string } | null)?.error ?? error?.message ?? "Erro ao listar usuários";
      toast.error(msg);
      setRows([]);
      return;
    }
    const users = ((data as { users?: Row[] } | null)?.users ?? []) as Row[];
    setRows(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        roles: u.roles ?? [],
        org_role: u.org_role ?? null,
      })),
    );
  }, [currentOrgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading)
    return (
      <PageShell>
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </PageShell>
    );
  if (!canManage) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="mt-3 text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas administradores podem gerenciar usuários e permissões.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard">Voltar</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  async function setRole(userId: string, role: AppRole, enable: boolean) {
    setBusy(userId + role);
    if (enable) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) {
        setBusy(null);
        return toast.error(error.message);
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) {
        setBusy(null);
        return toast.error(error.message);
      }
    }
    toast.success("Permissão atualizada");
    setBusy(null);
    reload();
  }

  // org_id escopa a operação no backend quando estamos numa org-cliente.
  const orgScope = isPrincipal ? {} : { org_id: currentOrgId };

  async function deleteUser(row: Row) {
    setBusy(row.id);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { type: "delete", user_id: row.id, ...orgScope },
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
      body: { type: "reset_password", email: row.email, redirect_to, ...orgScope },
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
          {isPrincipal ? (
            <p className="text-sm text-muted-foreground">
              Cadastre Apoios e Donos de RAC, gerencie permissões, edite dados e envie redefinição
              de senha.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
              <Building2 className="h-3.5 w-3.5" />
              Gerenciando os acessos de <strong>{currentOrg?.nome ?? "—"}</strong>
              {parentOrg && (
                <span className="text-muted-foreground/70">
                  · {parentRelation} <strong className="font-medium">{parentOrg.nome}</strong>
                </span>
              )}
            </p>
          )}
        </div>
        <Button
          onClick={() => setOpenInvite(true)}
          className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
        >
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
                <TableHead>{isPrincipal ? "Perfis" : "Nível"}</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                    Nenhum usuário cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.display_name || "—"}
                    {u.id === user?.id && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        (você)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    {isPrincipal ? (
                      <div className="flex gap-1.5 flex-wrap">
                        {u.roles.length === 0 && (
                          <span className="text-xs text-muted-foreground">Sem perfil</span>
                        )}
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {r === "admin" ? "Dono de RAC (Admin)" : "Apoio"}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        {u.org_role === "viewer" ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <ShieldCheck className="h-3 w-3" />
                        )}
                        {orgRoleLabel(u.org_role)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {isPrincipal && (
                        <>
                          <RoleToggle
                            role="apoio"
                            active={u.roles.includes("apoio")}
                            disabled={busy !== null}
                            onChange={(v) => setRole(u.id, "apoio", v)}
                          />
                          <RoleToggle
                            role="admin"
                            active={u.roles.includes("admin")}
                            disabled={busy !== null || u.id === user?.id}
                            onChange={(v) => setRole(u.id, "admin", v)}
                          />
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === u.id}
                        onClick={() => setEditing(u)}
                        title="Editar usuário"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === u.id}
                        onClick={() => sendReset(u)}
                        title="Enviar redefinição de senha"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
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

      {isPrincipal ? (
        <p className="text-xs text-muted-foreground mt-4">
          Donos de RAC (Admin) têm controle total. Apoios podem cadastrar, transferir e realizar
          baixas de dispositivos. Você não pode rebaixar nem remover a si mesmo — peça a outro Dono
          de RAC.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-4">
          <strong>Administrador</strong> controla o sistema da própria empresa.{" "}
          <strong>Visualização</strong> só consulta, sem alterar dados. O nível "operador restrito"
          (edita a operação, mas mantém prioridades/NCs definidas pelo consultor) está no roadmap.
        </p>
      )}

      <InviteUserDialog
        open={openInvite}
        onOpenChange={setOpenInvite}
        onCreated={reload}
        isPrincipal={isPrincipal}
        isPlatformAdmin={isPlatformAdmin}
        orgId={currentOrgId}
        orgName={currentOrg?.nome ?? null}
      />
      <EditUserDialog
        row={editing}
        isPrincipal={isPrincipal}
        isPlatformAdmin={isPlatformAdmin}
        orgId={currentOrgId}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover {pendingDelete?.display_name ?? pendingDelete?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isPrincipal
                ? "O usuário será removido do sistema e perderá imediatamente o acesso. Esta ação é irreversível. Os cadeados criados por ele permanecem."
                : `O usuário perderá o acesso a ${currentOrg?.nome ?? "esta empresa"}. Se não pertencer a nenhuma outra empresa, a conta é removida por completo. Esta ação é irreversível.`}
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

function RoleToggle({
  role,
  active,
  disabled,
  onChange,
}: {
  role: AppRole;
  active: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
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

type ExistingUser = { id: string; display_name: string | null };

function InviteUserDialog({
  open,
  onOpenChange,
  onCreated,
  isPrincipal,
  isPlatformAdmin,
  orgId,
  orgName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  isPrincipal: boolean;
  isPlatformAdmin: boolean;
  orgId: string | null;
  orgName: string | null;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("apoio");
  const [orgRole, setOrgRole] = useState<ClientOrgRole>("admin");
  const [loading, setLoading] = useState(false);

  // Lookup: undefined = sem email válido, null = não encontrado, objeto = encontrado
  const [existingUser, setExistingUser] = useState<ExistingUser | null | undefined>(undefined);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLinking = existingUser != null; // usuário já existe, só vamos vincular

  function reset() {
    setEmail("");
    setName("");
    setPassword("");
    setRole("apoio");
    setOrgRole("admin");
    setLoading(false);
    setExistingUser(undefined);
    setLookupLoading(false);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
  }

  function handleEmailChange(val: string) {
    setEmail(val);
    setExistingUser(undefined);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed.includes("@") || trimmed.length < 5) return;
    setLookupLoading(true);
    lookupTimer.current = setTimeout(async () => {
      const { data } = await supabase.functions.invoke("admin-users", {
        body: { type: "lookup", email: trimmed, ...(orgId ? { org_id: orgId } : {}) },
      });
      setLookupLoading(false);
      const res = data as { found?: boolean; user?: ExistingUser } | null;
      setExistingUser(res?.found ? (res.user ?? null) : null);
    }, 500);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("E-mail inválido");
    if (!isLinking && password.length < 8) return toast.error("Senha deve ter ao menos 8 caracteres");
    if (!isPrincipal && !orgId) return toast.error("Nenhuma empresa selecionada");
    setLoading(true);
    const body = isPrincipal
      ? { type: "create", email, password, display_name: name || undefined, role }
      : {
          type: "create",
          email,
          ...(isLinking ? {} : { password, display_name: name || undefined }),
          org_id: orgId,
          org_role: orgRole,
        };
    const { data, error } = await supabase.functions.invoke("admin-users", { body });
    setLoading(false);
    if (error || (data && (data as { error?: string }).error)) {
      let raw = (data as { error?: string } | null)?.error ?? error?.message ?? "Erro ao cadastrar";
      // tenta extrair o body real de respostas non-2xx
      if (!raw || raw === error?.message) {
        try {
          const body = await (error as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
          if (body?.error) raw = body.error;
        } catch { /* ignora */ }
      }
      return toast.error(apiErrorMsg(raw));
    }
    const linked = (data as { linked_existing?: boolean } | null)?.linked_existing;
    const levelLabel = isPrincipal
      ? role === "admin" ? "Dono de RAC (Admin)" : "Apoio"
      : orgRoleLabel(orgRole);
    toast.success(
      linked
        ? `${existingUser?.display_name ?? email} vinculado a ${orgName ?? "esta empresa"} como ${levelLabel}`
        : `Usuário ${email} cadastrado como ${levelLabel}`,
    );
    reset();
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Acesso</DialogTitle>
          <DialogDescription>
            {isPrincipal
              ? "Crie a conta diretamente — o usuário poderá entrar imediatamente com a senha definida."
              : `Vincule a ${orgName ?? "esta empresa"}. Se o e-mail já tiver conta no sistema, ela será reutilizada — sem nova senha.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {/* E-mail primeiro — dispara o lookup */}
          <div className="space-y-1.5">
            <Label htmlFor="iemail">E-mail</Label>
            <div className="relative">
              <Input
                id="iemail"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                required
                autoComplete="off"
                className={isLinking ? "pr-8 border-green-500 focus-visible:ring-green-500" : "pr-8"}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {lookupLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {!lookupLoading && isLinking && <UserCheck className="h-3.5 w-3.5 text-green-600" />}
              </div>
            </div>
            {isLinking && (
              <p className="text-[11px] text-green-700 dark:text-green-400 flex items-center gap-1">
                <UserCheck className="h-3 w-3" />
                Conta existente: <strong>{existingUser?.display_name ?? email}</strong> — será vinculada, sem nova senha.
              </p>
            )}
            {existingUser === null && (
              <p className="text-[11px] text-muted-foreground">Novo usuário — defina nome e senha abaixo.</p>
            )}
          </div>

          {/* Nome e senha só para novos usuários */}
          {!isLinking && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="iname">Nome</Label>
                <Input
                  id="iname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Maria Silva"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ipass">Senha provisória</Label>
                <Input
                  id="ipass"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!isLinking}
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                />
                <p className="text-[11px] text-muted-foreground">
                  Compartilhe pessoalmente. O usuário pode trocá-la em "Esqueci minha senha".
                </p>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>{isPrincipal ? "Perfil inicial" : "Nível de acesso"}</Label>
            {isPrincipal ? (
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apoio">Apoio</SelectItem>
                  <SelectItem value="admin">Dono de RAC (Admin)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select value={orgRole} onValueChange={(v) => setOrgRole(v as ClientOrgRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isPlatformAdmin && (
                    <SelectItem value="owner">Admin geral (acesso total)</SelectItem>
                  )}
                  <SelectItem value="admin">Administrador (gestão de rotina)</SelectItem>
                  <SelectItem value="viewer">Visualização (somente leitura)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || lookupLoading}
              className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
            >
              {loading
                ? isLinking ? "Vinculando..." : "Criando..."
                : isLinking ? "Vincular Acesso" : "Liberar Acesso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  row,
  isPrincipal,
  isPlatformAdmin,
  orgId,
  onOpenChange,
  onSaved,
}: {
  row: Row | null;
  isPrincipal: boolean;
  isPlatformAdmin: boolean;
  orgId: string | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgRole, setOrgRole] = useState<ClientOrgRole>("viewer");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (row) {
      setName(row.display_name ?? "");
      setEmail(row.email ?? "");
      setPassword("");
      setOrgRole(
        row.org_role === "owner" ? "owner" : row.org_role === "admin" ? "admin" : "viewer",
      );
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
        ...(isPrincipal ? {} : { org_id: orgId, org_role: orgRole }),
      },
    });
    setLoading(false);
    if (error || (data && (data as { error?: string }).error)) {
      const raw = (data as { error?: string } | null)?.error ?? error?.message ?? "Erro ao salvar";
      return toast.error(apiErrorMsg(raw));
    }
    toast.success("Usuário atualizado com sucesso.");
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
            <Input
              id="ename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eemail">E-mail</Label>
            <Input
              id="eemail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="epass">Nova senha (opcional)</Label>
            <Input
              id="epass"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          {!isPrincipal && (
            <div className="space-y-1.5">
              <Label>Nível de acesso</Label>
              <Select value={orgRole} onValueChange={(v) => setOrgRole(v as ClientOrgRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isPlatformAdmin && (
                    <SelectItem value="owner">Admin geral (acesso total)</SelectItem>
                  )}
                  <SelectItem value="admin">Administrador (gestão de rotina)</SelectItem>
                  <SelectItem value="viewer">Visualização (somente leitura)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Visualização só consulta; Administrador altera o plano de ação e dados da empresa.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
            >
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
