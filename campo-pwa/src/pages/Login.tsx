import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

// Evento de instalação do PWA (não tipado na lib.dom padrão).
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  // Captura o convite de instalação do navegador (o "download" que aparece).
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao fazer login";
      // Falha de rede no primeiro login: mensagem clara em vez de "Failed to fetch".
      if (!navigator.onLine || /fetch|network|networkerror/i.test(msg)) {
        setError(
          "Sem conexão. O primeiro login neste aparelho precisa de internet — conecte-se e tente de novo. Depois disso, o app funciona offline.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Campo NR-10</h1>
          <p className="text-sm text-slate-400 mt-1">Inspeção elétrica em campo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="seu@email.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 rounded-lg bg-red-900/20 px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold transition-colors"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {installPrompt && (
          <button
            onClick={handleInstall}
            className="w-full rounded-lg border border-blue-500/60 text-blue-300 hover:bg-blue-500/10 px-4 py-2.5 text-sm font-medium transition-colors"
          >
            📲 Instalar app no aparelho (para usar offline)
          </button>
        )}

        {!navigator.onLine && (
          <p className="text-xs text-center text-yellow-400">
            Sem conexão. Você pode entrar se já fez login antes neste aparelho e a sessão não
            expirou. O primeiro login precisa de internet.
          </p>
        )}

        <p className="text-[11px] text-center text-slate-500">
          Dica: instale o app e faça o primeiro login com internet. Depois, dá para coletar
          inspeções e fotos 100% offline — o envio acontece sozinho quando o sinal voltar.
        </p>
      </div>
    </div>
  );
}
