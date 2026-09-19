import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronUp,
  Dumbbell,
  Footprints,
  Hourglass,
  Minus,
  Scale,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { formatNumber, formatShortDate, fromISODate, toISODate } from "@/lib/format";
import { calcFastingHours } from "@/lib/fasting";
import { calcWeightDelta, latestAndPrevious } from "@/lib/weight";
import { cn } from "@/lib/utils";
import { WorkoutEditor } from "./WorkoutEditor";
import { FastingEditor } from "./FastingEditor";
import { StepsEditor } from "./StepsEditor";

interface Props {
  onOpenWeight: () => void;
}

type Panel = "workout" | "fasting" | "steps" | null;

/**
 * Four balanced daily-context tiles: weight · workout · fasting · steps.
 * Narrow phones use a 2×2 grid so labels and values stay centred and readable.
 * Editors unfold below the grid, one at a time.
 */
export function DailyContextRow({ onOpenWeight }: Props) {
  const store = useStore();
  const iso = toISODate(store.selectedDate);
  const day = store.getDay(store.activeProfile, iso);
  const [panel, setPanel] = useState<Panel>(null);

  useEffect(() => setPanel(null), [store.activeProfile, iso]);

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

  const w = day.workout;
  const workoutValue =
    w?.performed === true ? (w.type ?? "בוצע") : w?.performed === false ? "לא בוצע" : "לא תועד";
  const workoutSub = w?.performed === true ? (w.feeling ?? "") : "";

  const fasting = day.fasting;
  const hours = fasting ? calcFastingHours(fasting.start, fasting.end) : null;
  const fastingValue = fasting ? `${hours} שעות` : "לא תועד";
  const fastingSub = fasting ? `${fasting.start}–${fasting.end}` : "";

  const steps = day.steps ?? { goalSteps: 10_000, completed: false };
  const stepsValue =
    steps.steps != null
      ? steps.steps.toLocaleString("he-IL")
      : steps.completed
        ? "בוצע"
        : "לא דווח";
  const stepsSub = `יעד ${steps.goalSteps.toLocaleString("he-IL")}`;

  function toggle(p: Exclude<Panel, null>) {
    setPanel((cur) => (cur === p ? null : p));
  }

  return (
    <section
      aria-label="הקשר יומי: שקילה, אימון, צום וצעדים"
      data-testid="daily-context"
      className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
    >
      <div
        className={cn(
          "grid grid-cols-2 sm:grid-cols-4",
          "[&>*]:border-border",
          "[&>*:nth-child(odd)]:border-e sm:[&>*:nth-child(odd)]:border-e-0",
          "[&>*:nth-child(-n+2)]:border-b sm:[&>*:nth-child(-n+2)]:border-b-0",
          "sm:[&>*+*]:border-s",
        )}
      >
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
            fasting
              ? `צום: ${fastingValue}, ${fastingSub}. עריכת צום`
              : "צום: לא תועד. הוספת שעות"
          }
          expanded={panel === "fasting"}
          onClick={() => toggle("fasting")}
          testId="context-fasting"
        />
        <Cell
          icon={<Footprints className="h-4 w-4" />}
          label="צעדים"
          value={stepsValue}
          sub={stepsSub}
          ariaLabel={`צעדים: ${stepsValue}, ${stepsSub}. עריכת צעדים`}
          expanded={panel === "steps"}
          onClick={() => toggle("steps")}
          testId="context-steps"
        />
      </div>

      {panel && (
        <div className="border-t border-border bg-card px-4 py-3" data-testid="daily-context-panel">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {panel === "workout" ? "אימון" : panel === "fasting" ? "צום" : "צעדים"}
            </span>
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="סגירה"
              className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
          {panel === "workout" ? (
            <WorkoutEditor />
          ) : panel === "fasting" ? (
            <FastingEditor onDone={() => setPanel(null)} />
          ) : (
            <StepsEditor onDone={() => setPanel(null)} />
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
  const documented = value !== "—" && value !== "לא תועד" && value !== "לא דווח";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      data-testid={testId}
      data-value={value}
      className={cn(
        "flex min-h-[82px] flex-col items-center justify-center gap-1 px-2 py-3 text-center transition-colors hover:bg-muted/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        expanded && "bg-muted/65",
      )}
    >
      <span className="flex items-center justify-center gap-1 text-[12px] font-medium text-muted-foreground">
        <span aria-hidden>{icon}</span>
        {label}
      </span>
      <span
        className={cn(
          "text-[15px] leading-tight tabular-nums",
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
