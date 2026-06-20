import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "apoio";

// ----- Multi-tenancy (fundação) -----
export type OrgRole = "viewer" | "member" | "admin" | "owner";
export type OrgTipo = "consultoria" | "cliente" | "unidade";

export interface Org {
  id: string;
  nome: string;
  tipo: OrgTipo;
  parent_org_id: string | null;
  managed_by_org_id: string | null;
  is_root: boolean;
}
interface Membership {
  org_id: string;
  org_role: OrgRole;
}

const ORG_ROLE_RANK: Record<OrgRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

const VIEWER_KEY = "rac-viewer-mode";
const CURRENT_ORG_KEY = "gestao-current-org";

// Acesso não-tipado às tabelas novas de tenancy (ainda não estão em types.ts,
// que é mantido à mão). Isolado aqui para o resto do app continuar tipado.
// Degrada graciosamente: se as tabelas ainda não existirem (migração não
// aplicada), os loaders retornam vazio e o app segue com os papéis legados.
const sb = supabase as unknown as {
  from: (t: string) => any;
};

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isApoio: boolean;
  isStaff: boolean;
  isViewer: boolean;
  // --- multi-tenancy ---
  orgs: Org[];
  currentOrg: Org | null;
  currentOrgId: string | null;
  setCurrentOrg: (orgId: string) => void;
  isPlatformAdmin: boolean;
  entitlements: string[];
  orgRole: OrgRole | null;
  managerOrgRole: OrgRole | null;
  roleInOrg: (orgId: string) => OrgRole | null;
  hasEntitlement: (module: string) => boolean;
  hasOrgRole: (min: OrgRole) => boolean;
  // ---
  enterViewerMode: () => void;
  exitViewerMode: () => void;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isViewer, setIsViewer] = useState<boolean>(false);

  // multi-tenancy state
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<string[]>([]);

  const loadRoles = async (userId: string | undefined) => {
    if (!userId) {
      setRoles([]);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  };

  // Carrega orgs/memberships/platform-admin. Tolerante a falha (migração ausente).
  const loadOrgContext = async (userId: string | undefined) => {
    if (!userId) {
      setOrgs([]);
      setMemberships([]);
      setIsPlatformAdmin(false);
      setCurrentOrgId(null);
      return;
    }
    try {
      // RLS em organizations já retorna exatamente as orgs acessíveis
      // (membro direto + filhas via parent + clientes via managed_by).
      const [orgRes, memRes, paRes] = await Promise.all([
        sb.from("organizations").select("id, nome, tipo, parent_org_id, managed_by_org_id, is_root"),
        sb.from("org_memberships").select("org_id, org_role").eq("user_id", userId),
        sb.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      ]);

      const loadedOrgs: Org[] = (orgRes?.data ?? []) as Org[];
      const loadedMems: Membership[] = (memRes?.data ?? []) as Membership[];
      setOrgs(loadedOrgs);
      setMemberships(loadedMems);
      setIsPlatformAdmin(Boolean(paRes?.data));

      // Define a org ativa: localStorage se ainda válida, senão a 1ª.
      const stored = typeof window !== "undefined" ? localStorage.getItem(CURRENT_ORG_KEY) : null;
      const valid = stored && loadedOrgs.some((o) => o.id === stored) ? stored : null;
      const fallback = loadedOrgs[0]?.id ?? null;
      setCurrentOrgId(valid ?? fallback);
    } catch {
      // Migração ainda não aplicada — segue com papéis legados.
      setOrgs([]);
      setMemberships([]);
      setIsPlatformAdmin(false);
      setCurrentOrgId(null);
    }
  };

  // Recarrega entitlements quando a org ativa muda.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentOrgId) {
        setEntitlements([]);
        return;
      }
      try {
        const { data } = await sb
          .from("org_entitlements")
          .select("module")
          .eq("org_id", currentOrgId);
        if (!cancelled) setEntitlements((data ?? []).map((e: { module: string }) => e.module));
      } catch {
        if (!cancelled) setEntitlements([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsViewer(sessionStorage.getItem(VIEWER_KEY) === "1");
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      // Defer to avoid deadlock
      setTimeout(() => {
        void loadRoles(sess?.user?.id);
        void loadOrgContext(sess?.user?.id);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      void Promise.all([loadRoles(sess?.user?.id), loadOrgContext(sess?.user?.id)]).finally(() =>
        setLoading(false),
      );
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("admin");
  const isApoio = roles.includes("apoio");
  const isStaff = isAdmin || isApoio;

  const currentOrg = orgs.find((o) => o.id === currentOrgId) ?? null;

  const setCurrentOrg = (orgId: string) => {
    if (typeof window !== "undefined") localStorage.setItem(CURRENT_ORG_KEY, orgId);
    setCurrentOrgId(orgId);
  };

  const roleInOrg = (orgId: string | null | undefined): OrgRole | null =>
    orgId ? (memberships.find((m) => m.org_id === orgId)?.org_role ?? null) : null;

  const orgRole = roleInOrg(currentOrgId);
  // Maior papel na cadeia que GERENCIA a org ativa (consultor via managed_by /
  // org-mãe via parent). Distingue "consultor" do "admin do próprio cliente".
  const managerOrgRole: OrgRole | null = (() => {
    const candidates: (OrgRole | null)[] = [
      roleInOrg(currentOrg?.managed_by_org_id),
      roleInOrg(currentOrg?.parent_org_id),
    ];
    return candidates.reduce<OrgRole | null>((best, r) => {
      if (!r) return best;
      if (!best) return r;
      return ORG_ROLE_RANK[r] > ORG_ROLE_RANK[best] ? r : best;
    }, null);
  })();

  const hasEntitlement = (module: string) => isPlatformAdmin || entitlements.includes(module);

  // Gate de UI (a verdade é o RLS no banco). Considera papel direto e, ao agir
  // numa org filha/cliente, o papel na org-mãe/consultoria gerenciadora.
  const hasOrgRole = (min: OrgRole): boolean => {
    if (isPlatformAdmin) return true;
    const need = ORG_ROLE_RANK[min];
    const direct = orgRole;
    if (direct && ORG_ROLE_RANK[direct] >= need) return true;
    if (currentOrg?.managed_by_org_id) {
      const r = roleInOrg(currentOrg.managed_by_org_id);
      if (r && ORG_ROLE_RANK[r] >= need) return true;
    }
    if (currentOrg?.parent_org_id) {
      const r = roleInOrg(currentOrg.parent_org_id);
      if (r && ORG_ROLE_RANK[r] >= need) return true;
    }
    return false;
  };

  const enterViewerMode = () => {
    if (typeof window !== "undefined") sessionStorage.setItem(VIEWER_KEY, "1");
    setIsViewer(true);
  };
  const exitViewerMode = () => {
    if (typeof window !== "undefined") sessionStorage.removeItem(VIEWER_KEY);
    setIsViewer(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        loading,
        isAdmin,
        isApoio,
        isStaff,
        isViewer,
        orgs,
        currentOrg,
        currentOrgId,
        setCurrentOrg,
        isPlatformAdmin,
        entitlements,
        orgRole,
        managerOrgRole,
        roleInOrg,
        hasEntitlement,
        hasOrgRole,
        enterViewerMode,
        exitViewerMode,
        signOut: async () => {
          await supabase.auth.signOut();
          exitViewerMode();
          if (typeof window !== "undefined") localStorage.removeItem(CURRENT_ORG_KEY);
        },
        refreshRoles: async () => {
          await Promise.all([loadRoles(user?.id), loadOrgContext(user?.id)]);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
