import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Conforme." }] }),
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(128),
});

function LoginPage() {
  const navigate = useNavigate();
  const { refreshRoles, enterViewerMode } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const emailParsed = z.string().trim().email("E-mail inválido").max(255).safeParse(email);
        if (!emailParsed.success) throw new Error(emailParsed.error.issues[0].message);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de redefinição para o seu e-mail.");
        setMode("signin");
        return;
      }

      const parsed = schema.safeParse({ email, password });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await refreshRoles();
        toast.success("Bem-vindo!");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Aguarde um Admin atribuir seu perfil.");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  function onViewer() {
    enterViewerMode();
    toast.success("Modo visualização ativado.");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Hero pinho */}
      <aside className="relative hidden lg:flex flex-col justify-between text-white p-12 overflow-hidden" style={{ background: "linear-gradient(160deg, #0C3326 0%, #174830 100%)" }}>
        <div className="absolute inset-y-0 right-0 w-1.5 bg-brand-gradient" />
        {/* Círculos decorativos */}
        <div className="absolute right-[-80px] top-[-80px] w-80 h-80 rounded-full border border-white/10" />
        <div className="absolute right-[-40px] top-[-40px] w-48 h-48 rounded-full border border-white/10" />

        <div className="text-[22px] font-extrabold tracking-tight text-white relative z-10">
          Conforme<span style={{ color: "var(--conforme-emerald)" }}>.</span>
        </div>

        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--conforme-emerald)" }} />
            <span style={{ color: "var(--conforme-emerald)" }}>NR-10</span>
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Conformidade legal e Segurança de{" "}
            <span style={{ color: "var(--conforme-emerald)" }}>sistemas elétricos</span>
          </h1>
          <p className="mt-4 text-white/65 text-sm leading-relaxed">
            Controle técnico. Conformidade garantida.
          </p>
        </div>

        <div className="text-[11px] uppercase tracking-wider text-white/35 font-mono">
          Conforme. · NR-10
        </div>
      </aside>

      {/* Formulário */}
      <main className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Brand mobile */}
          <div className="lg:hidden mb-8 text-[18px] font-extrabold tracking-tight text-foreground">
            Conforme<span style={{ color: "var(--conforme-green)" }}>.</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              {mode === "forgot"
                ? "Recuperar senha"
                : mode === "signup"
                  ? "Criar conta"
                  : "Entrar no sistema"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "forgot"
                ? "Informe seu e-mail e enviaremos um link para redefinir a senha."
                : mode === "signup"
                  ? "Após o cadastro, um administrador precisa aprovar seu perfil."
                  : "Acesso ao sistema de gestão NR-10."}
            </p>
          </div>

          {mode !== "forgot" && (
            <div className="flex gap-1 mb-5 rounded-lg bg-secondary p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${mode === "signin" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${mode === "signup" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              >
                Criar conta
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome de exibição</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-gradient text-white shadow-brand hover:opacity-95 mt-1"
            >
              {loading
                ? "Aguarde..."
                : mode === "forgot"
                  ? "Enviar link de redefinição"
                  : mode === "signin"
                    ? "Entrar"
                    : "Criar conta"}
              {!loading && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                ← Voltar para entrar
              </button>
            )}
          </form>

          {/* Divisor */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Modo visualização */}
          <Button type="button" variant="outline" onClick={onViewer} className="w-full border-2">
            Acesso somente consulta
          </Button>
          <p className="mt-2 text-[11px] text-center text-muted-foreground">
            Visualize informações sem necessidade de login, mas sem permissão para registrar dados.
          </p>
        </div>
      </main>
    </div>
  );
}
