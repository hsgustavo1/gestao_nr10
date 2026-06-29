import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LogIn,
  LogOut,
  Eye,
  Menu,
  ChevronDown,
  BellRing,
  Building2,
  CornerDownRight,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getRtiCampoAccess } from "@/lib/tenancy-gates";
import { buildOrgTree } from "@/lib/org-tree";
import { useVencimentosBadge } from "@/lib/vencimentos";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * Topbar Conforme — fundo pinho fixo (#0C3326), wordmark "Gestão NR-10",
 * nav horizontal com underline esmeralda→verde no item ativo,
 * pill do usuário (avatar com iniciais em gradiente verde + nome + cargo).
 * Régua decorativa de 3px renderizada logo abaixo (no PageShell).
 */
export function SiteHeader() {
  const auth = useAuth();
  const { user, isAdmin, isStaff, isViewer, signOut, exitViewerMode, hasOrgRole, hasEntitlement, displayName } = auth;
  const { canView: canViewRtiCampo, canEdit: canEditRtiCampo } = getRtiCampoAccess(auth);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Quem gerencia acessos: admin global (legado) OU admin/owner na org ativa
  // (cobre o consultor que gerencia o cliente via managed_by).
  const canManageUsers = isAdmin || hasOrgRole("admin");
  // Gestão de empresas: dono da plataforma ou admin de org do tipo consultoria.
  const { isPlatformAdmin, currentOrg } = auth;
  const canManageEmpresas =
    isPlatformAdmin || (hasOrgRole("admin") && currentOrg?.tipo === "consultoria");
  const cargo = isAdmin ? "Dono de RAC (Admin)" : isStaff ? "Apoio" : "Consulta";
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
            <SheetContent side="left" className="w-72 p-0 bg-[#0C3326] text-white border-r-0">
              <SheetHeader className="px-4 py-4 border-b border-white/10">
                <SheetTitle className="text-white text-sm uppercase tracking-wider">
                  Gestão NR-10
                </SheetTitle>
              </SheetHeader>
              {user && (
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                  <span
                    aria-hidden
                    className="atvos-avatar grid h-9 w-9 place-items-center rounded-full text-xs"
                  >
                    {initials}
                  </span>
                  <div className="leading-tight min-w-0">
                    <div className="text-sm font-semibold truncate">{displayName}</div>
                    <div className="text-[10px] uppercase tracking-wider text-white/60">
                      {cargo}
                    </div>
                  </div>
                </div>
              )}
              {user && (canManageUsers || canManageEmpresas) && (
                <div className="p-2 border-b border-white/10 space-y-0.5">
                  {canManageEmpresas && (
                    <MobileNavLink to="/admin/empresas" onNav={() => setMenuOpen(false)}>
                      Gestão de empresas
                    </MobileNavLink>
                  )}
                  {canManageUsers && (
                    <MobileNavLink to="/admin/usuarios" onNav={() => setMenuOpen(false)}>
                      Controle de acessos
                    </MobileNavLink>
                  )}
                </div>
              )}
              <nav className="flex flex-col p-2 gap-0.5">
                {isPlatformAdmin && (
                  <>
                    <MobileNavGroup
                      label="RAC — Bloqueio"
                      prefixes={[
                        "/dashboard",
                        "/cadeados",
                        "/violacoes",
                        "/admin/reports",
                        "/admin/carga",
                        "/admin/certificados",
                      ]}
                    >
                      <MobileNavLink to="/dashboard" onNav={() => setMenuOpen(false)}>
                        Dashboard
                      </MobileNavLink>
                      <MobileNavLink to="/cadeados" onNav={() => setMenuOpen(false)}>
                        Base de dados
                      </MobileNavLink>
                      <MobileNavLink to="/violacoes" onNav={() => setMenuOpen(false)}>
                        Violações
                      </MobileNavLink>
                      {isAdmin && (
                        <MobileNavLink to="/admin/reports" onNav={() => setMenuOpen(false)}>
                          Inconsistências
                        </MobileNavLink>
                      )}
                      {isAdmin && (
                        <MobileNavLink to="/admin/carga" onNav={() => setMenuOpen(false)}>
                          Carga
                        </MobileNavLink>
                      )}
                      {isAdmin && (
                        <MobileNavLink
                          to="/admin/certificados/importar"
                          onNav={() => setMenuOpen(false)}
                        >
                          Importar Certificados
                        </MobileNavLink>
                      )}
                    </MobileNavGroup>

                    <MobileNavGroup
                      label="NR-10"
                      prefixes={[
                        "/nr10",
                        "/relatorio",
                        "/vencimentos",
                        "/incidentes",
                        "/admin/auditoria",
                      ]}
                    >
                      <MobileNavLink to="/nr10" onNav={() => setMenuOpen(false)}>
                        Prontuário (PIE)
                      </MobileNavLink>
                      <MobileNavLink to="/relatorio" onNav={() => setMenuOpen(false)}>
                        Relatório de Conformidade
                      </MobileNavLink>
                      <MobileNavLink to="/relatorio/dossie" onNav={() => setMenuOpen(false)}>
                        Dossiê de Fiscalização
                      </MobileNavLink>
                      <MobileNavLink to="/vencimentos" onNav={() => setMenuOpen(false)}>
                        Central de Vencimentos
                      </MobileNavLink>
                      <MobileNavLink to="/incidentes" onNav={() => setMenuOpen(false)}>
                        Incidentes Elétricos
                      </MobileNavLink>
                      {isAdmin && (
                        <MobileNavLink to="/admin/auditoria" onNav={() => setMenuOpen(false)}>
                          Auditoria
                        </MobileNavLink>
                      )}
                    </MobileNavGroup>
                  </>
                )}

                {canViewRtiCampo && (
                  <MobileNavGroup label="RTI" prefixes={["/rti", "/campo"]}>
                    <MobileNavLink to="/rti" onNav={() => setMenuOpen(false)}>
                      Dashboard
                    </MobileNavLink>
                    <MobileNavLink to="/rti/plano" onNav={() => setMenuOpen(false)}>
                      Plano de Ação
                    </MobileNavLink>
                    <MobileNavLink to="/rti/custos" onNav={() => setMenuOpen(false)}>
                      Análise de Custos
                    </MobileNavLink>
                    <MobileNavLink to="/rti/evolucao" onNav={() => setMenuOpen(false)}>
                      Evolução mensal
                    </MobileNavLink>
                    {canEditRtiCampo && (
                      <MobileNavLink to="/campo" onNav={() => setMenuOpen(false)}>
                        Coleta em Campo
                      </MobileNavLink>
                    )}
                    {canEditRtiCampo && (
                      <MobileNavLink to="/campo/modos" onNav={() => setMenuOpen(false)}>
                        Modos de falha
                      </MobileNavLink>
                    )}
                    {canEditRtiCampo && (
                      <MobileNavLink to="/rti/importar" onNav={() => setMenuOpen(false)}>
                        Importar planilha
                      </MobileNavLink>
                    )}
                    {canEditRtiCampo && (
                      <MobileNavLink to="/rti/evidencias" onNav={() => setMenuOpen(false)}>
                        Importar evidências
                      </MobileNavLink>
                    )}
                    {canEditRtiCampo && (
                      <MobileNavLink to="/rti/gestao" onNav={() => setMenuOpen(false)}>
                        Gestão de Relatórios RTI
                      </MobileNavLink>
                    )}
                  </MobileNavGroup>
                )}

                {isPlatformAdmin && (
                  <MobileNavGroup
                    label="Inspeções"
                    prefixes={["/termografias", "/cercon", "/spda"]}
                  >
                    <MobileNavLink to="/termografias" onNav={() => setMenuOpen(false)}>
                      Termografias
                    </MobileNavLink>
                    <MobileNavLink to="/cercon" onNav={() => setMenuOpen(false)}>
                      Cercon
                    </MobileNavLink>
                    <MobileNavLink to="/spda" onNav={() => setMenuOpen(false)}>
                      SPDA
                    </MobileNavLink>
                  </MobileNavGroup>
                )}

                {(isPlatformAdmin || hasEntitlement("pessoas")) && <MobileNavGroup
                  label="Pessoas"
                  prefixes={["/qualificacoes", "/admin/qualificacoes"]}
                >
                  <MobileNavLink to="/qualificacoes" onNav={() => setMenuOpen(false)}>
                    Dashboard
                  </MobileNavLink>
                  <MobileNavLink to="/qualificacoes/integrantes" onNav={() => setMenuOpen(false)}>
                    Colaboradores
                  </MobileNavLink>
                  <MobileNavLink to="/qualificacoes/colaboradores" onNav={() => setMenuOpen(false)}>
                    Qualificação
                  </MobileNavLink>
                  <MobileNavLink to="/qualificacoes/nr10" onNav={() => setMenuOpen(false)}>
                    Capacitações NR-10
                  </MobileNavLink>
                  <MobileNavLink to="/qualificacoes/instrucoes" onNav={() => setMenuOpen(false)}>
                    ITs
                  </MobileNavLink>
                  <MobileNavLink to="/qualificacoes/autorizacoes" onNav={() => setMenuOpen(false)}>
                    Autorizações
                  </MobileNavLink>
                  <MobileNavLink to="/qualificacoes/asos" onNav={() => setMenuOpen(false)}>
                    ASOs
                  </MobileNavLink>
                  <MobileNavLink to="/qualificacoes/plh" onNav={() => setMenuOpen(false)}>
                    PLH
                  </MobileNavLink>
                  {isAdmin && (
                    <MobileNavLink to="/admin/qualificacoes/carga" onNav={() => setMenuOpen(false)}>
                      Importar xlsx
                    </MobileNavLink>
                  )}
                </MobileNavGroup>}

                {isPlatformAdmin && (
                  <MobileNavLink to="/epis" onNav={() => setMenuOpen(false)}>
                    EPIs e EPCs
                  </MobileNavLink>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-0 min-w-0">
            <span className="text-[12px] sm:text-[14px] font-bold uppercase tracking-[0.05em] text-white truncate">
              <span className="hidden sm:inline">Gestão NR-10&nbsp;&nbsp;</span>
              <span className="sm:hidden">Gestão NR-10</span>
            </span>
          </Link>

          {/* Dono do app (platform admin) vê tudo. Demais níveis (consultor/cliente)
              só compram RTI + Pessoas no MVP — o resto some do menu. */}
          <nav className="hidden lg:flex items-center gap-1">
            {isPlatformAdmin && <RACDropdown />}
            {isPlatformAdmin && <NR10Dropdown />}
            <RTIDropdown />
            {isPlatformAdmin && <InspecoesDropdown />}
            {(isPlatformAdmin || hasEntitlement("pessoas")) && <QualDropdown />}
            {isPlatformAdmin && <NavLink to="/epis">EPIs</NavLink>}
            {isPlatformAdmin && <VencimentosBell />}
          </nav>
        </div>

        {/* Pill usuário ou botão Entrar */}
        <div className="flex items-center gap-2 shrink-0">
          <OrgSwitcher />
          {user ? (
            <div className="flex items-center gap-2">
              <UserMenu
                displayName={displayName}
                initials={initials}
                cargo={cargo}
                canManageUsers={canManageUsers}
                canManageEmpresas={canManageEmpresas}
              />
              {/* Logout sempre acessível no mobile (onde o pill/menu fica oculto). */}
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="sm:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10 hover:text-white transition-colors"
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
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#34D399] to-[#059669] px-4 py-1.5 text-xs font-semibold text-white shadow-brand hover:opacity-95 transition-opacity"
              >
                <LogIn className="h-3.5 w-3.5" /> Entrar
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#34D399] to-[#059669] px-4 py-1.5 text-xs font-semibold text-white shadow-brand hover:opacity-95 transition-opacity"
            >
              <LogIn className="h-3.5 w-3.5" /> Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** Menu de conta do usuário (avatar). Concentra a gestão de acessos e o logout —
 * "Controle de acessos" saiu do menu RAC — Bloqueio (era resquício do LOTO) e
 * passou a viver aqui, por ser coisa de conta, não de feature. Oculto no mobile
 * (lá o acesso vem pelo Sheet + botão Sair dedicado). */
function UserMenu({
  displayName,
  initials,
  cargo,
  canManageUsers,
  canManageEmpresas,
}: {
  displayName: string;
  initials: string;
  cargo: string;
  canManageUsers: boolean;
  canManageEmpresas: boolean;
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hidden sm:flex items-center gap-2.5 rounded-full bg-white/8 pr-2.5 pl-1 py-1 ring-1 ring-white/10 hover:bg-white/15 transition-colors"
        >
          <span
            aria-hidden
            className="atvos-avatar grid h-8 w-8 place-items-center rounded-full text-xs"
          >
            {initials}
          </span>
          <div className="leading-tight text-left">
            <div className="text-xs font-semibold text-white">{displayName}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/60">{cargo}</div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-white/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[210px]">
        <div className="px-2 py-1.5">
          <div className="text-sm font-semibold truncate">{displayName}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{cargo}</div>
        </div>
        {(canManageUsers || canManageEmpresas) && <DropdownMenuSeparator />}
        {canManageEmpresas && (
          <DropdownMenuItem asChild>
            <Link to="/admin/empresas" className="cursor-pointer gap-2">
              <Building2 className="h-3.5 w-3.5" /> Gestão de empresas
            </Link>
          </DropdownMenuItem>
        )}
        {canManageUsers && (
          <DropdownMenuItem asChild>
            <Link to="/admin/usuarios" className="cursor-pointer gap-2">
              <Building2 className="h-3.5 w-3.5" /> Controle de acessos
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Seletor de organização ativa. Só aparece quando o usuário tem 2+ orgs
 * (consultor entre clientes, empresa-mãe entre unidades). Antes da migração
 * de tenancy estar aplicada/semeada, `orgs` fica vazio e este componente
 * não renderiza nada — comportamento atual preservado. */
function OrgSwitcher() {
  const { orgs, currentOrg, setCurrentOrg } = useAuth();
  if (orgs.length <= 1) return null;
  const sorted = [...orgs].sort((a, b) => (b.is_root ? 1 : 0) - (a.is_root ? 1 : 0));
  const tree = buildOrgTree(sorted);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-white/8 ring-1 ring-white/10 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/15 transition-colors"
        >
          <Building2 className="h-3.5 w-3.5" />
          <span className="max-w-[120px] sm:max-w-[160px] truncate">
            {currentOrg?.nome ?? "Selecionar"}
          </span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px]">
        {tree.map(({ org, depth }) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setCurrentOrg(org.id)}
            className="cursor-pointer gap-1.5"
            style={{ paddingLeft: 8 + depth * 16 }}
          >
            {depth > 0 && <CornerDownRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
            <span className="flex-1 truncate">{org.nome}</span>
            {org.id === currentOrg?.id && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                atual
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="relative rounded-md px-3 py-1.5 text-sm font-medium text-white/75 hover:text-white transition-colors"
      activeProps={{
        className:
          "text-white after:content-[''] after:absolute after:left-3 after:right-3 after:-bottom-[18px] after:h-[3px] after:rounded-t-sm after:bg-gradient-to-r after:from-[#34D399] after:to-[#059669]",
      }}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  to,
  children,
  onNav,
}: {
  to: string;
  children: React.ReactNode;
  onNav: () => void;
}) {
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

function MobileNavGroup({
  label,
  prefixes,
  children,
}: {
  label: string;
  prefixes: string[];
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const open = prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <Collapsible open={open}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
        >
          <span className={open ? "text-white" : "text-white/90"}>{label}</span>
          <ChevronDown
            className={`h-4 w-4 text-white/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3 pl-3 border-l border-white/10 flex flex-col gap-0.5 py-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NR10Dropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-md px-3 py-1.5 text-sm font-medium text-white/75 hover:text-white transition-colors inline-flex items-center gap-1"
        >
          NR-10 <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        <DropdownMenuItem asChild>
          <Link to="/nr10" className="cursor-pointer">
            Prontuário das Instalações (PIE)
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/relatorio" className="cursor-pointer">
            Relatório de Conformidade
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/relatorio/dossie" className="cursor-pointer">
            Dossiê de Fiscalização
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/vencimentos" className="cursor-pointer">
            Central de Vencimentos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/incidentes" className="cursor-pointer">
            Incidentes Elétricos
          </Link>
        </DropdownMenuItem>
        <NR10AdminItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NR10AdminItems() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to="/admin/auditoria" className="cursor-pointer">
          Trilha de Auditoria
        </Link>
      </DropdownMenuItem>
    </>
  );
}

function VencimentosBell() {
  const { count } = useVencimentosBadge();
  return (
    <Link
      to="/vencimentos"
      title="Central de Vencimentos"
      className="relative rounded-md px-2.5 py-1.5 text-white/75 hover:text-white transition-colors inline-flex items-center"
      activeProps={{ className: "text-white" }}
    >
      <BellRing className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-[16px] h-4 place-items-center rounded-full bg-gradient-to-br from-[#34D399] to-[#059669] px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function RTIDropdown() {
  const auth = useAuth();
  const { canView, canEdit } = getRtiCampoAccess(auth);
  if (!canView) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-md px-3 py-1.5 text-sm font-medium text-white/75 hover:text-white transition-colors inline-flex items-center gap-1"
        >
          RTI <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuItem asChild>
          <Link to="/rti" className="cursor-pointer">
            Dashboard do Plano de Ação
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/rti/plano" className="cursor-pointer">
            Plano de Ação (NCs)
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/rti/custos" className="cursor-pointer">
            Análise de Custos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/rti/evolucao" className="cursor-pointer">
            Evolução mensal
          </Link>
        </DropdownMenuItem>
        {canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/campo" className="cursor-pointer">
                Coleta em Campo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/campo/modos" className="cursor-pointer">
                Base de modos de falha
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/rti/importar" className="cursor-pointer">
                Importar planilha / Relatórios
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/rti/evidencias" className="cursor-pointer">
                Importar evidências em massa
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/rti/gestao" className="cursor-pointer">
                Gestão de Relatórios RTI
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InspecoesDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-md px-3 py-1.5 text-sm font-medium text-white/75 hover:text-white transition-colors inline-flex items-center gap-1"
        >
          Inspeções <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuItem asChild>
          <Link to="/termografias" className="cursor-pointer">
            Termografias
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/cercon" className="cursor-pointer">
            Cercon
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/spda" className="cursor-pointer">
            SPDA
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
          <Link to="/dashboard" className="cursor-pointer">
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/cadeados" className="cursor-pointer">
            Base de dados
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/violacoes" className="cursor-pointer">
            Violações de dispositivos
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin/reports" className="cursor-pointer">
                Inconsistências
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/carga" className="cursor-pointer">
                Carga
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/certificados/importar" className="cursor-pointer">
                Importar Certificados
              </Link>
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
    { to: "/qualificacoes/integrantes", label: "Colaboradores" },
    { to: "/qualificacoes/colaboradores", label: "Qualificação" },
    { to: "/qualificacoes/nr10", label: "Capacitações NR-10" },
    { to: "/qualificacoes/instrucoes", label: "Instruções de trabalho" },
    { to: "/qualificacoes/autorizacoes", label: "Autorizações" },
    { to: "/qualificacoes/asos", label: "ASOs" },
    { to: "/qualificacoes/plh", label: "PLH" },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-md px-3 py-1.5 text-sm font-medium text-white/75 hover:text-white transition-colors inline-flex items-center gap-1"
        >
          Pessoas <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuItem asChild>
          <Link to="/qualificacoes" className="cursor-pointer">
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to} className="cursor-pointer">
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin/qualificacoes/carga" className="cursor-pointer">
                Importar xlsx
              </Link>
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
