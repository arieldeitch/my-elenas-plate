import { useEffect, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { buildLabel, getBuildInfo, logBuildInfo } from "@/lib/build-info";

/**
 * Fail-safe for the shared couple app (DEC-024). A build whose target is
 * `shared` but has no Supabase configuration must not run at all: instead of
 * the tracker it renders a full-screen, unmistakable "not connected" page and
 * does NOT mount the auth gate or the store, so nothing can be logged into an
 * isolated localStorage-only reality and later mistaken for the shared truth.
 *
 * Rendered on the server as well, so the served HTML of a misconfigured
 * publish already carries `data-runtime-mode="misconfigured"` — the release
 * preflight (`scripts/release-preflight.ts`) checks for exactly that.
 *
 * Deliberate demo builds (`VITE_RUNTIME_TARGET=demo`, and every development
 * bundle by default) pass straight through and are labelled by
 * RuntimeModeNotice on the home screen.
 */
export function RuntimeGate({ children }: { children: ReactNode }) {
  const info = getBuildInfo();
  useEffect(() => logBuildInfo(info), [info]);

  if (!info.misconfigured) return <>{children}</>;

  return (
    <main
      role="alert"
      data-runtime-mode="misconfigured"
      data-build-sha={info.sha}
      className="flex min-h-screen items-center justify-center bg-background px-5"
    >
      <div className="max-w-md rounded-2xl border border-destructive/40 bg-destructive-soft px-5 py-6 text-right">
        <div className="flex items-center gap-2 text-lg font-semibold text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <h1>הבנייה הזו אינה מחוברת לענן המשותף</h1>
        </div>
        <p className="mt-3 text-sm text-foreground">
          האפליקציה נבנתה בלי הגדרות Supabase, ולכן אי אפשר לתעד בה: כל רישום היה נשמר רק בדפדפן הזה
          ולא היה מגיע לאלנה או לאריאל. כדי שלא ייווצרו נתונים מבודדים, התיעוד חסום עד שהבנייה
          תתוקן.
        </p>
        <p className="mt-3 text-xs text-muted-foreground" dir="ltr">
          Owner fix: set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{" "}
          (public values) in the Lovable project settings and publish again — see{" "}
          <code>docs/RUNTIME_CONFIG.md</code>. A deliberate demo build must declare{" "}
          <code>VITE_RUNTIME_TARGET=demo</code>.
        </p>
        <p className="mt-3 text-xs text-muted-foreground" dir="ltr">
          {buildLabel(info)} · target {info.target}
        </p>
      </div>
    </main>
  );
}
