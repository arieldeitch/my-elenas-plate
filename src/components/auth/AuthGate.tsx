import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureSession, onAuthChange } from "@/lib/supabase/auth";
import { BrandIllustration } from "@/components/brand/BrandIllustration";

type Status = "connecting" | "ready" | "failed";

/**
 * Minimum gap between AUTOMATIC connection attempts after a FAILED one
 * (auth-null events, "online" flapping). Anonymous sign-in creates a user on
 * the backend and is rate-limited per IP; one logical attempt must never fan
 * out into a burst of sign-up requests. A tap on the retry button is always
 * allowed (single-flight still applies). A successful attempt never throttles
 * the next one: the next trigger then genuinely needs a session.
 */
export const AUTO_RETRY_MIN_GAP_MS = 5_000;

/**
 * Connects the device silently before the app renders — only when Supabase is
 * configured. In demo mode (no env) it renders children unchanged.
 *
 * DEC-031: there is no login. An existing session is reused; otherwise an
 * anonymous session is created without any form. The only visible states are
 * the neutral loading screen and, if the connection genuinely fails, one short
 * message with a retry button. Once the app is shown it stays shown: a session
 * lost later (token revoked, storage cleared elsewhere) is replaced silently in
 * the background while the sync indicator reports the interruption — the app
 * is never unmounted under the user's hands. SSR renders the neutral loading
 * screen; the gate resolves on the client.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [status, setStatus] = useState<Status>(configured ? "connecting" : "ready");
  const statusRef = useRef(status);
  statusRef.current = status;
  const connecting = useRef(false);
  const alive = useRef(true);
  const lastFailure = useRef(0);

  /**
   * One logical connection attempt. `manual` = the retry button (never
   * throttled); automatic callers are throttled and single-flighted so a burst
   * of events produces at most one sign-in request.
   */
  const connect = useCallback(async (manual = false) => {
    if (connecting.current) return;
    if (!manual && Date.now() - lastFailure.current < AUTO_RETRY_MIN_GAP_MS) return;
    connecting.current = true;
    // Keep the app mounted while reconnecting in the background.
    if (statusRef.current !== "ready") setStatus("connecting");
    let ok = false;
    try {
      const session = await ensureSession();
      ok = Boolean(session);
      if (!alive.current) return;
      if (session) setStatus("ready");
      else if (statusRef.current !== "ready") setStatus("failed");
    } catch (err) {
      console.warn("[elenas-plate] silent connection failed", err);
      if (alive.current && statusRef.current !== "ready") setStatus("failed");
    } finally {
      if (!ok) lastFailure.current = Date.now();
      connecting.current = false;
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    alive.current = true;
    void connect();
    // Session gone (revoked / expired beyond refresh / cleared elsewhere):
    // reconnect silently instead of ever showing a form.
    const unsub = onAuthChange((session) => {
      if (session) {
        if (alive.current) setStatus("ready");
      } else {
        void connect();
      }
    });
    // Opened while offline with no stored session: retry as soon as we are back.
    const onOnline = () => void connect();
    window.addEventListener("online", onOnline);
    return () => {
      alive.current = false;
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
            onClick={() => void connect(true)}
            className="min-h-11 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            נסה שוב
          </button>
        </div>
      )}
    </div>
  );
}
