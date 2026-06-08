import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut, Eye, Menu, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Topbar Atvos — fundo azul-marinho fixo (#0A2D48), wordmark "atvos."
 * com ponto laranja, nav horizontal com underline laranja no item ativo,
 * pill do usuário (avatar com iniciais em gradiente laranja + nome + cargo).
 * Régua decorativa de 3px renderizada logo abaixo (no PageShell).
 */
export function SiteHeader() {
  const { user, isAdmin, isStaff, isViewer, signOut, exitViewerMode } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const cargo = isAdmin ? "Dono de RAC (Admin)" : isStaff ? "Apoio" : "Consulta";
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "";
  const initials = getInitials(displayName);

  return (
    <header className="sticky top-0 z-40 atvos-topbar shadow-[0_2px_0_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-4 gap-2">
        {/* Wordmark + nav */}
        <div className="flex items-center gap-2 sm:gap-8 min-w-0">
          {/* Hambúrguer (mobile/tablet) */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menu"
                className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-white/85 hover:bg-white/10"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-[#0A2D48] text-white border-r-0">
              <SheetHeader className="px-4 py-4 border-b border-white/10">
                <SheetTitle className="text-white text-sm uppercase tracking-wider">
                  RAC — Bloqueio
                </SheetTitle>
              </SheetHeader>
              {user && (
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                  <span aria-hidden className="atvos-avatar grid h-9 w-9 place-items-center rounded-full text-xs">
                    {initials}
                  </span>
                  <div className="leading-tight min-w-0">
                    <div className="text-sm font-semibold truncate">{displayName}</div>
                    <div className="text-[10px] uppercase tracking-wider text-white/60">{cargo}</div>
                  </div>
                </div>
              )}
              <nav className="flex flex-col p-2">
                <MobileNavLink to="/dashboard" onNav={() => setMenuOpen(false)}>Dashboard</MobileNavLink>
                <MobileNavLink to="/cadeados" onNav={() => setMenuOpen(false)}>RAC — Base de dados</MobileNavLink>
                <MobileNavLink to="/violacoes" onNav={() => setMenuOpen(false)}>RAC — Violações</MobileNavLink>
                {isAdmin && <MobileNavLink to="/admin/reports" onNav={() => setMenuOpen(false)}>RAC — Inconsistências</MobileNavLink>}
                {isAdmin && <MobileNavLink to="/admin/carga" onNav={() => setMenuOpen(false)}>RAC — Carga</MobileNavLink>}
                {isAdmin && <MobileNavLink to="/admin/usuarios" onNav={() => setMenuOpen(false)}>RAC — Controle de acessos</MobileNavLink>}
                <MobileNavLink to="/qualificacoes/colaboradores" onNav={() => setMenuOpen(false)}>Qualificações — Colaboradores</MobileNavLink>
                <MobileNavLink to="/qualificacoes/nr10" onNav={() => setMenuOpen(false)}>Qualificações — NR-10</MobileNavLink>
                <MobileNavLink to="/qualificacoes/instrucoes" onNav={() => setMenuOpen(false)}>Qualificações — ITs</MobileNavLink>
                <MobileNavLink to="/qualificacoes/autorizacoes" onNav={() => setMenuOpen(false)}>Qualificações — Autorizações</MobileNavLink>
                {isAdmin && <MobileNavLink to="/admin/qualificacoes/carga" onNav={() => setMenuOpen(false)}>Qualificações — Importar xlsx</MobileNavLink>}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-0 min-w-0">
            <span className="text-[12px] sm:text-[14px] font-bold uppercase tracking-[0.05em] text-white truncate">
              <span className="hidden sm:inline">RAC - Bloqueio de energias perigosas&nbsp;&nbsp;</span>
              <span className="sm:hidden">RAC — Bloqueio</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <RACDropdown />
            <QualDropdown />
          </nav>
        </div>

        {/* Pill usuário ou botão Entrar */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2.5 rounded-full bg-white/8 pr-3 pl-1 py-1 ring-1 ring-white/10">
                <span
                  aria-hidden
                  className="atvos-avatar grid h-8 w-8 place-items-center rounded-full text-xs"
                >
                  {initials}
                </span>
                <div className="leading-tight">
                  <div className="text-xs font-semibold text-white">{displayName}</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/60">
                    {cargo}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10 hover:text-white transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            </div>
          ) : isViewer ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-[11px] font-medium text-white/85">
                <Eye className="h-3 w-3" /> Consulta
              </span>
              <Link
                to="/login"
                onClick={() => exitViewerMode()}
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#F79220] to-[#E35D12] px-4 py-1.5 text-xs font-semibold text-white shadow-brand hover:opacity-95 transition-opacity"
              >
                <LogIn className="h-3.5 w-3.5" /> Entrar
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#F79220] to-[#E35D12] px-4 py-1.5 text-xs font-semibold text-white shadow-brand hover:opacity-95 transition-opacity"
            >
              <LogIn className="h-3.5 w-3.5" /> Entrar
            </Link>
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
      className="relative rounded-md px-3 py-1.5 text-sm font-medium text-white/75 hover:text-white transition-colors"
      activeProps={{
        className:
          "text-white after:content-[''] after:absolute after:left-3 after:right-3 after:-bottom-[18px] after:h-[3px] after:rounded-t-sm after:bg-gradient-to-r after:from-[#F79220] after:to-[#E35D12]",
      }}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ to, children, onNav }: { to: string; children: React.ReactNode; onNav: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNav}
      className="rounded-md px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
      activeProps={{ className: "bg-white/10 text-white" }}
    >
      {children}
    </Link>
  );
}

function RACDropdown() {
  const { isAdmin } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-md px-3 py-1.5 text-sm font-medium text-white/75 hover:text-white transition-colors inline-flex items-center gap-1"
        >
          RAC — Bloqueio <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuItem asChild>
          <Link to="/cadeados" className="cursor-pointer">Base de dados</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/violacoes" className="cursor-pointer">Violações de dispositivos</Link>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin/reports" className="cursor-pointer">Inconsistências</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/carga" className="cursor-pointer">Carga</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/usuarios" className="cursor-pointer">Controle de acessos</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QualDropdown() {
  const { isAdmin } = useAuth();

  const items = [
    { to: "/qualificacoes/colaboradores", label: "Colaboradores" },
    { to: "/qualificacoes/nr10", label: "NR-10" },
    { to: "/qualificacoes/instrucoes", label: "Instruções de trabalho" },
    { to: "/qualificacoes/autorizacoes", label: "Autorizações" },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-md px-3 py-1.5 text-sm font-medium text-white/75 hover:text-white transition-colors inline-flex items-center gap-1"
        >
          Qualificações <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to} className="cursor-pointer">{item.label}</Link>
          </DropdownMenuItem>
        ))}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin/qualificacoes/carga" className="cursor-pointer">Importar xlsx</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getInitials(name: string): string {
  if (!name) return "??";
  const clean = name.trim().replace(/\./g, " ").replace(/\s+/g, " ");
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}