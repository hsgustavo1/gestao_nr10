import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logEvent, colorLabel, type Padlock } from "@/lib/padlocks";

/**
 * Exclusão permanente — admin only.
 * Revalida a senha do admin atual antes de apagar e registra no histórico ANTES do DELETE
 * (eventos sobrevivem porque a FK não cascateia).
 */
export function DeletePadlockDialog({
  open, onOpenChange, padlock, onDeleted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  padlock: Padlock;
  onDeleted: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setPassword(""); setLoading(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) return toast.error("Apenas administradores podem excluir permanentemente");
    if (!user?.email) return toast.error("Sessão inválida");
    if (!password) return toast.error("Informe sua senha de administrador");

    setLoading(true);
    // 1) Revalida senha sem perder a sessão (re-login implícito do mesmo usuário)
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (authErr) {
      setLoading(false);
      return toast.error("Senha incorreta");
    }

    // 2) Loga ANTES de apagar — evento permanece no log mesmo após DELETE
    await logEvent({
      padlock_id: padlock.id,
      padlock_code: padlock.code,
      action: "deleted",
      actor_id: user.id,
      actor_name: user.email,
      previous_data: padlock,
      notes: "Exclusão permanente confirmada com senha de administrador",
    });

    // 3) DELETE
    const { error } = await supabase.from("padlocks").delete().eq("id", padlock.id);
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    toast.success("Cadeado excluído permanentemente");
    reset();
    onOpenChange(false);
    onDeleted();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Excluir permanentemente
          </DialogTitle>
          <DialogDescription>
            Esta ação é <strong>irreversível</strong>. O cadeado{" "}
            <strong>{colorLabel[padlock.color]} #{padlock.number}</strong>{" "}
            será apagado do banco. O histórico de auditoria permanece preservado.
            <br />
            Em geral, prefira <em>Cancelar</em> em vez de excluir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-pass">Confirme sua senha de administrador</Label>
            <Input
              id="admin-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">Logado como {user?.email}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
            <Button type="submit" disabled={loading} variant="destructive">
              {loading ? "Excluindo..." : "Excluir permanentemente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}