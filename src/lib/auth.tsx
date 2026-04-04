import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface UserPermissions {
  name?: string;
  can_view_overview: boolean;
  can_view_performance: boolean;
  can_view_leaderboard: boolean;
  can_view_historical: boolean;
  can_view_settings: boolean;
  can_view_contacts: boolean;
  can_view_recordings: boolean;
  can_view_credit_scores: boolean;
  can_view_commissions: boolean;
  can_view_all_clients: boolean;
  restricted_client_ids: string[];
}

export interface UserRole {
  role: "agency_admin" | "backend_employee" | "frontend_employee" | "client";
  company_id: string | null;
  permissions: UserPermissions;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  can_view_overview: true,
  can_view_performance: true,
  can_view_leaderboard: true,
  can_view_historical: true,
  can_view_settings: false,
  can_view_contacts: true,
  can_view_recordings: true,
  can_view_credit_scores: false,
  can_view_commissions: false,
  can_view_all_clients: true,
  restricted_client_ids: [],
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  hasPermission: (key: keyof UserPermissions) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      try { await supabase.auth.signOut(); } catch {}
    }, INACTIVITY_TIMEOUT);
  }, []);

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, company_id, permissions")
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        // No role found — default to restricted
        setUserRole(null);
        return;
      }
      const perms = (data.permissions ?? {}) as Partial<UserPermissions>;
      setUserRole({
        role: data.role,
        company_id: data.company_id,
        permissions: { ...DEFAULT_PERMISSIONS, ...perms },
      });
    } catch {
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(s);
          setUser(s?.user ?? null);
          if (s?.user) {
            await fetchUserRole(s.user.id);
            resetInactivityTimer();
          }
        }
      } catch (err) {
        console.error("[Auth] Failed to get session:", err);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchUserRole(s.user.id);
        resetInactivityTimer();
      } else {
        setUserRole(null);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserRole, resetInactivityTimer]);

  // Track user activity for inactivity timeout
  useEffect(() => {
    if (!session) return;
    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    const handler = () => resetInactivityTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [session, resetInactivityTimer]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Sign in failed" };
    }
  }, []);

  const signOut = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch {}
  }, []);

  const isAdmin = userRole?.role === "agency_admin";

  const hasPermission = useCallback((key: keyof UserPermissions) => {
    if (!userRole) return false;
    if (userRole.role === "agency_admin") return true;
    const val = userRole.permissions[key];
    if (typeof val === "boolean") return val;
    return true; // default allow for non-boolean
  }, [userRole]);

  return (
    <AuthContext.Provider value={{ session, user, userRole, loading, isAdmin, hasPermission, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
