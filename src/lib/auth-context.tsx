import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "apoio";

const VIEWER_KEY = "rac-viewer-mode";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isApoio: boolean;
  isStaff: boolean;
  isViewer: boolean;
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

  const loadRoles = async (userId: string | undefined) => {
    if (!userId) {
      setRoles([]);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  };

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
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      void loadRoles(sess?.user?.id).finally(() => setLoading(false));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("admin");
  const isApoio = roles.includes("apoio");
  const isStaff = isAdmin || isApoio;

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
        enterViewerMode,
        exitViewerMode,
        signOut: async () => {
          await supabase.auth.signOut();
          exitViewerMode();
        },
        refreshRoles: () => loadRoles(user?.id),
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