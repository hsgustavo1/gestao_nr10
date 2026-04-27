import { SiteHeader } from "@/components/site-header";

/**
 * Wrapper de página: topbar Atvos + régua gradiente (assinatura de marca)
 * + main + rodapé.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      {/* Régua decorativa Atvos (laranja → amarelo) */}
      <div className="atvos-rule" aria-hidden />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mt-8 border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Segurança Operacional · Bloqueio de energias perigosas
      </footer>
    </div>
  );
}