import { useEffect } from "react";
import { AlertTriangle, Cloud, FlaskConical } from "lucide-react";
import { buildLabel, getBuildInfo, logBuildInfo } from "@/lib/build-info";

/**
 * Explicit cloud-vs-demo truth (M1 Phase A). Rendered on the home screen:
 *  - cloud: "data is saved to the shared cloud" + build id;
 *  - demo (dev): clearly labelled demo mode, browser-only persistence;
 *  - demo in a PRODUCTION bundle: loud warning — this build is not connected
 *    and must never be mistaken for a working cloud build.
 * The build id is always visible so a published artifact is traceable.
 */
export function RuntimeModeNotice() {
  const info = getBuildInfo();
  useEffect(() => logBuildInfo(info), [info]);

  if (info.misconfigured) {
    return (
      <div
        role="alert"
        data-runtime-mode="misconfigured"
        data-build-sha={info.sha}
        className="mt-8 rounded-2xl border border-destructive/40 bg-destructive-soft px-4 py-3 text-right text-sm text-destructive"
      >
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>הבנייה הזו אינה מחוברת לענן</span>
        </div>
        <p className="mt-1">
          חסרה הגדרת Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). הנתונים נשמרים בדפדפן
          הזה בלבד ולא יסונכרנו בין המכשירים.
        </p>
        <p className="mt-1 text-xs" dir="ltr">
          {buildLabel(info)}
        </p>
      </div>
    );
  }

  if (info.mode === "demo") {
    return (
      <div
        role="status"
        data-runtime-mode="demo"
        data-build-sha={info.sha}
        className="mt-8 rounded-2xl border border-border bg-secondary px-4 py-3 text-right text-xs text-muted-foreground"
      >
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
          <span>מצב הדגמה — ללא סנכרון ענן</span>
        </div>
        <p className="mt-1">הנתונים נשמרים באופן זמני בדפדפן הזה בלבד ואינם משותפים.</p>
        <p className="mt-1" dir="ltr">
          {buildLabel(info)}
        </p>
      </div>
    );
  }

  return (
    <p
      data-runtime-mode="cloud"
      data-build-sha={info.sha}
      className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground"
    >
      <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>הנתונים נשמרים בענן המשותף ומסונכרנים בין המכשירים.</span>
      <span dir="ltr">· {buildLabel(info)}</span>
    </p>
  );
}
