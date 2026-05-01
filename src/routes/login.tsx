import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, Eye, ShieldCheck, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Bloqueio de energias perigosas" }] }),
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
        navigate({ to: "/dashboard" });
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
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Hero azul Atvos */}
      <aside className="relative hidden lg:flex flex-col justify-between bg-brand-blue text-white p-12 overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-1.5 bg-brand-gradient" />
        <Link to="/" className="flex items-center gap-0">
          <span className="text-[14px] font-bold uppercase tracking-[0.05em] text-white">
            
          </span>
        </Link>

        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" /> 
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            Bloqueio de energias perigosas <span className="text-brand-gradient">salva vidas.</span>
          </h1>
          <p className="mt-4 text-white/75 text-sm leading-relaxed">
            
          </p>
        </div>

        <div className="text-[11px] uppercase tracking-wider text-white/45">
          
        </div>
      </aside>

      {/* Formulário */}
      <main className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Brand mobile */}
          <Link to="/" className="lg:hidden flex items-center gap-0 mb-8">
             <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#0A2D48]">
              
            </span>
          </Link>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              {mode === "forgot" ? "Recuperar senha" : mode === "signup" ? "Criar conta" : "Entrar no sistema"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "forgot"
                ? "Informe seu e-mail e enviaremos um link para redefinir a senha."
                : mode === "signup"
                ? "Após o cadastro, um Admin precisa aprovar seu perfil."
                : "Acesso para Dono de RAC e Apoios. A consulta é aberta para todos os Integrantes."}
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
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
                <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full bg-brand-gradient text-white shadow-brand hover:opacity-95">
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
          <Button
            type="button"
            variant="outline"
            onClick={onViewer}
            className="w-full border-2"
          >
            <Eye className="h-4 w-4" /> Acesso somente consulta
          </Button>
          <p className="mt-2 text-[11px] text-center text-muted-foreground">
            Sem login, você pode consultar dispositivos e o dashboard, além de imprimir etiquetas, mas não pode cadastrar novos dispositivos.
          </p>

          <div className="mt-8 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> Voltar à página inicial
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}