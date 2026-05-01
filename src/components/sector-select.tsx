import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const ADD_NEW = "__add_new__";

export function SectorSelect({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const { user, isAdmin } = useAuth();
  const [sectors, setSectors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newSector, setNewSector] = useState("");
  const [adminPwd, setAdminPwd] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "sectors")
      .maybeSingle();
    if (!error && data?.valor) {
      try {
        const arr = JSON.parse(data.valor) as string[];
        setSectors(arr.sort((a, b) => a.localeCompare(b, "pt-BR")));
      } catch {
        setSectors([]);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function handleSelect(v: string) {
    if (v === ADD_NEW) {
      setAddOpen(true);
      return;
    }
    onChange(v);
  }

  async function submitNew(e: FormEvent) {
    e.preventDefault();
    const name = newSector.trim().toUpperCase();
    if (!name) return toast.error("Informe o nome do setor");
    if (sectors.some((s) => s.toUpperCase() === name)) return toast.error("Setor já existe");
    if (!user?.email) return toast.error("Sessão inválida");
    if (!adminPwd) return toast.error("Informe a senha de Admin");

    setSaving(true);

    // Revalida senha do admin atual via signInWithPassword (não desloga sessão existente)
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: adminPwd,
    });
    if (authErr) {
      setSaving(false);
      return toast.error("Senha de Admin incorreta");
    }

    const next = [...sectors, name];
    const { error } = await supabase
      .from("configuracoes")
      .update({ valor: JSON.stringify(next), updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("chave", "sectors");
    if (error) {
      setSaving(false);
      return toast.error("Falha ao salvar: " + error.message);
    }
    setSectors(next.sort((a, b) => a.localeCompare(b, "pt-BR")));
    onChange(name);
    setSaving(false);
    setAddOpen(false);
    setNewSector("");
    setAdminPwd("");
    toast.success("Setor adicionado");
  }

  return (
    <>
      <Select value={value || undefined} onValueChange={handleSelect} required={required} disabled={loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Carregando..." : "Selecione o setor"} />
        </SelectTrigger>
        <SelectContent>
          {sectors.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
          {isAdmin && (
            <SelectItem value={ADD_NEW} className="text-primary">
              <span className="inline-flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" /> Outro (cadastrar novo setor)
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setNewSector(""); setAdminPwd(""); } setAddOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo setor</DialogTitle>
            <DialogDescription>
              Adicione uma nova opção ao menu de setores. Requer confirmação da senha de Admin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitNew} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-sector">Nome do setor</Label>
              <Input
                id="new-sector"
                value={newSector}
                onChange={(e) => setNewSector(e.target.value.toUpperCase())}
                maxLength={100}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-pwd">Senha de Admin ({user?.email})</Label>
              <Input
                id="admin-pwd"
                type="password"
                value={adminPwd}
                onChange={(e) => setAdminPwd(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
                {saving ? "Salvando..." : "Adicionar setor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}