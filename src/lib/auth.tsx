import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface UserRole {
  role: "agency_admin" | "backend_employee" | "frontend_employee" | "client";
  company_id: string | null;
  permissions: Record<string, boolean>;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ error: string | null }>;
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
      await supabase.auth.signOut();
    }, INACTIVITY_TIMEOUT);
  }, []);

  const fetchUserRole = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, company_id, permissions")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      console.warn("[Auth] No role found for user:", userId);
      setUserRole(null);
      return;
    }
    setUserRole({
      role: data.role,
      company_id: data.company_id,
      permissions: (data.permissions as Record<string, boolean>) ?? {},
    });
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchUserRole(s.user.id);
        resetInactivityTimer();
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
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

    return () => subscription.unsubscribe();
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

  const signIn = useCallback(async (email: string, password: string, remember = false) => {
    // Supabase JS v2 persists sessions in localStorage by default.
    // For "don't remember me" we clear on tab close via sessionStorage workaround.
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    if (!remember) {
      // Mark so we can clear on beforeunload
      sessionStorage.setItem("premura_ephemeral_session", "1");
    } else {
      sessionStorage.removeItem("premura_ephemeral_session");
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem("premura_ephemeral_session");
  }, []);

  // Clear session on tab close if "remember me" was not checked
  useEffect(() => {
    const handler = () => {
      if (sessionStorage.getItem("premura_ephemeral_session")) {
        supabase.auth.signOut();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, userRole, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
