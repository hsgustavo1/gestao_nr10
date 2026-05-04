import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, ShieldCheck, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Redefinir senha — Bloqueio de energias perigosas" }] }),
});

const schema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres").max(128),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase processa o token do hash automaticamente — checa se há sessão de recovery
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida. Você já está autenticado.");
      navigate({ to: "/cadeados" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-brand-blue px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-0 mb-6">
          <span className="text-[14px] font-bold uppercase tracking-[0.05em] text-white">
            RAC - Bloqueio de energias perigosas
          </span>
        </Link>

        <div className="rounded-2xl bg-card text-card-foreground shadow-card-soft p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient shadow-brand">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Definir nova senha</h2>
              <p className="text-xs text-muted-foreground">Escolha uma senha forte (mín. 8 caracteres).</p>
            </div>
          </div>

          {!ready ? (
            <p className="text-sm text-muted-foreground">
              Validando seu link de redefinição... Se isso demorar, verifique se você abriu o link mais
              recente recebido por e-mail.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-gradient text-white shadow-brand hover:opacity-95"
              >
                {loading ? "Aguarde..." : "Redefinir senha"}
                {!loading && <ArrowRight className="ml-1 h-4 w-4" />}
              </Button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link
              to="/login"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Lock className="h-3 w-3" /> Voltar para entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
