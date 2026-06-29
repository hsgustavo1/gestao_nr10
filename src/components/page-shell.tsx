import { SiteHeader } from "@/components/site-header";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="brand-rule" aria-hidden />
      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-8">{children}</main>
      <footer className="mt-8 border-t border-border/60 py-6 px-4 text-center leading-relaxed text-muted-foreground text-xs sm:text-sm">
        Conforme - Sistema de gestão de Normas Regulamentadoras
      </footer>
    </div>
  );
}
