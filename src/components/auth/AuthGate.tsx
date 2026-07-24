import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSession, onAuthChange } from "@/lib/supabase/auth";
import { SignIn } from "./SignIn";
import { BrandIllustration } from "@/components/brand/BrandIllustration";

/**
 * Gates the app behind the shared-account session — but only when Supabase is
 * configured. In demo mode (no env) it renders children unchanged so the local
 * app keeps working. SSR renders children to avoid a flash; the gate resolves
 * on the client after checking the session.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    getSession().then((s) => {
      if (!active) return;
      setSession(s);
      setReady(true);
    });
    const unsub = onAuthChange((s) => {
      setSession(s);
      setReady(true);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [configured]);

  if (!configured) return <>{children}</>;

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <BrandIllustration variant="loading" />
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="טוען" />
      </div>
    );
  }

  if (!session) return <SignIn />;
  return <>{children}</>;
}
