import { Check, Loader2, CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const LABEL = {
  saved: "נשמר",
  saving: "שומר...",
  offline: "לא מקוון",
  pending: "ממתין לסנכרון",
  error: "הסנכרון נכשל",
} as const;

const STYLE: Record<string, string> = {
  saved: "text-success bg-success-soft",
  saving: "text-info bg-info-soft",
  offline: "text-info bg-info-soft",
  pending: "text-info bg-info-soft",
  error: "text-destructive bg-destructive-soft",
};

export function SyncStatus() {
  const { syncState } = useStore();
  const Icon =
    syncState === "saved" ? Check
    : syncState === "saving" ? Loader2
    : syncState === "offline" ? CloudOff
    : syncState === "pending" ? RefreshCw
    : AlertTriangle;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        STYLE[syncState],
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", syncState === "saving" && "animate-spin")} />
      <span>{LABEL[syncState]}</span>
    </div>
  );
}
