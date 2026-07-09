import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LayoutTemplate,
  Zap,
  ClipboardList,
  ScanSearch,
  Users,
  HardHat,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  getRtiCampoAccess,
  getGestaoCompletaAccess,
  getLotoAccess,
  getPessoasAccess,
} from "@/lib/tenancy-gates";

type SubItem = { label: string; to: string };

type NavGroup = {
  label: string;
  icon: React.FC<{ className?: string }>;
  prefixes: string[];
  children: SubItem[];
  gate: boolean;
};

function SidebarSubLink({ to, label }: SubItem) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={cn(
        "block pl-3 pr-2 py-[5px] text-[12px] rounded-sm transition-colors duration-75 text-white/70",
        active ? "font-semibold text-white bg-white/10" : "hover:text-white/90",
      )}
    >
      {label}
    </Link>
  );
}

function SidebarGroup({ group }: { group: NavGroup }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const Icon = group.icon;
  const isActive = group.prefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const [open, setOpen] = useState(isActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-[9px] pl-[13px] pr-3 h-[34px] text-[13px] rounded-md transition-colors duration-100",
          isActive
            ? "bg-white/10 text-white font-semibold"
            : "text-white/70 font-medium hover:bg-white/10 hover:text-white/90",
        )}
      >
        <Icon className={cn("h-[14px] w-[14px] shrink-0", isActive ? "text-white" : "text-white/70")} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-white/50 transition-transform duration-150",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      {open && (
        <div className="ml-[22px] pl-3 border-l border-white/10 flex flex-col gap-0.5 py-1">
          {group.children.map((c) => (
            <SidebarSubLink key={c.to} {...c} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarSingleLink({
  label,
  to,
  icon: Icon,
  prefixes,
}: {
  label: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  prefixes?: string[];
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ps = prefixes ?? [to];
  const active = ps.some((p) => pathname === p || pathname.startsWith(p + "/"));
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-[9px] pl-[13px] pr-3 h-[34px] text-[13px] rounded-md transition-colors duration-100",
        active
          ? "bg-white/10 text-white font-semibold"
          : "text-white/70 font-medium hover:bg-white/10 hover:text-white/90",
      )}
    >
      <Icon className={cn("h-[14px] w-[14px] shrink-0", active ? "text-white" : "text-white/70")} />
      {label}
    </Link>
  );
}

export function AppSidebar() {
  const auth = useAuth();
  const { isPlatformAdmin, hasEntitlement, isAdmin, hasOrgRole, currentOrg } = auth;
  const { canView: canViewLoto } = getLotoAccess(auth);
  const { canView: canViewGestao } = getGestaoCompletaAccess(auth);
  const { canView: canViewRtiCampo, canEdit: canEditRtiCampo } = getRtiCampoAccess(auth);
  const { canEdit: canEditPessoas } = getPessoasAccess(auth);
  const canManageUsers = isAdmin || hasOrgRole("admin");
  const canManageEmpresas =
    isPlatformAdmin || (hasOrgRole("admin") && currentOrg?.tipo === "consultoria");

  const groups: NavGroup[] = [
    {
      label: "LOTO",
      icon: LayoutDashboard,
      prefixes: ["/dashboard", "/cadeados", "/violacoes", "/admin/reports", "/admin/carga", "/admin/certificados"],
      gate: canViewLoto,
      children: [
        { label: "Dashboard", to: "/dashboard" },
        { label: "Base de dados", to: "/cadeados" },
        { label: "Violações", to: "/violacoes" },
        ...(isAdmin
          ? [
              { label: "Inconsistências", to: "/admin/reports" },
              { label: "Carga", to: "/admin/carga" },
              { label: "Importar Certificados", to: "/admin/certificados/importar" },
            ]
          : []),
      ],
    },
    {
      label: "NR-10",
      icon: Zap,
      prefixes: ["/nr10", "/relatorio", "/vencimentos", "/incidentes", "/admin/auditoria"],
      gate: canViewGestao,
      children: [
        { label: "Prontuário (PIE)", to: "/nr10" },
        { label: "Relatório de Conformidade", to: "/relatorio" },
        { label: "Dossiê de Fiscalização", to: "/relatorio/dossie" },
        { label: "Central de Vencimentos", to: "/vencimentos" },
        { label: "Incidentes Elétricos", to: "/incidentes" },
        ...(isAdmin ? [{ label: "Trilha de Auditoria", to: "/admin/auditoria" }] : []),
      ],
    },
    {
      label: "RTI",
      icon: ClipboardList,
      prefixes: ["/rti", "/campo"],
      gate: canViewRtiCampo,
      children: [
        { label: "Dashboard", to: "/rti" },
        { label: "Plano de Ação (NCs)", to: "/rti/plano" },
        { label: "Análise de Custos", to: "/rti/custos" },
        { label: "Evolução mensal", to: "/rti/evolucao" },
        ...(canEditRtiCampo
          ? [
              { label: "Coleta em Campo", to: "/campo" },
              { label: "Modos de falha", to: "/campo/modos" },
              { label: "Importar RTI", to: "/rti/importar" },
              { label: "Importar evidências", to: "/rti/evidencias" },
              { label: "Gestão de Relatórios", to: "/rti/gestao" },
            ]
          : []),
      ],
    },
    {
      label: "Inspeções",
      icon: ScanSearch,
      prefixes: ["/termografias", "/cercon", "/spda"],
      gate: isPlatformAdmin,
      children: [
        { label: "Termografias", to: "/termografias" },
        { label: "Cercon", to: "/cercon" },
        { label: "SPDA", to: "/spda" },
      ],
    },
    {
      label: "Pessoas",
      icon: Users,
      prefixes: ["/qualificacoes", "/admin/qualificacoes"],
      gate: isPlatformAdmin || hasEntitlement("pessoas"),
      children: [
        { label: "Dashboard", to: "/qualificacoes" },
        { label: "Colaboradores", to: "/qualificacoes/integrantes" },
        { label: "Qualificação", to: "/qualificacoes/colaboradores" },
        { label: "Capacitação", to: "/qualificacoes/nr10" },
        { label: "Instruções de trabalho", to: "/qualificacoes/instrucoes" },
        { label: "Autorizações", to: "/qualificacoes/autorizacoes" },
        { label: "ASOs", to: "/qualificacoes/asos" },
        { label: "Habilitação", to: "/qualificacoes/plh" },
        ...(canEditPessoas ? [{ label: "Importar dados", to: "/admin/qualificacoes/carga" }] : []),
      ],
    },
  ];

  const visible = groups.filter((g) => g.gate);
  const showSettings = canManageUsers || canManageEmpresas;
  const settingsTo = canManageEmpresas ? "/admin/empresas" : "/admin/usuarios";

  return (
    <aside className="hidden lg:flex w-[200px] shrink-0 flex-col bg-[#0C3326] sticky top-[52px] h-[calc(100vh-52px)] self-start overflow-y-auto">
      <div className="flex flex-col flex-1 py-3 px-2 gap-0.5">
        {visible.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {visible.map((g) => (
              <SidebarGroup key={g.label} group={g} />
            ))}
          </div>
        )}

        {canViewGestao && (
          <div className="mt-1">
            <SidebarSingleLink label="EPIs e EPCs" to="/epis" icon={HardHat} />
          </div>
        )}

        {showSettings && (
          <div className="mt-auto pt-3">
            <div className="h-px bg-white/10 mx-2 mb-2" />
            {isPlatformAdmin && (
              <SidebarSingleLink
                label="Padrões"
                to="/admin/padroes"
                icon={LayoutTemplate}
                prefixes={["/admin/padroes"]}
              />
            )}
            <SidebarSingleLink
              label="Configurações"
              to={settingsTo}
              icon={Settings}
              prefixes={["/admin/empresas", "/admin/usuarios"]}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
