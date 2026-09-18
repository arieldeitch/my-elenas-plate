import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronUp, Dumbbell, Hourglass, Minus, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatNumber, formatShortDate, fromISODate, toISODate } from "@/lib/format";
import { calcFastingHours } from "@/lib/fasting";
import { calcWeightDelta, latestAndPrevious } from "@/lib/weight";
import { cn } from "@/lib/utils";
import { WorkoutEditor } from "./WorkoutEditor";
import { FastingEditor } from "./FastingEditor";

interface Props {
  onOpenWeight: () => void;
}

type Panel = "workout" | "fasting" | null;

/**
 * M2-3 — the secondary daily context in ONE compact row under the meal tiles:
 * weight · workout · fasting. Each cell states its current value at a glance
 * (no colour-only meaning, no nagging copy) and is a real button: weight opens
 * the existing weigh-in form; workout and fasting unfold an inline editor
 * below the row — one at a time — so nothing large sits on the home screen
 * until it is wanted. Replaces the fixed WeightBanner and the two full-size
 * WorkoutCard / FastingCard sections.
 */
export function DailyContextRow({ onOpenWeight }: Props) {
  const store = useStore();
  const iso = toISODate(store.selectedDate);
  const day = store.getDay(store.activeProfile, iso);
  const [panel, setPanel] = useState<Panel>(null);

  // Editors describe one person's one day: fold them when either changes.
  useEffect(() => setPanel(null), [store.activeProfile, iso]);

  // --- weight -----------------------------------------------------------------
  const { latest, previous } = latestAndPrevious(store.weighIns);
  const todays = latest?.dateISO === iso ? latest : undefined;
  const delta = latest ? calcWeightDelta(latest.weightKg, previous?.weightKg) : null;
  const weightValue = latest ? `${formatNumber(latest.weightKg)} ק״ג` : "—";
  const weightWhen = !latest
    ? "הוספת שקילה"
    : todays
      ? "היום"
      : formatShortDate(fromISODate(latest.dateISO));
  const weightState = latest
    ? `${weightValue}, ${todays ? "נשקל היום" : `נשקל ב־${weightWhen}`}`
    : "לא תועדה שקילה";

  // --- workout ----------------------------------------------------------------
  const w = day.workout;
  const workoutValue =
    w?.performed === true ? (w.type ?? "בוצע") : w?.performed === false ? "לא בוצע" : "לא תועד";
  const workoutSub = w?.performed === true ? (w.feeling ?? "") : "";

  // --- fasting ----------------------------------------------------------------
  const f = day.fasting;
  const hours = f ? calcFastingHours(f.start, f.end) : null;
  const fastingValue = f ? `${hours} שעות` : "לא תועד";
  const fastingSub = f ? `${f.start}–${f.end}` : "";

  function toggle(p: Exclude<Panel, null>) {
    setPanel((cur) => (cur === p ? null : p));
  }

  return (
    <section
      aria-label="הקשר יומי: שקילה, אימון וצום"
      data-testid="daily-context"
      className="mt-3 rounded-2xl border border-[#E9EEF3] bg-white shadow-soft"
    >
      <div className="grid grid-cols-3 [&>*+*]:border-s [&>*+*]:border-[#EEF2F6]">
        <Cell
          icon={<Scale className="h-4 w-4" />}
          label="שקילה"
          value={weightValue}
          sub={
            <span className="inline-flex items-center gap-1">
              <span className={cn(!latest && "text-primary")}>{weightWhen}</span>
              {delta != null && <DeltaBadge delta={delta} />}
            </span>
          }
          ariaLabel={`שקילה: ${weightState}. פתיחת טופס שקילה`}
          onClick={onOpenWeight}
          testId="context-weight"
        />
        <Cell
          icon={<Dumbbell className="h-4 w-4" />}
          label="אימון"
          value={workoutValue}
          sub={workoutSub}
          ariaLabel={`אימון: ${workoutValue}${workoutSub ? `, ${workoutSub}` : ""}. עריכת אימון`}
          expanded={panel === "workout"}
          onClick={() => toggle("workout")}
          testId="context-workout"
        />
        <Cell
          icon={<Hourglass className="h-4 w-4" />}
          label="צום"
          value={fastingValue}
          sub={fastingSub}
          ariaLabel={
            f ? `צום: ${fastingValue}, ${fastingSub}. עריכת צום` : "צום: לא תועד. הוספת שעות"
          }
          expanded={panel === "fasting"}
          onClick={() => toggle("fasting")}
          testId="context-fasting"
        />
      </div>

      {panel && (
        <div className="border-t border-[#EEF2F6] px-4 py-3" data-testid="daily-context-panel">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {panel === "workout" ? "אימון" : "צום"}
            </span>
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="סגירה"
              className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-[#F1F5F9]"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
          {panel === "workout" ? (
            <WorkoutEditor />
          ) : (
            <FastingEditor onDone={() => setPanel(null)} />
          )}
        </div>
      )}
    </section>
  );
}

function Cell({
  icon,
  label,
  value,
  sub,
  ariaLabel,
  expanded,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
  ariaLabel: string;
  expanded?: boolean;
  onClick: () => void;
  testId: string;
}) {
  const documented = value !== "—" && value !== "לא תועד";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      data-testid={testId}
      data-value={value}
      className={cn(
        "flex min-h-[64px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-center transition-colors hover:bg-[#F8FAFC] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring first:rounded-r-2xl last:rounded-l-2xl",
        expanded && "bg-[#F8FAFC]",
      )}
    >
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span aria-hidden>{icon}</span>
        {label}
      </span>
      <span
        className={cn(
          "text-[14px] leading-tight tabular-nums",
          documented ? "font-bold text-foreground" : "font-medium text-muted-foreground",
        )}
        dir="auto"
      >
        {value}
      </span>
      <span
        className="min-h-[14px] text-[11px] leading-tight text-muted-foreground tabular-nums"
        dir="auto"
      >
        {sub}
      </span>
    </button>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const diff = Math.round(delta * 10) / 10;
  const Icon = diff < 0 ? ArrowDown : diff > 0 ? ArrowUp : Minus;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr">
      <Icon className="h-3 w-3" aria-hidden />
      {sign}
      {formatNumber(Math.abs(diff))}
    </span>
  );
}
