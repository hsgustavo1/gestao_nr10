import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/app-sidebar";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="flex min-h-[calc(100vh-52px)]">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
          <footer className="border-t border-border/60 py-6 px-4 text-center text-muted-foreground text-xs">
            Conforme. — Controle técnico. Conformidade garantida.
          </footer>
        </div>
      </div>
    </div>
  );
}
