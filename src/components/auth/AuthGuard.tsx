import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LoginPage } from "@/components/auth/LoginPage";
import { ResetPasswordPage } from "@/components/auth/ResetPasswordPage";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading, isRecoveryMode } = useAuth();
  const [showRecovery, setShowRecovery] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);

  // Detect recovery mode from auth context
  useEffect(() => {
    if (isRecoveryMode) {
      setShowRecovery(true);
    }
  }, [isRecoveryMode]);

  // On mount, detect #access_token= in URL hash and establish the session
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token=")) return;

    // Parse the hash fragment
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (accessToken) {
      setTokenLoading(true);
      supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        })
        .then(({ error }) => {
          if (error) {
            console.error("[AuthGuard] Failed to set session from token:", error.message);
          }
          // If this is a recovery token, show the reset page
          if (type === "recovery") {
            setShowRecovery(true);
          }
          // Clean up the hash fragment from the URL
          window.history.replaceState(null, "", window.location.pathname);
          setTokenLoading(false);
        });
    }
  }, []);

  // Loading spinner
  if (loading || tokenLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Show reset password page when in recovery mode
  if (showRecovery && session) {
    return <ResetPasswordPage />;
  }

  // No session → show login page
  if (!session) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
