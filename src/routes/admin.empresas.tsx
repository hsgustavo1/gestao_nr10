import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Pencil,
  Users,
  ShieldAlert,
  CornerDownRight,
  Power,
  Trash2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogDescription,
  DialogFooter,
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
import { useAuth } from "@/lib/auth-context";
import type { OrgTipo, OrgRole } from "@/lib/auth-context";
import { getEmpresaAdminAccess } from "@/lib/tenancy-gates";
import { buildOrgTree } from "@/lib/org-tree";
import {
  fetchEmpresas,
  updateOrg,
  setOrgEntitlements,
  setOrgActive,
  deleteOrg,
  type EmpresaRow,
  createOrg,
} from "@/lib/empresas-queries";
import { TIPO_LABEL, MODULE_LABEL, MODULES } from "@/lib/empresas-labels";
import { supabase } from "@/integrations/supabase/client";

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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<EmpresaRow | null>(null);

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
            onClick={() => setWizardOpen(true)}
            className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
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
                    onClick={() => setEditing(org)}
                    title="Editar empresa"
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

      {access.canCreate && (
        <NovaEmpresaWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          empresas={rows}
          onCreated={() => {
            setWizardOpen(false);
            void reload();
          }}
        />
      )}
      <EditarEmpresaPanel
        row={editing}
        empresas={rows}
        access={access}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void reload();
        }}
      />
    </PageShell>
  );
}

const CLIENT_ROLE_OPTIONS: {
  value: Extract<OrgRole, "owner" | "admin" | "viewer">;
  label: string;
}[] = [
  { value: "owner", label: "Admin geral (acesso total)" },
  { value: "admin", label: "Admin padrão (gestão de rotina)" },
  { value: "viewer", label: "Visualização (somente leitura)" },
];

function NovaEmpresaWizard({
  open,
  onOpenChange,
  empresas,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresas: EmpresaRow[];
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<OrgTipo>("cliente");
  const [managedBy, setManagedBy] = useState<string>(""); // "" = cliente direto
  const [parent, setParent] = useState<string>("");
  const [modules, setModules] = useState<string[]>(["rti_pwa"]);
  // passo 4 (opcional)
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [orgRole, setOrgRole] = useState<Extract<OrgRole, "owner" | "admin" | "viewer">>("admin");
  const [saving, setSaving] = useState(false);

  const consultorias = empresas.filter((e) => e.tipo === "consultoria" && e.ativa);
  const possiveisMaes = empresas.filter((e) => e.id && e.ativa);

  function reset() {
    setStep(1);
    setNome("");
    setTipo("cliente");
    setManagedBy("");
    setParent("");
    setModules(["rti_pwa"]);
    setEmail("");
    setUserName("");
    setPassword("");
    setOrgRole("admin");
    setSaving(false);
  }

  function close(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function toggleModule(key: string) {
    setModules((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  }

  function validateStep(): string | null {
    if (step === 1 && !nome.trim()) return "Informe o nome da empresa";
    if (step === 2 && tipo === "unidade" && !parent) return "Unidade exige empresa-mãe";
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) return toast.error(err);
    setStep((s) => Math.min(4, s + 1));
  }

  // Cria a empresa (passos 1–3) e, se preenchido, o 1º usuário (passo 4, opcional).
  async function finish(withUser: boolean) {
    if (withUser) {
      if (!email.includes("@")) return toast.error("E-mail inválido");
      if (password.length < 8) return toast.error("Senha deve ter ao menos 8 caracteres");
    }
    setSaving(true);
    let newId: string;
    try {
      newId = await createOrg({
        nome: nome.trim(),
        tipo,
        managedBy: tipo === "cliente" && managedBy ? managedBy : null,
        parent: tipo === "unidade" && parent ? parent : null,
        entitlements: modules,
      });
    } catch (e) {
      setSaving(false);
      return toast.error(e instanceof Error ? e.message : "Erro ao criar empresa");
    }

    if (withUser) {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: {
          type: "create",
          email,
          password,
          display_name: userName || undefined,
          org_id: newId,
          org_role: orgRole,
        },
      });
      if (error || (data as { error?: string } | null)?.error) {
        const msg =
          (data as { error?: string } | null)?.error ?? error?.message ?? "Erro ao criar usuário";
        setSaving(false);
        toast.error(
          `Empresa criada, mas falhou ao criar o usuário: ${msg}. Defina depois em Controle de acessos.`,
        );
        onCreated();
        return;
      }
    }

    setSaving(false);
    toast.success(`Empresa "${nome.trim()}" criada`);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova empresa — passo {step} de 4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Dados básicos da empresa."}
            {step === 2 && "Vínculo na hierarquia."}
            {step === 3 && "Módulos liberados para a empresa."}
            {step === 4 && "Primeiro acesso (opcional — pode definir depois)."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-nome">Nome</Label>
              <Input
                id="emp-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Indústria Acme Ltda."
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as OrgTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultoria">Consultoria</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="unidade">Unidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {tipo === "consultoria" && (
              <p className="text-sm text-muted-foreground">
                Consultoria não tem vínculo — é uma raiz da hierarquia.
              </p>
            )}
            {tipo === "cliente" && (
              <div className="space-y-1.5">
                <Label>Consultoria gestora (opcional)</Label>
                <Select
                  value={managedBy || "none"}
                  onValueChange={(v) => setManagedBy(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Cliente direto (sem consultoria)</SelectItem>
                    {consultorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tipo === "unidade" && (
              <div className="space-y-1.5">
                <Label>Empresa-mãe (obrigatório)</Label>
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa-mãe" />
                  </SelectTrigger>
                  <SelectContent>
                    {possiveisMaes.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            {MODULES.map((m) => (
              <label key={m.key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={modules.includes(m.key)}
                  onCheckedChange={() => toggleModule(m.key)}
                />
                <span className="text-sm">{m.label}</span>
              </label>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-uname">Nome do usuário</Label>
              <Input
                id="emp-uname"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-email">E-mail</Label>
              <Input
                id="emp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-pass">Senha provisória</Label>
              <Input
                id="emp-pass"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nível de acesso</Label>
              <Select value={orgRole} onValueChange={(v) => setOrgRole(v as typeof orgRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step > 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
            >
              Voltar
            </Button>
          )}
          {step < 4 && (
            <Button
              type="button"
              onClick={next}
              className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
            >
              Avançar
            </Button>
          )}
          {step === 3 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void finish(false)}
              disabled={saving}
            >
              Criar sem usuário
            </Button>
          )}
          {step === 4 && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void finish(false)}
                disabled={saving}
              >
                Pular — definir depois
              </Button>
              <Button
                type="button"
                onClick={() => void finish(true)}
                disabled={saving}
                className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
              >
                {saving ? "Criando..." : "Criar empresa + usuário"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarEmpresaPanel({
  row,
  empresas,
  access,
  onOpenChange,
  onSaved,
}: {
  row: EmpresaRow | null;
  empresas: EmpresaRow[];
  access: ReturnType<typeof getEmpresaAdminAccess>;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { currentOrg, hasOrgRole } = useAuth();
  const [nome, setNome] = useState("");
  const [managedBy, setManagedBy] = useState<string>("");
  const [parent, setParent] = useState<string>("");
  const [modules, setModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (row) {
      setNome(row.nome);
      setManagedBy(row.managed_by_org_id ?? "");
      setParent(row.parent_org_id ?? "");
      setModules(row.entitlements);
    }
  }, [row]);

  if (!row) return null;

  // Consultor admin pode ativar/desativar empresas que ele gere.
  // Platform admin já vem com access.canDeactivate=true.
  const canDeactivateThis =
    access.canDeactivate ||
    (hasOrgRole("admin") &&
      currentOrg?.tipo === "consultoria" &&
      row.managed_by_org_id === currentOrg?.id);

  const consultorias = empresas.filter(
    (e) => e.tipo === "consultoria" && e.id !== row.id && e.ativa,
  );
  const possiveisMaes = empresas.filter((e) => e.id !== row.id && e.ativa);
  // Quantos clientes esta consultoria gere (aviso ao desativar).
  const clientesGeridos = empresas.filter((e) => e.managed_by_org_id === row.id).length;

  function toggleModule(key: string) {
    setModules((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  }

  async function save() {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      await updateOrg({
        org: row!.id,
        nome: nome.trim(),
        managedBy: row!.tipo === "cliente" && managedBy ? managedBy : null,
        parent: row!.tipo === "unidade" && parent ? parent : null,
      });
      // Entitlements só quando a UI permite (platform admin) e houve mudança.
      if (access.canManageEntitlements) {
        const before = [...row!.entitlements].sort().join(",");
        const after = [...modules].sort().join(",");
        if (before !== after) await setOrgEntitlements(row!.id, modules);
      }
      toast.success("Empresa atualizada");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    setSaving(true);
    try {
      await setOrgActive(row!.id, !row!.ativa);
      toast.success(row!.ativa ? "Empresa desativada" : "Empresa reativada");
      setConfirmToggle(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar status");
    } finally {
      setSaving(false);
    }
  }

  async function removeOrg() {
    setSaving(true);
    try {
      await deleteOrg(row!.id);
      toast.success(`Empresa "${row!.nome}" excluída`);
      setConfirmDelete(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir empresa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={row !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar {TIPO_LABEL[row.tipo].toLowerCase()}</DialogTitle>
            <DialogDescription>
              {access.canManageEntitlements
                ? "Renomeie, ajuste o vínculo e os módulos."
                : "Renomeie a empresa. Módulos e vínculo são definidos pelo dono da plataforma."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-nome">Nome</Label>
              <Input
                id="ed-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={120}
              />
            </div>

            {/* Vínculo: só platform admin altera (canManageEntitlements == platform admin) */}
            {access.canManageEntitlements && row.tipo === "cliente" && (
              <div className="space-y-1.5">
                <Label>Consultoria gestora</Label>
                <Select
                  value={managedBy || "none"}
                  onValueChange={(v) => setManagedBy(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Cliente direto (sem consultoria)</SelectItem>
                    {consultorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {access.canManageEntitlements && row.tipo === "unidade" && (
              <div className="space-y-1.5">
                <Label>Empresa-mãe</Label>
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {possiveisMaes.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {access.canManageEntitlements && (
              <div className="space-y-2">
                <Label>Módulos</Label>
                {MODULES.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={modules.includes(m.key)}
                      onCheckedChange={() => toggleModule(m.key)}
                    />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {canDeactivateThis && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmToggle(true)}
                disabled={saving}
                className={row.ativa ? "text-destructive hover:text-destructive" : ""}
              >
                <Power className="h-3.5 w-3.5" /> {row.ativa ? "Desativar" : "Reativar"}
              </Button>
            )}
            {access.canDelete && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className="text-destructive hover:text-destructive"
                title="Excluir permanentemente"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmToggle} onOpenChange={setConfirmToggle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {row.ativa ? "Desativar" : "Reativar"} {row.nome}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {row.ativa
                ? `A empresa some para os usuários comuns; os dados são preservados e você pode reativá-la. ${
                    row.tipo === "consultoria" && clientesGeridos > 0
                      ? `Atenção: esta consultoria gere ${clientesGeridos} cliente(s) — eles NÃO são desativados automaticamente.`
                      : ""
                  }`
                : "A empresa volta a ficar acessível aos usuários vinculados."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void toggleActive()}
              className={
                row.ativa
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {row.ativa ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {row.nome} permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível e remove a empresa de vez. Só é permitida se ela não tiver
              unidades, clientes geridos ou dados (inspeções, RTI, EPIs…). Se tiver, prefira
              <strong> desativar</strong>, que preserva tudo.
              {row.tipo === "consultoria" && clientesGeridos > 0 && (
                <>
                  {" "}
                  Esta consultoria gere {clientesGeridos} cliente(s) — a exclusão será bloqueada até
                  desvinculá-los.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void removeOrg()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
