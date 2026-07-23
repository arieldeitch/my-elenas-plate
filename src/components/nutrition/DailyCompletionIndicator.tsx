import type { CompletionInfo } from "@/lib/completion";
import { cn } from "@/lib/utils";

export function DailyCompletionIndicator({ info }: { info: CompletionInfo }) {
  const pct = (info.documented / info.total) * 100;
  const barColor =
    info.state === "full" ? "bg-primary"
    : info.state === "partial" ? "bg-info"
    : "bg-[#CBD5E0]";

  return (
    <div className="rounded-3xl bg-white border border-[#E9EEF3] p-6 shadow-soft">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-[#708197]">מצב התיעוד</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-foreground leading-none tabular-nums">
              {info.documented}
            </span>
            <span className="text-lg font-medium text-[#708197] leading-none tabular-nums">
              / {info.total}
            </span>
          </div>
          <div className="mt-1 text-xs text-[#708197]">ארוחות תועדו היום</div>
        </div>
        {info.state === "full" && (
          <span className="inline-flex h-6 items-center rounded-full bg-[#EDF8F2] px-2.5 text-[11px] font-medium text-primary">
            הושלם
          </span>
        )}
      </div>
      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#EEF2F6]"
        role="progressbar"
        aria-valuenow={info.documented}
        aria-valuemin={0}
        aria-valuemax={info.total}
        aria-label="התקדמות תיעוד יומי"
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300 ease-out", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
