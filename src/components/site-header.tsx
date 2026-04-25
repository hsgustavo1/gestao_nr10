import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, isAdmin, isStaff, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-brand-blue shadow-card-soft">
            <Lock className="h-5 w-5 text-white" />
            <span className="absolute -bottom-1 left-1 right-1 h-1 rounded-full bg-brand-gradient" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight text-foreground">LOTO Atvos</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Controle de Cadeados
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/cadeados">Cadeados</NavLink>
          {isAdmin && <NavLink to="/admin/usuarios">Usuários</NavLink>}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                {isAdmin ? "Dono RAC" : isStaff ? "Apoio RAC" : "Visualização"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="bg-brand-gradient text-white shadow-brand hover:opacity-95">
              <Link to="/login">
                <LogIn className="h-4 w-4" /> Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "bg-secondary text-foreground" }}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
    >
      {children}
    </Link>
  );
}