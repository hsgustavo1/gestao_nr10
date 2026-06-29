import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Zap,
  ClipboardList,
  MapPin,
  ScanSearch,
  Users,
  HardHat,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { getRtiCampoAccess, getGestaoCompletaAccess, getLotoAccess } from "@/lib/tenancy-gates";

type NavEntry = {
  label: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  prefixes?: string[];
};

function SidebarNavItem({ entry }: { entry: NavEntry }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prefixes = entry.prefixes ?? [entry.to];
  const active = prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const Icon = entry.icon;

  return (
    <Link
      to={entry.to}
      className={cn(
        "flex items-center gap-[9px] pl-[13px] pr-3 h-[34px] text-[13px] border-l-[3px] transition-[background,color] duration-100",
        active
          ? "border-l-[#334155] bg-secondary text-[#334155] font-semibold"
          : "border-l-transparent text-muted-foreground font-medium hover:bg-secondary/70 hover:text-foreground/70",
      )}
    >
      <Icon className="h-[14px] w-[14px] shrink-0" />
      {entry.label}
    </Link>
  );
}

export function AppSidebar() {
  const auth = useAuth();
  const { isPlatformAdmin, hasEntitlement, isAdmin, hasOrgRole, currentOrg } = auth;
  const { canView: canViewLoto } = getLotoAccess(auth);
  const { canView: canViewGestao } = getGestaoCompletaAccess(auth);
  const { canView: canViewRtiCampo, canEdit: canEditRtiCampo } = getRtiCampoAccess(auth);
  const canManageUsers = isAdmin || hasOrgRole("admin");
  const canManageEmpresas =
    isPlatformAdmin || (hasOrgRole("admin") && currentOrg?.tipo === "consultoria");

  type GatedEntry = NavEntry & { gate: boolean };

  const mainItems: GatedEntry[] = [
    {
      label: "Dashboard",
      to: "/dashboard",
      icon: LayoutDashboard,
      prefixes: ["/dashboard", "/cadeados", "/violacoes", "/admin/reports", "/admin/carga", "/admin/certificados"],
      gate: canViewLoto,
    },
    {
      label: "NR-10",
      to: "/nr10",
      icon: Zap,
      prefixes: ["/nr10", "/relatorio", "/vencimentos", "/incidentes", "/admin/auditoria"],
      gate: canViewGestao,
    },
    {
      label: "RTI",
      to: "/rti",
      icon: ClipboardList,
      prefixes: ["/rti"],
      gate: canViewRtiCampo,
    },
    {
      label: "Campo",
      to: "/campo",
      icon: MapPin,
      prefixes: ["/campo"],
      gate: canViewRtiCampo && canEditRtiCampo,
    },
    {
      label: "Inspeções",
      to: "/termografias",
      icon: ScanSearch,
      prefixes: ["/termografias", "/cercon", "/spda"],
      gate: isPlatformAdmin,
    },
    {
      label: "Pessoas",
      to: "/qualificacoes",
      icon: Users,
      prefixes: ["/qualificacoes", "/admin/qualificacoes"],
      gate: isPlatformAdmin || hasEntitlement("pessoas"),
    },
    {
      label: "EPIs",
      to: "/epis",
      icon: HardHat,
      gate: canViewGestao,
    },
  ];

  const visible = mainItems.filter((e) => e.gate);
  const showSettings = canManageUsers || canManageEmpresas;
  const settingsTo = canManageEmpresas ? "/admin/empresas" : "/admin/usuarios";

  return (
    <aside className="hidden lg:flex w-[200px] shrink-0 flex-col border-r border-border bg-white sticky top-[52px] h-[calc(100vh-52px)] self-start">
      <div className="flex flex-col flex-1 py-4">
        {visible.length > 0 && (
          <div className="mb-2">
            <p className="px-4 mb-1.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
              Principal
            </p>
            <div className="flex flex-col">
              {visible.map((e) => (
                <SidebarNavItem key={e.to} entry={e} />
              ))}
            </div>
          </div>
        )}
        {showSettings && (
          <div className="mt-auto">
            <div className="h-px bg-border mx-4 mb-2" />
            <SidebarNavItem
              entry={{
                label: "Configurações",
                to: settingsTo,
                icon: Settings,
                prefixes: ["/admin/empresas", "/admin/usuarios"],
              }}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
