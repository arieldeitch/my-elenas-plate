import type { CompletionInfo } from "@/lib/completion";
import { cn } from "@/lib/utils";

export function DailyCompletionIndicator({ info }: { info: CompletionInfo }) {
  const pct = (info.documented / info.total) * 100;
  const barColor =
    info.state === "full" ? "bg-primary"
    : info.state === "partial" ? "bg-warn"
    : "bg-muted-foreground/40";

  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{info.label}</div>
          <div className="text-lg font-bold text-foreground">
            {info.documented} מתוך {info.total} ארוחות תועדו
          </div>
        </div>
        <div
          aria-hidden
          className={cn(
            "shrink-0 grid h-11 w-11 place-items-center rounded-full text-sm font-bold",
            info.state === "full" && "bg-success-soft text-success",
            info.state === "partial" && "bg-warn-soft text-warn-foreground",
            info.state === "empty" && "bg-muted text-muted-foreground",
          )}
        >
          {info.documented}/{info.total}
        </div>
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={info.documented}
        aria-valuemin={0}
        aria-valuemax={info.total}
        aria-label="התקדמות תיעוד יומי"
      >
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {info.state !== "full" && (
        <div className="mt-2 text-xs text-muted-foreground">אפשר להשלים בהמשך</div>
      )}
    </div>
  );
}
