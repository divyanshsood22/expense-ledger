import { useEffect, useState } from "react";
import AccessCode from "@/pages/AccessCode";
import Dashboard from "@/pages/Dashboard";
import History from "@/pages/History";
import Analytics from "@/pages/Analytics";
import Nav, { type View } from "@/components/Nav";
import { checkSession } from "@/lib/api";

type AuthState = "checking" | "authenticated" | "unauthenticated";

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
        <p className="font-serif text-lg text-muted-foreground">Ledger</p>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <AccessCode onSuccess={() => setAuthState("authenticated")} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav current={view} onNavigate={setView} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {view === "dashboard" && <Dashboard />}
        {view === "history" && <History />}
        {view === "analytics" && <Analytics />}
      </main>
    </div>
  );
}