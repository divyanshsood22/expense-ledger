import { useEffect, useState } from "react";
import AccessCode from "@/pages/AccessCode";
import Dashboard from "@/pages/Dashboard";
import History from "@/pages/History";
import Analytics from "@/pages/Analytics";
import { checkSession } from "@/lib/api";

type AuthState = "checking" | "authenticated" | "unauthenticated";
type View = "dashboard" | "history" | "analytics";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [view, setView] = useState<View>("dashboard");

  useEffect(() => {
    let cancelled = false;

    checkSession()
      .then(() => {
        if (!cancelled) setAuthState("authenticated");
      })
      .catch(() => {
        if (!cancelled) setAuthState("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <AccessCode onSuccess={() => setAuthState("authenticated")} />;
  }

  if (view === "history") {
    return <History onBack={() => setView("dashboard")} />;
  }

  if (view === "analytics") {
    return <Analytics onBack={() => setView("dashboard")} />;
  }

  return (
    <Dashboard
      onViewHistory={() => setView("history")}
      onViewAnalytics={() => setView("analytics")}
    />
  );
}