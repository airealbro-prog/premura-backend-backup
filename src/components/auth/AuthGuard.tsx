import { useAuth } from "@/lib/auth";
import { LoginPage } from "@/components/auth/LoginPage";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  // Brief loading spinner — auth context guarantees this resolves via try/catch/finally
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // No session → show login page directly (no redirect/router needed)
  if (!session) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
