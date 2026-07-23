import { ArrowDown, ArrowUp, Minus, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatShortDate, fromISODate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  onOpen: () => void;
}

export function WeightBanner({ onOpen }: Props) {
  const { weighIns } = useStore();
  const latest = weighIns[weighIns.length - 1];
  const prev = weighIns.length >= 2 ? weighIns[weighIns.length - 2] : undefined;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background to-transparent pt-4"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-[820px] px-6 pb-4">
        <button
          onClick={onOpen}
          className="w-full rounded-3xl border border-[#E9EEF3] bg-white px-5 py-4 text-right shadow-soft hover:shadow-float transition-shadow duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="פתיחת טופס שקילה"
        >
          {!latest ? (
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                <Scale className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">הוספת שקילה ראשונה</div>
                <div className="text-xs text-muted-foreground">עוד לא תועדה שקילה</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                <Scale className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-foreground">
                    {formatNumber(latest.weightKg)} ק״ג
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    נשקל ב־{formatShortDate(fromISODate(latest.dateISO))}
                  </span>
                </div>
                <DeltaLine
                  prev={prev?.weightKg}
                  curr={latest.weightKg}
                  bodyFatPct={latest.bodyFatPct}
                />
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

function DeltaLine({ prev, curr, bodyFatPct }: { prev?: number; curr: number; bodyFatPct?: number }) {
  const bits: React.ReactNode[] = [];
  if (prev == null) {
    bits.push(
      <span key="none" className="text-xs text-muted-foreground">
        אין עדיין שקילה קודמת להשוואה
      </span>
    );
  } else {
    const diff = Math.round((curr - prev) * 10) / 10;
    const Icon = diff < 0 ? ArrowDown : diff > 0 ? ArrowUp : Minus;
    const cls =
      diff < 0 ? "text-success bg-success-soft"
      : diff > 0 ? "text-destructive bg-destructive-soft"
      : "text-muted-foreground bg-muted";
    const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
    bits.push(
      <span key="d" className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
        <Icon className="h-3 w-3" aria-hidden />
        {sign}{formatNumber(Math.abs(diff))} ק״ג מהשקילה הקודמת
      </span>
    );
  }
  if (bodyFatPct != null) {
    const fatMass = Math.round((curr * bodyFatPct / 100) * 10) / 10;
    bits.push(
      <span key="fm" className="text-xs text-muted-foreground">
        מסת שומן: {formatNumber(fatMass)} ק״ג
      </span>
    );
  }
  return <div className="mt-1 flex flex-wrap items-center gap-2">{bits}</div>;
}
