import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureSession, onAuthChange } from "@/lib/supabase/auth";
import { BrandIllustration } from "@/components/brand/BrandIllustration";

type Status = "connecting" | "ready" | "failed";

/**
 * Connects the device silently before the app renders — only when Supabase is
 * configured. In demo mode (no env) it renders children unchanged.
 *
 * DEC-031: there is no login. An existing session is reused; otherwise an
 * anonymous session is created without any form. The only visible states are
 * the neutral loading screen and, if the connection genuinely fails, one short
 * message with a retry button. A lost session (storage cleared, token
 * revoked) reconnects the same silent way. SSR renders the neutral loading
 * screen; the gate resolves on the client.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [status, setStatus] = useState<Status>(configured ? "connecting" : "ready");
  const connecting = useRef(false);

  const connect = useCallback(async () => {
    if (connecting.current) return;
    connecting.current = true;
    setStatus("connecting");
    try {
      const session = await ensureSession();
      setStatus(session ? "ready" : "failed");
    } catch (err) {
      console.warn("[elenas-plate] silent connection failed", err);
      setStatus("failed");
    } finally {
      connecting.current = false;
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    void connect();
    // Session gone (revoked / expired beyond refresh / cleared elsewhere):
    // reconnect silently instead of ever showing a form.
    const unsub = onAuthChange((session) => {
      if (session) setStatus("ready");
      else if (!connecting.current) void connect();
    });
    // Opened while offline with no stored session: retry as soon as we are back.
    const onOnline = () => void connect();
    window.addEventListener("online", onOnline);
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
    };
  }, [configured, connect]);

  if (status === "ready") return <>{children}</>;

  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6"
      data-connection={status}
    >
      <BrandIllustration variant="loading" />
      {status === "connecting" ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="טוען" />
      ) : (
        <div role="status" className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-foreground">לא הצלחנו להתחבר כרגע.</p>
          <button
            type="button"
            onClick={() => void connect()}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            נסה שוב
          </button>
        </div>
      )}
    </div>
  );
}
