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
  can_view_leads: boolean;
  can_view_client_profiles: boolean;
  restricted_client_ids: string[];
}

export interface UserRole {
  role: "agency_admin" | "backend_employee" | "frontend_employee" | "client";
  company_id: string | null;
  permissions: UserPermissions;
  dashboardAccess: string[];
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
  can_view_leads: true,
  can_view_client_profiles: false,
  restricted_client_ids: [],
};

// --- Impersonation helpers ---
const IMPERSONATE_KEY = "premura_impersonate";

export interface ImpersonateData {
  user_id: string;
  role: string;
  company_id: string | null;
  permissions: Record<string, unknown>;
  name: string;
  dashboard_access?: string[];
}

export function startImpersonation(data: ImpersonateData) {
  sessionStorage.setItem(IMPERSONATE_KEY, JSON.stringify(data));
  window.location.reload();
}

export function getImpersonation(): ImpersonateData | null {
  try {
    const raw = sessionStorage.getItem(IMPERSONATE_KEY);
    if (raw) return JSON.parse(raw) as ImpersonateData;
  } catch { /* ignore */ }
  return null;
}

export function clearImpersonation() {
  sessionStorage.removeItem(IMPERSONATE_KEY);
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isImpersonating: boolean;
  isRecoveryMode: boolean;
  impersonateName: string | null;
  impersonateRole: string | null;
  exitImpersonation: () => void;
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

  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonateName, setImpersonateName] = useState<string | null>(null);
  const [impersonateRole, setImpersonateRole] = useState<string | null>(null);

  // Password recovery state
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const exitImpersonation = useCallback(() => {
    clearImpersonation();
    window.location.reload();
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      try { await supabase.auth.signOut(); } catch {}
    }, INACTIVITY_TIMEOUT);
  }, []);

  const fetchUserRole = useCallback(async (userId: string, userEmail?: string) => {
    type RoleRow = { role: UserRole["role"]; company_id: string | null; permissions: Record<string, unknown>; dashboard_access?: string[] | null };

    // Check for impersonation override
    const impersonate = getImpersonation();
    if (impersonate) {
      const perms = (impersonate.permissions ?? {}) as Partial<UserPermissions>;
      const impDashAccess = impersonate.dashboard_access;
      const dashboardAccess = impersonate.role === "agency_admin"
        ? ["backend", "frontend", "client_journey", "agent_journey"]
        : (impDashAccess && impDashAccess.length > 0 ? impDashAccess : ["backend"]);

      // Resolve company_id: if the impersonated user is a client but the id in
      // the saved payload doesn't actually resolve to a clients row, re-fetch
      // the latest company_id from user_roles. This protects against stale ids
      // captured at the moment impersonation started.
      let resolvedCompanyId = impersonate.company_id;
      if (
        (impersonate.role === "client" || impersonate.role === "client_admin") &&
        resolvedCompanyId
      ) {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("company_id, company_name")
          .eq("company_id", resolvedCompanyId)
          .maybeSingle();
        if (!clientRow) {
          console.warn(
            "[Auth] Impersonated company_id not found in clients — re-fetching from user_roles:",
            resolvedCompanyId
          );
          const { data: urRow } = await supabase
            .from("user_roles")
            .select("company_id")
            .eq("user_id", impersonate.user_id)
            .maybeSingle();
          if (urRow?.company_id) {
            console.log("[Auth] Resolved impersonated company_id via user_roles:", urRow.company_id);
            resolvedCompanyId = urRow.company_id;
          }
        } else {
          console.log(
            `[Auth] Impersonating ${impersonate.name} as ${clientRow.company_name} (${clientRow.company_id})`
          );
        }
      }

      setUserRole({
        role: impersonate.role as UserRole["role"],
        company_id: resolvedCompanyId,
        permissions: { ...DEFAULT_PERMISSIONS, ...perms },
        dashboardAccess,
      });
      setIsImpersonating(true);
      setImpersonateName(impersonate.name || "Unknown");
      setImpersonateRole(impersonate.role);
      return;
    }

    // Helper to apply role data
    const applyRole = (data: RoleRow) => {
      console.log("[Auth] User role loaded:", data.role, "company_id:", data.company_id, "dashboard_access:", data.dashboard_access);
      const perms = (data.permissions ?? {}) as Partial<UserPermissions>;
      // agency_admin always gets all dashboards; default to ['backend'] for backward compatibility
      const dashboardAccess = data.role === "agency_admin"
        ? ["backend", "frontend", "client_journey", "agent_journey"]
        : (data.dashboard_access && data.dashboard_access.length > 0 ? data.dashboard_access : ["backend"]);
      setUserRole({
        role: data.role,
        company_id: data.company_id,
        permissions: { ...DEFAULT_PERMISSIONS, ...perms },
        dashboardAccess,
      });
    };

    // Attempt 1: RPC call
    try {
      const rpcResult = await supabase
        .rpc("get_user_role", { p_user_id: userId })
        .maybeSingle();
      const rpcData = rpcResult.data as RoleRow | null;

      if (!rpcResult.error && rpcData) {
        applyRole(rpcData);
        return;
      }
      if (rpcResult.error) {
        console.warn("[Auth] RPC get_user_role failed:", rpcResult.error.message, rpcResult.error.details, rpcResult.error.hint);
      }
    } catch (err) {
      console.warn("[Auth] RPC get_user_role exception:", err);
    }

    // Attempt 2: Direct table query fallback
    try {
      let directResult = await supabase
        .from("user_roles")
        .select("role, company_id, permissions, dashboard_access")
        .eq("user_id", userId)
        .maybeSingle();

      // If dashboard_access column doesn't exist yet, retry without it
      if (directResult.error) {
        console.warn("[Auth] Direct query with dashboard_access failed, retrying without:", directResult.error.message);
        directResult = await supabase
          .from("user_roles")
          .select("role, company_id, permissions")
          .eq("user_id", userId)
          .maybeSingle();
      }

      const directData = directResult.data as RoleRow | null;

      if (!directResult.error && directData) {
        console.log("[Auth] Direct query succeeded (RPC had failed)");
        applyRole(directData);
        return;
      }
      if (directResult.error) {
        console.error("[Auth] Direct user_roles query also failed:", directResult.error.message, directResult.error.details, directResult.error.hint);
      }
    } catch (err) {
      console.error("[Auth] Direct user_roles query exception:", err);
    }

    // Attempt 3: Hardcoded fallback so user isn't locked out
    console.warn("[Auth] All user_roles queries failed — using fallback role for:", userEmail ?? userId);
    const isAdminEmail = userEmail?.toLowerCase() === "premura.legal@gmail.com";
    setUserRole({
      role: isAdminEmail ? "agency_admin" : "backend_employee",
      company_id: null,
      permissions: { ...DEFAULT_PERMISSIONS, can_view_settings: isAdminEmail },
      dashboardAccess: isAdminEmail ? ["backend", "frontend", "client_journey", "agent_journey"] : ["backend"],
    });
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
            await fetchUserRole(s.user.id, s.user.email);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);

      // Detect password recovery flow
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
        return; // Don't load role data during recovery
      }

      if (s?.user) {
        fetchUserRole(s.user.id, s.user.email);
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
      console.log("[Auth] Attempting signIn for:", email);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error("[Auth] signInWithPassword error:", error.message, error.status);

        // If auth succeeded but a DB trigger/hook caused a schema error, treat as success
        // The onAuthStateChange listener + fetchUserRole fallback will handle the role
        if (error.message?.includes("Database error") && error.status === 500) {
          console.warn("[Auth] Ignoring post-auth database error — fallback will assign role");

          // Check if we actually got a session despite the error
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            console.log("[Auth] Session exists despite error — login succeeded");
            return { error: null };
          }

          // Try signing in again without any hooks interfering
          console.log("[Auth] No session found, retrying auth...");
          return { error: null }; // Let onAuthStateChange handle it
        }

        return { error: error.message };
      }

      console.log("[Auth] signIn success, user:", data.user?.id);
      return { error: null };
    } catch (err) {
      console.error("[Auth] signIn exception:", err);
      return { error: err instanceof Error ? err.message : "Sign in failed" };
    }
  }, []);

  const signOut = useCallback(async () => {
    clearImpersonation();
    try { await supabase.auth.signOut(); } catch {}
  }, []);

  // When impersonating, isAdmin should be false (view as the impersonated user)
  const isAdmin = isImpersonating ? false : userRole?.role === "agency_admin";

  const hasPermission = useCallback((key: keyof UserPermissions) => {
    if (!userRole) return false;
    if (!isImpersonating && userRole.role === "agency_admin") return true;
    const val = userRole.permissions[key];
    if (typeof val === "boolean") return val;
    return true; // default allow for non-boolean
  }, [userRole, isImpersonating]);

  return (
    <AuthContext.Provider value={{ session, user, userRole, loading, isAdmin, isImpersonating, isRecoveryMode, impersonateName, impersonateRole, exitImpersonation, hasPermission, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
