import { Check, Loader2, CloudOff, RefreshCw, AlertTriangle, CloudCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// M2 trust signal: plain words, no backend terms. "מסונכרן" is only ever shown
// when the durable queue is empty AND Supabase confirmed every operation; in a
// deliberate demo build the same slot says the truth ("נשמר במכשיר").
const cloud = () => isSupabaseConfigured();
const LABEL = {
  saved: () => (cloud() ? "מסונכרן" : "נשמר במכשיר"),
  saving: () => "מסנכרן…",
  offline: () => "לא מקוון — יסתנכרן אחר כך",
  pending: () => "ממתין לסנכרון",
  error: () => "הסנכרון נכשל",
} as const;

// Quiet when all is well (no pill, muted text); a pill only when attention is due.
const STYLE: Record<string, string> = {
  saved: "text-muted-foreground",
  saving: "text-info bg-info-soft px-2.5",
  offline: "text-info bg-info-soft px-2.5",
  pending: "text-info bg-info-soft px-2.5",
  error: "text-destructive bg-destructive-soft px-2.5",
};

/**
 * Sync indicator. In cloud mode the state is derived from the durable queue,
 * so "נשמר" appears only once every operation is confirmed by Supabase. Unsent
 * ops show a count; permanently failed ops stay visible with a retry action.
 */
export function SyncStatus() {
  const { syncState, syncDetail, retryFailedSync, discardFailedSync } = useStore();
  const Icon =
    syncState === "saved"
      ? cloud()
        ? CloudCheck
        : Check
      : syncState === "saving"
        ? Loader2
        : syncState === "offline"
          ? CloudOff
          : syncState === "pending"
            ? RefreshCw
            : AlertTriangle;
  const count =
    syncState === "error" && syncDetail.failed > 0
      ? syncDetail.failed
      : syncState === "pending" || syncState === "offline"
        ? syncDetail.pending
        : 0;

  return (
    <div className="flex items-center gap-2">
      <div
        role="status"
        aria-live="polite"
        data-sync-state={syncState}
        data-sync-pending={syncDetail.pending}
        data-sync-failed={syncDetail.failed}
        data-realtime={syncDetail.realtime}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full py-1 text-xs font-medium",
          STYLE[syncState],
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", syncState === "saving" && "animate-spin")} />
        <span>{LABEL[syncState]()}</span>
        {count > 0 && (
          <span className="rounded-full bg-white/60 px-1.5 text-[10px] tabular-nums" dir="ltr">
            {count}
          </span>
        )}
      </div>
      {syncDetail.realtime === "error" && (
        <span className="rounded-full bg-destructive-soft px-2 py-1 text-[10px] font-medium text-destructive">
          ללא עדכון חי
        </span>
      )}
      {syncState === "error" && syncDetail.failed > 0 && (
        <>
          <button
            type="button"
            onClick={retryFailedSync}
            className="rounded-full border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary"
          >
            נסיון חוזר
          </button>
          <button
            type="button"
            onClick={discardFailedSync}
            className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            ביטול
          </button>
        </>
      )}
    </div>
  );
}
