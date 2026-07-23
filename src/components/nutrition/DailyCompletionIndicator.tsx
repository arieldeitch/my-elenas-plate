import type { CompletionInfo } from "@/lib/completion";
import { cn } from "@/lib/utils";

export function DailyCompletionIndicator({ info }: { info: CompletionInfo }) {
  const pct = (info.documented / info.total) * 100;
  const barColor =
    info.state === "full" ? "bg-primary" : info.state === "partial" ? "bg-info" : "bg-[#CBD5E0]";

  const message =
    info.state === "full"
      ? "כל הכבוד! סיימת לתעד את היום."
      : info.state === "partial"
        ? "המשך כך! כמעט סיימת את היום."
        : "אפשר להתחיל לתעד את הארוחות של היום.";

  return (
    <div className="rounded-2xl bg-white border border-[#E9EEF3] p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 text-right">
          <div className="text-[15px] font-bold text-foreground">מצב התיעוד</div>
          <div className="mt-1 text-[13px] leading-snug text-[#708197]">{message}</div>
        </div>
        <div className="shrink-0 text-left">
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-[34px] font-extrabold text-info tabular-nums leading-none">
              {info.documented}
            </span>
            <span className="text-[20px] font-semibold text-[#94A3B4] tabular-nums leading-none">
              /{info.total}
            </span>
          </div>
          <div className="mt-1 text-xs text-[#708197]">ארוחות תועדו</div>
        </div>
      </div>
      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#EEF2F6]"
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
